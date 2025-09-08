import * as SQLite from 'expo-sqlite';

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  type: 'income' | 'expense';
  source: 'sms' | 'manual';
  date: string;
  account?: string;
  merchant?: string;
  isRecurring?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  name: string;
  category: string;
  amount: number;
  spent: number;
  period: 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  keywords: string[]; // SMS keywords for auto-categorization
  createdAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'bank' | 'credit' | 'cash' | 'investment';
  balance: number;
  isActive: boolean;
  smsKeywords: string[]; // Keywords to identify this account in SMS
  createdAt: string;
  updatedAt: string;
}

export interface SMSRule {
  id: string;
  name: string;
  pattern: string; // Regex pattern
  categoryId: string;
  accountId?: string;
  amountExtraction: string; // Regex group for amount
  merchantExtraction?: string; // Regex group for merchant
  isActive: boolean;
  createdAt: string;
}

export interface ProcessedSMS {
  id: string;
  smsId: string; // Original SMS message ID
  sender: string;
  body: string;
  date: string;
  transactionId?: string; // If a transaction was created from this SMS
  isProcessed: boolean;
  createdAt: string;
}

export class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private isInitialized: boolean = false;

  async init(): Promise<void> {
    // If already initialized, return immediately
    if (this.isInitialized && this.db) {
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initPromise) {
      return this.initPromise;
    }

    // Start initialization
    this.initPromise = this.performInit();
    return this.initPromise;
  }

  private async performInit(): Promise<void> {
    try {
      console.log('Starting database initialization...');
      
      // Open database
      this.db = await SQLite.openDatabaseAsync('budget_tracker.db');
      console.log('Database opened successfully');
      
      // Create tables
      await this.createTables();
      console.log('Tables created successfully');
      
      // Insert default categories
      await this.insertDefaultCategories();
      console.log('Default categories inserted');
      
      // Insert default currencies
      await this.insertDefaultCurrencies();
      console.log('Default currencies inserted');
      
      // Initialize user preferences
      await this.initializeUserPreferences();
      console.log('User preferences initialized');
      
      // Run cleanup after initialization to fix any existing duplicates
      await this.cleanupDuplicateCategories();
      console.log('Database cleanup completed');
      
      this.isInitialized = true;
      console.log('Database initialization completed successfully');
    } catch (error) {
      console.error('Database initialization failed:', error);
      this.db = null;
      this.initPromise = null;
      this.isInitialized = false;
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) return;

    try {
      console.log('Creating transactions table...');
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          amount REAL NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
          source TEXT NOT NULL CHECK (source IN ('sms', 'manual')),
          date TEXT NOT NULL,
          account TEXT,
          merchant TEXT,
          isRecurring INTEGER DEFAULT 0,
          currency TEXT DEFAULT 'GHS',
          exchangeRate REAL DEFAULT 1.0,
          originalAmount REAL,
          originalCurrency TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )
      `);

      // Add currency columns to existing transactions table if they don't exist
      try {
        await this.db.execAsync('ALTER TABLE transactions ADD COLUMN currency TEXT DEFAULT "GHS"');
        await this.db.execAsync('ALTER TABLE transactions ADD COLUMN exchangeRate REAL DEFAULT 1.0');
        await this.db.execAsync('ALTER TABLE transactions ADD COLUMN originalAmount REAL');
        await this.db.execAsync('ALTER TABLE transactions ADD COLUMN originalCurrency TEXT');
        console.log('Added currency columns to existing transactions table');
      } catch (error) {
        // Columns might already exist, that's okay
        console.log('Currency columns already exist in transactions table:', (error as Error).message);
      }

      console.log('Creating budgets table...');
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS budgets (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          amount REAL NOT NULL,
          spent REAL DEFAULT 0,
          period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly')),
          startDate TEXT NOT NULL,
          endDate TEXT NOT NULL,
          isActive INTEGER DEFAULT 1,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )
      `);

      console.log('Creating categories table...');
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
          color TEXT NOT NULL,
          icon TEXT NOT NULL,
          keywords TEXT NOT NULL,
          createdAt TEXT NOT NULL
        )
      `);

      console.log('Creating accounts table...');
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('bank', 'credit', 'cash', 'investment')),
          balance REAL DEFAULT 0,
          isActive INTEGER DEFAULT 1,
          smsKeywords TEXT NOT NULL,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )
      `);

      console.log('Creating sms_rules table...');
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS sms_rules (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          pattern TEXT NOT NULL,
          categoryId TEXT NOT NULL,
          accountId TEXT,
          amountExtraction TEXT NOT NULL,
          merchantExtraction TEXT,
          isActive INTEGER DEFAULT 1,
          createdAt TEXT NOT NULL
        )
      `);

      console.log('Creating processed_sms table...');
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS processed_sms (
          id TEXT PRIMARY KEY,
          smsId TEXT UNIQUE NOT NULL,
          sender TEXT NOT NULL,
          body TEXT NOT NULL,
          date TEXT NOT NULL,
          transactionId TEXT,
          isProcessed INTEGER DEFAULT 1,
          createdAt TEXT NOT NULL
        )
      `);

      console.log('Creating currencies table...');
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS currencies (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          symbol TEXT NOT NULL,
          decimalPlaces INTEGER DEFAULT 2,
          isActive INTEGER DEFAULT 1,
          exchangeRate REAL DEFAULT 1.0,
          lastUpdated TEXT NOT NULL
        )
      `);

      console.log('Creating user_preferences table...');
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          id TEXT PRIMARY KEY,
          userId TEXT,
          baseCurrency TEXT NOT NULL DEFAULT 'GHS',
          displayCurrency TEXT NOT NULL DEFAULT 'GHS',
          autoConvert INTEGER DEFAULT 1,
          updateRatesFrequency TEXT DEFAULT 'daily' CHECK (updateRatesFrequency IN ('hourly', 'daily', 'weekly', 'manual')),
          showMultipleCurrencies INTEGER DEFAULT 0,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )
      `);

      console.log('Creating indexes...');
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (date)
      `);
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category)
      `);
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets (category)
      `);
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_budgets_period ON budgets (period, startDate, endDate)
      `);
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_processed_sms_date ON processed_sms (date)
      `);
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_processed_sms_sender ON processed_sms (sender)
      `);
      
      console.log('All tables and indexes created successfully');
    } catch (error) {
      console.error('Error creating tables:', error);
      throw error;
    }
  }

  // Method to clean up duplicate categories
  async cleanupDuplicateCategories(): Promise<void> {
    if (!this.db) return;
    
    console.log('Cleaning up duplicate categories...');
    
    // Delete duplicates, keeping only the first occurrence of each name
    await this.db.execAsync(`
      DELETE FROM categories 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM categories 
        GROUP BY name, type
      )
    `);
    
    const remainingCount = await this.db.getAllAsync('SELECT COUNT(*) as count FROM categories');
    console.log(`Cleanup complete. Remaining categories: ${(remainingCount[0] as any).count}`);
  }

  private async insertDefaultCategories(): Promise<void> {
    if (!this.db) return;
    
    // Clean up any existing duplicates first
    await this.cleanupDuplicateCategories();

    const defaultCategories = [
      { name: 'Food & Dining', type: 'expense', color: '#FF6B35', icon: 'restaurant', keywords: ['restaurant', 'food', 'dining', 'cafe', 'pizza', 'kfc', 'subway', 'chop bar'] },
      { name: 'Transportation', type: 'expense', color: '#4ECDC4', icon: 'car', keywords: ['fuel', 'petrol', 'uber', 'taxi', 'bus', 'trotro', 'transport', 'goil', 'shell'] },
      { name: 'Shopping', type: 'expense', color: '#45B7D1', icon: 'shopping-bag', keywords: ['shopping', 'store', 'purchase', 'market', 'mall', 'shoprite'] },
      { name: 'Bills & Utilities', type: 'expense', color: '#F39C12', icon: 'receipt', keywords: ['electric', 'water', 'internet', 'phone', 'utility', 'bill', 'ecg', 'vodafone', 'mtn', 'airtel'] },
      { name: 'Healthcare', type: 'expense', color: '#E74C3C', icon: 'medical-bag', keywords: ['hospital', 'pharmacy', 'doctor', 'medical', 'health', 'clinic'] },
      { name: 'Entertainment', type: 'expense', color: '#9B59B6', icon: 'music', keywords: ['movie', 'entertainment', 'game', 'concert', 'cinema'] },
      { name: 'Transfers', type: 'expense', color: '#8E44AD', icon: 'swap-horizontal', keywords: ['transfer', 'wallet', 'bank transfer', 'mobile money', 'momo'] },
      { name: 'Salary', type: 'income', color: '#27AE60', icon: 'attach-money', keywords: ['salary', 'wage', 'payroll', 'income', 'pay'] },
      { name: 'Transfers', type: 'income', color: '#16A085', icon: 'swap-horizontal', keywords: ['transfer', 'wallet to bank', 'bank transfer', 'mobile money', 'momo', 'received'] },
      { name: 'Investment', type: 'income', color: '#2ECC71', icon: 'trending-up', keywords: ['dividend', 'interest', 'investment', 'profit', 'return'] },
      { name: 'Other Income', type: 'income', color: '#1ABC9C', icon: 'plus-circle', keywords: ['bonus', 'gift', 'refund', 'cashback'] },
      { name: 'Other Expense', type: 'expense', color: '#95A5A6', icon: 'more-horizontal', keywords: ['misc', 'other', 'miscellaneous'] }
    ];

    // First check if categories already exist to prevent duplicates
    const existingCategories = await this.db.getAllAsync('SELECT COUNT(*) as count FROM categories');
    const categoryCount = (existingCategories[0] as any).count;
    
    if (categoryCount > 0) {
      console.log(`Categories already exist (${categoryCount}), skipping default insertion`);
      return;
    }
    
    console.log('Inserting default categories...');
    for (const category of defaultCategories) {
      const id = `cat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      try {
        await this.db.runAsync(
          `INSERT INTO categories (id, name, type, color, icon, keywords, createdAt) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, category.name, category.type, category.color, category.icon, JSON.stringify(category.keywords), new Date().toISOString()]
        );
        console.log(`Inserted category: ${category.name}`);
        // Small delay to ensure unique timestamps
        await new Promise(resolve => setTimeout(resolve, 1));
      } catch (error) {
        console.error(`Failed to insert category ${category.name}:`, error);
      }
    }
    console.log('Default categories insertion complete');
    
    // Verify insertion
    const finalCount = await this.db.getAllAsync('SELECT COUNT(*) as count FROM categories');
    console.log(`Total categories after insertion: ${(finalCount[0] as any).count}`);
  }

  private async insertDefaultCurrencies(): Promise<void> {
    if (!this.db) return;
    
    // Check if currencies already exist
    const existingCurrencies = await this.db.getAllAsync('SELECT COUNT(*) as count FROM currencies');
    const currencyCount = (existingCurrencies[0] as any).count;
    
    if (currencyCount > 0) {
      console.log(`Currencies already exist (${currencyCount}), skipping default insertion`);
      return;
    }
    
    const defaultCurrencies = [
      { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', decimalPlaces: 2, isActive: true, exchangeRate: 1.0 },
      { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2, isActive: true, exchangeRate: 0.08 },
      { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2, isActive: true, exchangeRate: 0.073 },
      { code: 'GBP', name: 'British Pound', symbol: '£', decimalPlaces: 2, isActive: true, exchangeRate: 0.063 },
    ];
    
    console.log('Inserting default currencies...');
    for (const currency of defaultCurrencies) {
      const id = `cur_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      try {
        await this.db.runAsync(
          `INSERT INTO currencies (id, code, name, symbol, decimalPlaces, isActive, exchangeRate, lastUpdated) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, currency.code, currency.name, currency.symbol, currency.decimalPlaces, currency.isActive ? 1 : 0, currency.exchangeRate, new Date().toISOString()]
        );
        console.log(`Inserted currency: ${currency.code} - ${currency.name}`);
        await new Promise(resolve => setTimeout(resolve, 1));
      } catch (error) {
        console.error(`Failed to insert currency ${currency.code}:`, error);
      }
    }
    console.log('Default currencies insertion complete');
  }

  private async initializeUserPreferences(): Promise<void> {
    if (!this.db) return;
    
    // Check if user preferences already exist
    const existingPrefs = await this.db.getAllAsync('SELECT COUNT(*) as count FROM user_preferences');
    const prefsCount = (existingPrefs[0] as any).count;
    
    if (prefsCount > 0) {
      console.log('User preferences already exist, skipping initialization');
      return;
    }
    
    const id = `pref_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    
    try {
      await this.db.runAsync(
        `INSERT INTO user_preferences (id, baseCurrency, displayCurrency, autoConvert, updateRatesFrequency, showMultipleCurrencies, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, 'GHS', 'GHS', 1, 'daily', 0, now, now]
      );
      console.log('User preferences initialized with GHS as base currency');
    } catch (error) {
      console.error('Failed to initialize user preferences:', error);
    }
  }

  async getDatabase(): Promise<SQLite.SQLiteDatabase | null> {
    // Ensure database is initialized before returning
    if (!this.isInitialized || !this.db) {
      await this.init();
    }
    return this.db;
  }

  // Method to clear demo/mock transactions
  async clearDemoTransactions(): Promise<number> {
    try {
      const db = await this.getDatabase();
      if (!db) return 0;

      // Delete transactions that are clearly demo data
      const demoPatterns = [
        '%DEMO:%',
        '%JANE SMITH%', 
        '%JOHN DOE%',
        '%ending 1234%',
        '%account ending 1234%',
        '%KWAME ASANTE%',
        '%233244567890%',
        '%mock_%',
        '%demo_%',
        '%fallback_%'
      ];

      let totalDeleted = 0;

      for (const pattern of demoPatterns) {
        const result = await db.runAsync(
          'DELETE FROM transactions WHERE description LIKE ? OR merchant LIKE ?',
          [pattern, pattern]
        );
        totalDeleted += result.changes || 0;
      }

      // Also clear processed_sms entries that are demo/mock
      const mockSmsPatterns = [
        '%mock_%',
        '%demo_%', 
        '%fallback_%'
      ];

      for (const pattern of mockSmsPatterns) {
        await db.runAsync(
          'DELETE FROM processed_sms WHERE smsId LIKE ?',
          [pattern]
        );
      }

      console.log(`Cleared ${totalDeleted} demo transactions`);
      return totalDeleted;
    } catch (error) {
      console.error('Error clearing demo transactions:', error);
      return 0;
    }
  }

  // Method to detect and remove duplicate transactions
  async removeDuplicateTransactions(): Promise<number> {
    try {
      const db = await this.getDatabase();
      if (!db) return 0;

      console.log('Scanning for duplicate transactions...');

      // Find potential duplicates: same amount, type, and date within 1 minute window
      const duplicateQuery = `
        SELECT 
          t1.id as keep_id,
          t2.id as duplicate_id,
          t1.amount,
          t1.description as keep_desc,
          t2.description as dup_desc,
          t1.date as keep_date,
          t2.date as dup_date
        FROM transactions t1 
        INNER JOIN transactions t2 ON 
          t1.amount = t2.amount 
          AND t1.type = t2.type 
          AND t1.category = t2.category
          AND t1.id < t2.id
          AND ABS((julianday(t2.date) - julianday(t1.date)) * 86400) <= 60
        ORDER BY t1.date, t1.amount
      `;

      const duplicates = await db.getAllAsync(duplicateQuery);
      console.log(`Found ${duplicates.length} potential duplicate pairs`);

      let removedCount = 0;
      const idsToRemove: string[] = [];

      for (const dup of duplicates as any[]) {
        // Additional checks to confirm it's really a duplicate
        const isDuplicate = this.isDuplicateTransaction(dup);
        
        if (isDuplicate && !idsToRemove.includes(dup.duplicate_id)) {
          idsToRemove.push(dup.duplicate_id);
          console.log(`Marking duplicate: ${dup.dup_desc.substring(0, 50)}... (${dup.amount})`);
        }
      }

      // Remove the duplicates
      if (idsToRemove.length > 0) {
        const placeholders = idsToRemove.map(() => '?').join(',');
        const result = await db.runAsync(
          `DELETE FROM transactions WHERE id IN (${placeholders})`,
          idsToRemove
        );
        removedCount = result.changes || 0;
      }

      console.log(`Removed ${removedCount} duplicate transactions`);
      return removedCount;
    } catch (error) {
      console.error('Error removing duplicate transactions:', error);
      return 0;
    }
  }

  private isDuplicateTransaction(dup: any): boolean {
    // Check if descriptions are very similar (for SMS variations)
    const desc1 = dup.keep_desc.toLowerCase();
    const desc2 = dup.dup_desc.toLowerCase();
    
    // Same amount, type, category, and within 1 minute - likely duplicate
    if (desc1 === desc2) {
      return true; // Exact same description
    }

    // Check for similar patterns (different reference numbers but same transaction)
    const similarityChecks = [
      // Both mention the same merchant
      this.extractMerchantFromDescription(desc1) === this.extractMerchantFromDescription(desc2),
      // Both are from same source (SMS patterns)
      this.haveSimilarSMSPatterns(desc1, desc2),
      // Both mention same account ending
      this.extractAccountFromDescription(desc1) === this.extractAccountFromDescription(desc2)
    ];

    // If at least 2 of 3 similarity checks pass, consider it duplicate
    return similarityChecks.filter(Boolean).length >= 2;
  }

  private extractMerchantFromDescription(desc: string): string | null {
    // Extract merchant/location from common patterns
    const patterns = [
      /at\s+([A-Z][A-Z\s&.-]+?)(?:\s+on|\s*\.|$)/i,
      /from\s+([A-Z][A-Z\s]+?)(?:\s+current|\s*\.|$)/i,
      /to\s+([A-Z][A-Z\s]+?)(?:\s+successful|\s*\.|$)/i
    ];

    for (const pattern of patterns) {
      const match = desc.match(pattern);
      if (match) return match[1].trim().toLowerCase();
    }
    return null;
  }

  private extractAccountFromDescription(desc: string): string | null {
    const accountMatch = desc.match(/ending\s+(\d{4})/i);
    return accountMatch ? accountMatch[1] : null;
  }

  private haveSimilarSMSPatterns(desc1: string, desc2: string): boolean {
    // Check if both descriptions follow similar SMS banking patterns
    const smsPatterns = [
      /has been (debited|credited)/i,
      /(payment|transfer) (received|sent)/i,
      /available balance/i,
      /current balance/i,
      /transaction (id|ref)/i
    ];

    let matches1 = 0, matches2 = 0;
    for (const pattern of smsPatterns) {
      if (pattern.test(desc1)) matches1++;
      if (pattern.test(desc2)) matches2++;
    }

    // Both should match similar number of SMS patterns
    return matches1 > 0 && matches2 > 0 && Math.abs(matches1 - matches2) <= 1;
  }
}

export const databaseService = new DatabaseService();