import { databaseService } from '../database/schema';
import { Currency, UserPreferences } from '../database/schema';

export interface ExchangeRateProvider {
  name: string;
  fetchRates(baseCurrency: string): Promise<{[currency: string]: number}>;
}

export class CurrencyConversionService {
  private exchangeRateProviders: ExchangeRateProvider[] = [];
  private lastRateUpdate: Date | null = null;
  private rateCache: {[key: string]: number} = {};

  constructor() {
    // Register available exchange rate providers
    this.exchangeRateProviders = [
      new ExchangeRateApiProvider(),
      new FallbackRateProvider() // Always keep as last resort
    ];
  }

  // Convert amount from one currency to another
  async convertAmount(amount: number, fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    return amount * rate;
  }

  // Get exchange rate between two currencies
  async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) {
      return 1.0;
    }

    const db = await databaseService.getDatabase();
    if (!db) throw new Error('Database not available');

    // Check if we need to update rates
    const userPrefs = await this.getUserPreferences();
    const shouldUpdate = await this.shouldUpdateRates(userPrefs.updateRatesFrequency);

    if (shouldUpdate) {
      await this.updateExchangeRates();
    }

    // Get rates from database
    const fromRate = await this.getCurrencyRate(fromCurrency, userPrefs.baseCurrency);
    const toRate = await this.getCurrencyRate(toCurrency, userPrefs.baseCurrency);

    // Calculate cross rate: (amount in base) * (base to target)
    return toRate / fromRate;
  }

  // Update exchange rates from external providers
  async updateExchangeRates(): Promise<boolean> {
    try {
      const db = await databaseService.getDatabase();
      if (!db) return false;

      const userPrefs = await this.getUserPreferences();
      
      // Try each provider until one succeeds
      for (const provider of this.exchangeRateProviders) {
        try {
          console.log(`Fetching rates from ${provider.name}...`);
          const rates = await provider.fetchRates(userPrefs.baseCurrency);
          
          // Update database with new rates
          const now = new Date().toISOString();
          
          for (const [currencyCode, rate] of Object.entries(rates)) {
            await db.runAsync(
              'UPDATE currencies SET exchangeRate = ?, lastUpdated = ? WHERE code = ?',
              [rate, now, currencyCode]
            );
          }

          // Update base currency rate to 1.0
          await db.runAsync(
            'UPDATE currencies SET exchangeRate = ?, lastUpdated = ? WHERE code = ?',
            [1.0, now, userPrefs.baseCurrency]
          );

          this.lastRateUpdate = new Date();
          console.log(`Successfully updated exchange rates using ${provider.name}`);
          return true;
        } catch (error) {
          console.warn(`Failed to fetch rates from ${provider.name}:`, error);
          continue;
        }
      }

      console.error('All exchange rate providers failed');
      return false;
    } catch (error) {
      console.error('Error updating exchange rates:', error);
      return false;
    }
  }

  // Get all available currencies
  async getAvailableCurrencies(): Promise<Currency[]> {
    const db = await databaseService.getDatabase();
    if (!db) return [];

    const currencies = await db.getAllAsync(
      'SELECT * FROM currencies WHERE isActive = 1 ORDER BY code'
    );
    
    return currencies.map(row => ({
      id: (row as any).id,
      code: (row as any).code,
      name: (row as any).name,
      symbol: (row as any).symbol,
      decimalPlaces: (row as any).decimalPlaces,
      isActive: (row as any).isActive === 1,
      exchangeRate: (row as any).exchangeRate,
      lastUpdated: (row as any).lastUpdated
    }));
  }

  // Format amount with proper currency symbol and decimal places
  async formatCurrency(amount: number, currencyCode: string): Promise<string> {
    const db = await databaseService.getDatabase();
    if (!db) return `${amount.toFixed(2)}`;

    const currency = await db.getFirstAsync(
      'SELECT symbol, decimalPlaces FROM currencies WHERE code = ?',
      [currencyCode]
    );

    if (!currency) return `${amount.toFixed(2)} ${currencyCode}`;

    const symbol = (currency as any).symbol;
    const decimals = (currency as any).decimalPlaces || 2;
    
    return `${symbol}${amount.toFixed(decimals)}`;
  }

  // Get user's multi-currency balance summary
  async getMultiCurrencyBalance(): Promise<{[currency: string]: number}> {
    const db = await databaseService.getDatabase();
    if (!db) return {};

    // Get balance by currency from transactions
    const balances = await db.getAllAsync(`
      SELECT 
        currency,
        SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as balance
      FROM transactions 
      GROUP BY currency
    `);

    const result: {[currency: string]: number} = {};
    for (const row of balances) {
      const currency = (row as any).currency;
      const balance = (row as any).balance || 0;
      result[currency] = balance;
    }

    return result;
  }

  // Convert all balances to display currency
  async getConsolidatedBalance(displayCurrency: string): Promise<number> {
    const multiCurrencyBalances = await this.getMultiCurrencyBalance();
    let totalInDisplayCurrency = 0;

    for (const [currency, balance] of Object.entries(multiCurrencyBalances)) {
      const convertedAmount = await this.convertAmount(balance, currency, displayCurrency);
      totalInDisplayCurrency += convertedAmount;
    }

    return totalInDisplayCurrency;
  }

  // Helper methods
  private async getCurrencyRate(currencyCode: string, baseCurrency: string): Promise<number> {
    const db = await databaseService.getDatabase();
    if (!db) return 1.0;

    if (currencyCode === baseCurrency) return 1.0;

    const currency = await db.getFirstAsync(
      'SELECT exchangeRate FROM currencies WHERE code = ?',
      [currencyCode]
    );

    return (currency as any)?.exchangeRate || 1.0;
  }

  private async getUserPreferences(): Promise<UserPreferences> {
    const db = await databaseService.getDatabase();
    if (!db) {
      // Return default preferences
      return {
        id: 'default',
        baseCurrency: 'GHS',
        displayCurrency: 'GHS', 
        autoConvert: true,
        updateRatesFrequency: 'daily',
        showMultipleCurrencies: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    const prefs = await db.getFirstAsync('SELECT * FROM user_preferences LIMIT 1');
    if (!prefs) {
      // Create default preferences if none exist
      const defaultPrefs = {
        id: `pref_${Date.now()}`,
        baseCurrency: 'GHS',
        displayCurrency: 'GHS',
        autoConvert: true,
        updateRatesFrequency: 'daily' as const,
        showMultipleCurrencies: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await db.runAsync(
        `INSERT INTO user_preferences (id, baseCurrency, displayCurrency, autoConvert, updateRatesFrequency, showMultipleCurrencies, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [defaultPrefs.id, defaultPrefs.baseCurrency, defaultPrefs.displayCurrency, 1, defaultPrefs.updateRatesFrequency, 0, defaultPrefs.createdAt, defaultPrefs.updatedAt]
      );
      
      return defaultPrefs;
    }

    return {
      id: (prefs as any).id,
      baseCurrency: (prefs as any).baseCurrency,
      displayCurrency: (prefs as any).displayCurrency,
      autoConvert: (prefs as any).autoConvert === 1,
      updateRatesFrequency: (prefs as any).updateRatesFrequency,
      showMultipleCurrencies: (prefs as any).showMultipleCurrencies === 1,
      createdAt: (prefs as any).createdAt,
      updatedAt: (prefs as any).updatedAt
    };
  }

  private async shouldUpdateRates(frequency: string): Promise<boolean> {
    if (frequency === 'manual') return false;
    if (!this.lastRateUpdate) return true;

    const now = new Date();
    const timeDiff = now.getTime() - this.lastRateUpdate.getTime();

    switch (frequency) {
      case 'hourly':
        return timeDiff > 60 * 60 * 1000; // 1 hour
      case 'daily':
        return timeDiff > 24 * 60 * 60 * 1000; // 24 hours
      case 'weekly':
        return timeDiff > 7 * 24 * 60 * 60 * 1000; // 7 days
      default:
        return false;
    }
  }
}

// Exchange Rate API Provider (Free tier)
class ExchangeRateApiProvider implements ExchangeRateProvider {
  name = 'ExchangeRate-API';
  
  async fetchRates(baseCurrency: string): Promise<{[currency: string]: number}> {
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    return data.rates;
  }
}

// Fallback provider with static rates (when APIs fail)
class FallbackRateProvider implements ExchangeRateProvider {
  name = 'Fallback Static Rates';
  
  async fetchRates(baseCurrency: string): Promise<{[currency: string]: number}> {
    // Static fallback rates relative to GHS (Ghana Cedi)
    const staticRates: {[key: string]: {[key: string]: number}} = {
      'GHS': {
        'USD': 0.08,    // 1 GHS = 0.08 USD  
        'EUR': 0.073,   // 1 GHS = 0.073 EUR
        'GBP': 0.063,   // 1 GHS = 0.063 GBP
        'CAD': 0.108,   // 1 GHS = 0.108 CAD
        'AUD': 0.120,   // 1 GHS = 0.120 AUD
        'NGN': 133.33,  // 1 GHS = 133.33 NGN
        'ZAR': 1.47,    // 1 GHS = 1.47 ZAR
        'GHS': 1.0
      },
      'USD': {
        'GHS': 12.50,   // 1 USD = 12.50 GHS
        'EUR': 0.91,    // 1 USD = 0.91 EUR
        'GBP': 0.79,    // 1 USD = 0.79 GBP  
        'CAD': 1.35,    // 1 USD = 1.35 CAD
        'AUD': 1.50,    // 1 USD = 1.50 AUD
        'NGN': 1666,    // 1 USD = 1666 NGN
        'ZAR': 18.38,   // 1 USD = 18.38 ZAR
        'USD': 1.0
      }
    };

    const rates = staticRates[baseCurrency];
    if (!rates) {
      throw new Error(`No fallback rates available for ${baseCurrency}`);
    }
    
    console.warn(`Using fallback static exchange rates for ${baseCurrency}`);
    return rates;
  }
}

export const currencyService = new CurrencyConversionService();