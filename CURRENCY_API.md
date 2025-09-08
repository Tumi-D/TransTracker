# Currency Service API Documentation

## 🏦 Overview

The Currency Service provides comprehensive multi-currency support for the Budget Tracker application, including real-time exchange rates, automatic conversions, and intelligent currency management.

## 📚 Table of Contents

- [Core Classes](#core-classes)
- [Currency Conversion](#currency-conversion)
- [Exchange Rate Management](#exchange-rate-management)
- [UI Integration](#ui-integration)
- [Database Schema](#database-schema)
- [Error Handling](#error-handling)
- [Usage Examples](#usage-examples)

## 🔧 Core Classes

### CurrencyConversionService

The main service class that handles all currency operations.

```typescript
import { currencyService } from '../services/currencyService';
```

#### Methods

##### `convertAmount(amount: number, fromCurrency: string, toCurrency: string): Promise<number>`
Converts an amount from one currency to another.

**Parameters:**
- `amount` - The amount to convert
- `fromCurrency` - Source currency code (ISO 4217)
- `toCurrency` - Target currency code (ISO 4217)

**Returns:** Promise resolving to converted amount

**Example:**
```typescript
const usdAmount = await currencyService.convertAmount(100, 'GHS', 'USD');
console.log(`100 GHS = ${usdAmount} USD`); // 100 GHS = 8.00 USD
```

##### `getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number>`
Gets the exchange rate between two currencies.

**Parameters:**
- `fromCurrency` - Source currency code
- `toCurrency` - Target currency code

**Returns:** Promise resolving to exchange rate

**Example:**
```typescript
const rate = await currencyService.getExchangeRate('USD', 'GHS');
console.log(`1 USD = ${rate} GHS`); // 1 USD = 12.50 GHS
```

##### `updateExchangeRates(): Promise<boolean>`
Manually updates exchange rates from external providers.

**Returns:** Promise resolving to success status

**Example:**
```typescript
const success = await currencyService.updateExchangeRates();
if (success) {
  console.log('Exchange rates updated successfully');
}
```

##### `getAvailableCurrencies(): Promise<Currency[]>`
Retrieves all available currencies.

**Returns:** Promise resolving to array of Currency objects

**Example:**
```typescript
const currencies = await currencyService.getAvailableCurrencies();
currencies.forEach(currency => {
  console.log(`${currency.code}: ${currency.name} (${currency.symbol})`);
});
```

##### `formatCurrency(amount: number, currencyCode: string): Promise<string>`
Formats an amount with proper currency symbol and decimal places.

**Parameters:**
- `amount` - Amount to format
- `currencyCode` - Currency code for formatting

**Returns:** Promise resolving to formatted string

**Example:**
```typescript
const formatted = await currencyService.formatCurrency(1234.56, 'USD');
console.log(formatted); // "$1,234.56"
```

##### `getMultiCurrencyBalance(): Promise<{[currency: string]: number}>`
Gets balance breakdown by currency.

**Returns:** Promise resolving to currency-balance mapping

**Example:**
```typescript
const balances = await currencyService.getMultiCurrencyBalance();
// { "GHS": 1500.00, "USD": 120.00, "EUR": 80.50 }
```

##### `getConsolidatedBalance(displayCurrency: string): Promise<number>`
Gets total balance converted to a single display currency.

**Parameters:**
- `displayCurrency` - Target currency for consolidation

**Returns:** Promise resolving to consolidated balance

**Example:**
```typescript
const totalUSD = await currencyService.getConsolidatedBalance('USD');
console.log(`Total balance: $${totalUSD.toFixed(2)}`);
```

## 📊 Data Types

### Currency Interface

```typescript
interface Currency {
  id: string;
  code: string;           // ISO 4217 code (USD, EUR, GHS)
  name: string;           // Full name (US Dollar, Euro, Ghanaian Cedi)
  symbol: string;         // Currency symbol ($, €, ₵)
  decimalPlaces: number;  // Number of decimal places (usually 2)
  isActive: boolean;      // Whether currency is available
  exchangeRate: number;   // Rate relative to base currency
  lastUpdated: string;    // ISO timestamp of last rate update
}
```

### UserPreferences Interface

```typescript
interface UserPreferences {
  id: string;
  baseCurrency: string;              // Primary currency for calculations
  displayCurrency: string;           // Currency for UI display
  autoConvert: boolean;              // Auto-convert foreign transactions
  updateRatesFrequency: 'hourly' | 'daily' | 'weekly' | 'manual';
  showMultipleCurrencies: boolean;   // Show currency breakdown in UI
  createdAt: string;
  updatedAt: string;
}
```

### Transaction Currency Fields

```typescript
interface Transaction {
  // ... existing fields ...
  currency: string;         // Transaction currency
  exchangeRate?: number;    // Exchange rate at time of transaction
  originalAmount?: number;  // Original amount in foreign currency
  originalCurrency?: string; // Original currency if converted
}
```

## 🔄 Exchange Rate Providers

### ExchangeRateProvider Interface

```typescript
interface ExchangeRateProvider {
  name: string;
  fetchRates(baseCurrency: string): Promise<{[currency: string]: number}>;
}
```

### Available Providers

#### 1. ExchangeRateApiProvider (Primary)
- **Source:** api.exchangerate-api.com
- **Free Tier:** 1,500 requests/month
- **Update Frequency:** Real-time
- **Reliability:** High

#### 2. FallbackRateProvider (Backup)
- **Source:** Static rates
- **Reliability:** Always available
- **Use Case:** When primary provider fails

**Example Provider Usage:**
```typescript
// Providers are automatically used by the service
// Manual provider access is typically not needed

// However, you can check which provider was used:
const success = await currencyService.updateExchangeRates();
// Service logs will show which provider succeeded
```

## 🎨 UI Integration

### AppContext Integration

The currency service is integrated into the global app context:

```typescript
const {
  state,
  getFormattedAmount,
  convertAmount,
  getConsolidatedBalance
} = useAppContext();

// Access currency data
const currencies = state.currencies;
const userPrefs = state.userPreferences;
const balances = state.multiCurrencyBalances;

// Use helper functions
const formattedAmount = await getFormattedAmount(100, 'USD');
const convertedAmount = await convertAmount(100, 'GHS', 'USD');
const totalBalance = await getConsolidatedBalance();
```

### MultiCurrencyBalance Component

```typescript
import { MultiCurrencyBalance } from '../components/MultiCurrencyBalance';

// Usage in screens
<MultiCurrencyBalance />
```

**Features:**
- Consolidated balance display
- Individual currency breakdowns
- Real-time conversion indicators
- Loading states and error handling

### Currency Settings (ProfileScreen)

The ProfileScreen includes currency management:

```typescript
// Currency settings are built into ProfileScreen
// Users can:
// - Set base currency
// - Set display currency
// - Toggle multi-currency display
// - Update exchange rates manually
// - View current exchange rates
```

## 💾 Database Schema

### New Tables

```sql
-- Currency definitions
CREATE TABLE currencies (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,      -- ISO 4217 code
  name TEXT NOT NULL,             -- Full currency name
  symbol TEXT NOT NULL,           -- Currency symbol
  decimalPlaces INTEGER DEFAULT 2,
  isActive INTEGER DEFAULT 1,
  exchangeRate REAL DEFAULT 1.0,  -- Rate to base currency
  lastUpdated TEXT NOT NULL
);

-- User currency preferences
CREATE TABLE user_preferences (
  id TEXT PRIMARY KEY,
  baseCurrency TEXT NOT NULL DEFAULT 'GHS',
  displayCurrency TEXT NOT NULL DEFAULT 'GHS',
  autoConvert INTEGER DEFAULT 1,
  updateRatesFrequency TEXT DEFAULT 'daily',
  showMultipleCurrencies INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
```

### Enhanced Tables

```sql
-- Transactions with currency support
ALTER TABLE transactions ADD COLUMN currency TEXT DEFAULT 'GHS';
ALTER TABLE transactions ADD COLUMN exchangeRate REAL DEFAULT 1.0;
ALTER TABLE transactions ADD COLUMN originalAmount REAL;
ALTER TABLE transactions ADD COLUMN originalCurrency TEXT;

-- Budgets with currency support
ALTER TABLE budgets ADD COLUMN currency TEXT DEFAULT 'GHS';

-- Accounts with currency support
ALTER TABLE accounts ADD COLUMN currency TEXT DEFAULT 'GHS';
```

## 🚨 Error Handling

### Common Error Scenarios

#### 1. Network Failures
```typescript
try {
  const success = await currencyService.updateExchangeRates();
} catch (error) {
  // Service automatically falls back to cached/static rates
  console.log('Using cached exchange rates due to network error');
}
```

#### 2. Invalid Currency Codes
```typescript
try {
  const amount = await currencyService.convertAmount(100, 'INVALID', 'USD');
} catch (error) {
  // Service returns original amount or throws descriptive error
  console.error('Invalid currency code provided');
}
```

#### 3. API Rate Limits
```typescript
// Service automatically switches to fallback provider
// No manual intervention required
```

### Error Recovery

The service implements multiple layers of error recovery:

1. **Multiple Providers:** Falls back to secondary providers
2. **Cached Rates:** Uses last known good rates
3. **Static Rates:** Ultimate fallback with reasonable estimates
4. **Graceful Degradation:** UI continues to function with warnings

## 📖 Usage Examples

### Basic Currency Conversion

```typescript
import { currencyService } from '../services/currencyService';

// Convert 1000 GHS to USD
const convertGHStoUSD = async () => {
  try {
    const usdAmount = await currencyService.convertAmount(1000, 'GHS', 'USD');
    const formatted = await currencyService.formatCurrency(usdAmount, 'USD');
    console.log(`1000 GHS = ${formatted}`); // 1000 GHS = $80.00
  } catch (error) {
    console.error('Conversion failed:', error);
  }
};
```

### Multi-Currency Balance Display

```typescript
import { useAppContext } from '../context/AppContext';

const BalanceComponent = () => {
  const { state, getFormattedAmount } = useAppContext();
  const [formattedBalances, setFormattedBalances] = useState({});

  useEffect(() => {
    const formatBalances = async () => {
      const formatted = {};
      for (const [currency, amount] of Object.entries(state.multiCurrencyBalances)) {
        formatted[currency] = await getFormattedAmount(amount, currency);
      }
      setFormattedBalances(formatted);
    };
    
    formatBalances();
  }, [state.multiCurrencyBalances]);

  return (
    <View>
      {Object.entries(formattedBalances).map(([currency, formatted]) => (
        <Text key={currency}>{currency}: {formatted}</Text>
      ))}
    </View>
  );
};
```

### Currency Settings Management

```typescript
import { databaseService } from '../database/schema';

const updateBaseCurrency = async (newBaseCurrency: string) => {
  try {
    const db = await databaseService.getDatabase();
    await db.runAsync(
      'UPDATE user_preferences SET baseCurrency = ?, updatedAt = ?',
      [newBaseCurrency, new Date().toISOString()]
    );
    
    // Refresh app data to reflect changes
    await refreshData();
    
    console.log(`Base currency changed to ${newBaseCurrency}`);
  } catch (error) {
    console.error('Failed to update base currency:', error);
  }
};
```

### Real-time Rate Updates

```typescript
const setupAutomaticUpdates = () => {
  // Updates based on user preferences
  // Handled automatically by the service
  // Manual trigger:
  
  const updateRates = async () => {
    try {
      const success = await currencyService.updateExchangeRates();
      if (success) {
        console.log('Rates updated successfully');
        // UI automatically reflects new rates
      }
    } catch (error) {
      console.error('Rate update failed:', error);
    }
  };
  
  // Call updateRates() when needed
};
```

## 🔧 Configuration

### Supported Currencies

The service comes pre-configured with these currencies:

| Code | Name | Symbol | Region |
|------|------|---------|--------|
| GHS | Ghanaian Cedi | ₵ | Ghana (Base) |
| USD | US Dollar | $ | United States |
| EUR | Euro | € | European Union |
| GBP | British Pound | £ | United Kingdom |
| NGN | Nigerian Naira | ₦ | Nigeria |
| ZAR | South African Rand | R | South Africa |

### Default Settings

```typescript
const defaultPreferences = {
  baseCurrency: 'GHS',
  displayCurrency: 'GHS',
  autoConvert: true,
  updateRatesFrequency: 'daily',
  showMultipleCurrencies: false
};
```

### Rate Update Frequencies

- **Hourly:** Updates every hour (for active traders)
- **Daily:** Updates once per day (recommended)
- **Weekly:** Updates once per week (minimal usage)
- **Manual:** Only updates when requested

---

## 🎯 Best Practices

1. **Always use the service through AppContext** for UI components
2. **Handle errors gracefully** - the service provides fallbacks
3. **Cache formatted amounts** to avoid repeated formatting calls
4. **Use consolidated balance** for main UI displays
5. **Show loading states** during rate updates
6. **Respect API rate limits** - don't update too frequently

## 🔗 Integration Points

- **AppContext:** Global state management
- **Database:** Persistent storage
- **ProfileScreen:** User settings
- **HomeScreen:** Balance display
- **Transaction Forms:** Currency selection
- **Background Services:** Automatic updates

This documentation covers the complete Currency Service API. For specific implementation details, refer to the source code in `src/services/currencyService.ts`.