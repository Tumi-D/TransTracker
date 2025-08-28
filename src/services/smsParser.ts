import { Transaction, Category, Account, SMSRule } from '../database/schema';
import { databaseService } from '../database/schema';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ParsedTransaction {
  amount: number;
  description: string;
  merchant?: string;
  account?: string;
  type: 'income' | 'expense';
  category: string;
  date: string;
  rawMessage: string;
}

export class SMSParserService {
  private categories: Category[] = [];
  private accounts: Account[] = [];
  private smsRules: SMSRule[] = [];

  constructor() {
    this.initializeParser();
  }
  
  private async initializeParser() {
    try {
      // Ensure database is initialized first
      await databaseService.init();
      await this.loadCategories();
      await this.loadAccounts();
      await this.loadSMSRules();
    } catch (error) {
      console.error('Error initializing SMS parser:', error);
    }
  }

  private async loadCategories(): Promise<void> {
    const db = await databaseService.getDatabase();
    if (!db) return;

    const result = await db.getAllAsync('SELECT * FROM categories');
    this.categories = result.map((row: any) => ({
      ...row,
      keywords: JSON.parse(row.keywords)
    }));
  }

  private async loadAccounts(): Promise<void> {
    const db = await databaseService.getDatabase();
    if (!db) return;

    const result = await db.getAllAsync('SELECT * FROM accounts WHERE isActive = 1');
    this.accounts = result.map((row: any) => ({
      ...row,
      smsKeywords: JSON.parse(row.smsKeywords)
    }));
  }

  private async loadSMSRules(): Promise<void> {
    const db = await databaseService.getDatabase();
    if (!db) return;

    const result = await db.getAllAsync('SELECT * FROM sms_rules WHERE isActive = 1');
    this.smsRules = result as SMSRule[];
  }

  async parseMessage(message: string, sender: string, date: Date): Promise<ParsedTransaction | null> {
    console.log('=== SMS PARSING START ===');
    console.log('Sender:', sender);
    console.log('Message:', message);
    
    // Ensure categories are loaded before parsing
    if (!this.categories || this.categories.length === 0) {
      console.log('Loading categories...');
      await this.loadCategories();
      console.log('Categories loaded:', this.categories.length);
    }
    
    const messageText = message.toLowerCase();
    
    // Check if this is a financial SMS (basic filters)
    const isFinancial = this.isFinancialSMS(messageText, sender);
    console.log('Is financial SMS:', isFinancial);
    
    if (!isFinancial) {
      console.log('=== SMS PARSING END (Not Financial) ===');
      return null;
    }

    // Try to parse using custom rules first
    for (const rule of this.smsRules) {
      const parsed = this.parseWithRule(message, rule, date);
      if (parsed) {
        console.log('Parsed with rule:', rule.name);
        console.log('=== SMS PARSING END (Rule Match) ===');
        return parsed;
      }
    }

    // Fallback to generic parsing
    console.log('Using generic parsing...');
    const result = this.parseGeneric(message, sender, date);
    console.log('Generic parsing result:', result);
    console.log('=== SMS PARSING END ===');
    return result;
  }

  private isFinancialSMS(message: string, sender: string): boolean {
    const financialKeywords = [
      'debit', 'credit', 'payment', 'transaction', 'balance', 'withdraw',
      'deposit', 'transfer', 'purchase', 'spent', 'charged', 'refund',
      'salary', 'atm', 'pos', 'momo', 'mobile money', 'wallet',
      'bank', 'account', 'card', 'cedis', 'ghs', '$', '₵',
      'amt:', 'acct:', 'desc:', 'type:', 'avail.bal', 'zprompt'
    ];

    const trustedSenders = [
      'bank', 'momo', 'zprompt', 'gtbank', 'gcb', 'uba', 'absa',
      'fidelity', 'cal', 'ecobank', 'stanbic', 'societe', 'prudential',
      'mobile', 'wallet', 'airtel', 'vodafone', 'mtn'
    ];

    return financialKeywords.some(keyword => message.includes(keyword)) ||
           trustedSenders.some(sender_keyword => sender.toLowerCase().includes(sender_keyword));
  }

  private parseWithRule(message: string, rule: SMSRule, date: Date): ParsedTransaction | null {
    try {
      const regex = new RegExp(rule.pattern, 'i');
      const match = message.match(regex);
      
      if (!match) return null;

      const amountMatch = match[parseInt(rule.amountExtraction)] || match.groups?.amount;
      const merchantMatch = rule.merchantExtraction ? 
        (match[parseInt(rule.merchantExtraction)] || match.groups?.merchant) : undefined;

      if (!amountMatch) return null;

      const amount = this.extractAmount(amountMatch);
      if (amount === 0) return null;

      const category = this.categories.find(c => c.id === rule.categoryId);
      const account = rule.accountId ? this.accounts.find(a => a.id === rule.accountId) : undefined;

      return {
        amount,
        description: this.cleanDescription(message),
        merchant: merchantMatch || this.extractMerchant(message),
        account: account?.name,
        type: category?.type || 'expense',
        category: category?.name || 'Other',
        date: date.toISOString(),
        rawMessage: message
      };
    } catch (error) {
      console.error('Error parsing with rule:', error);
      return null;
    }
  }

  private parseGeneric(message: string, sender: string, date: Date): ParsedTransaction | null {
    const amount = this.extractAmount(message);
    console.log('Extracted amount:', amount);
    
    if (amount === 0) {
      console.log('No amount found, parsing failed');
      return null;
    }

    const type = this.determineTransactionType(message);
    console.log('Transaction type:', type);
    
    const merchant = this.extractMerchant(message);
    console.log('Extracted merchant:', merchant);
    
    const account = this.identifyAccount(message, sender);
    console.log('Identified account:', account?.name);
    
    const category = this.categorizeTransaction(message, merchant, type, sender);
    console.log('Categorized as:', category.name);

    const result = {
      amount,
      description: this.cleanDescription(message),
      merchant,
      account: account?.name,
      type,
      category: category.name,
      date: date.toISOString(),
      rawMessage: message
    };
    
    console.log('Final parsed transaction:', result);
    return result;
  }

  private extractAmount(text: string): number {
    // Common patterns for amount extraction - enhanced for Ghana bank formats and MOMO
    const patterns = [
      // MOMO format: "Payment received for GHS 123.00"
      /(?:payment\s+(?:received|sent)\s+for\s+|received\s+for\s+)ghs\s*([\d,]+(?:\.\d{2})?)/i,
      // Ghana bank format: "Amt: GHS1,000.00" or "GHS1,000.00"
      /amt[:\s]*ghs\s*([\d,]+(?:\.\d{2})?)/i,
      /(?:ghs\.?\s*|₵\s*)([\d,]+(?:\.\d{2})?)/i,
      // Standard formats
      /(?:ghs\s+|usd\s+)([\d,]+(?:\.\d{2})?)/i,
      /amount[:\s]+(?:ghs\.?\s*|₵\s*)?([\d,]+(?:\.\d{2})?)/i,
      /(?:debit|credit|paid|spent|charged)[^0-9]*([\d,]+(?:\.\d{2})?)/i,
      // Multi-line amount pattern
      /amt[:\s]*([\d,]+(?:\.\d{2})?)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const amountStr = match[1].replace(/,/g, '');
        const amount = parseFloat(amountStr);
        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }
    }

    return 0;
  }

  private determineTransactionType(message: string): 'income' | 'expense' {
    const messageText = message.toLowerCase();
    
    // Strong income indicators (these override other keywords)
    const strongIncomeKeywords = [
      'payment received', 'money received', 'received for', 'credited', 
      'has sent you', 'sent you', 'you received', 'received from',
      'salary', 'refund', 'cashback', 'type: credit', 'credit alert'
    ];
    
    // Strong expense indicators
    const strongExpenseKeywords = [
      'payment sent', 'money sent', 'debited', 'withdraw', 'spent', 
      'charged', 'purchase', 'type: debit', 'debit alert'
    ];
    
    // Check strong income indicators first
    for (const keyword of strongIncomeKeywords) {
      if (messageText.includes(keyword)) {
        return 'income';
      }
    }
    
    // Check strong expense indicators
    for (const keyword of strongExpenseKeywords) {
      if (messageText.includes(keyword)) {
        return 'expense';
      }
    }
    
    // Fallback to general keywords with scoring
    const generalIncomeKeywords = ['credit', 'deposit', 'received', 'transfer for'];
    const generalExpenseKeywords = ['debit', 'payment', 'transfer to'];
    
    const incomeScore = generalIncomeKeywords.reduce((score, keyword) => 
      messageText.includes(keyword) ? score + 1 : score, 0);
    const expenseScore = generalExpenseKeywords.reduce((score, keyword) => 
      messageText.includes(keyword) ? score + 1 : score, 0);

    return incomeScore > expenseScore ? 'income' : 'expense';
  }

  private extractMerchant(message: string): string | undefined {
    // Patterns to extract merchant names - enhanced for Ghana formats and MOMO
    const patterns = [
      // MOMO format: "Payment received for GHS 123.00 from CHRIS ADJEI DEBRAH"
      /(?:from|to)\s+([A-Z][A-Z\s]+?)(?:\s+current\s+balance|\s+transaction|\s*\.|$)/i,
      // Ghana specific: "Wallet to Bank Transfer for 233546945817"
      /(?:transfer for|to)\s+(\d{12})/i,
      /desc[:\s]*([^\n\r]+?)(?:\s+trans|\s+id|$)/i,
      // Standard patterns
      /(?:at|@)\s+([A-Z][A-Z0-9\s&.-]+?)(?:\s+on|\s+dated|\s*\.|$)/i,
      /(?:to|from)\s+([A-Z][A-Z0-9\s&.-]+?)(?:\s+on|\s+dated|\s*\.|$)/i,
      /(?:merchant|vendor):\s*([A-Z][A-Z0-9\s&.-]+?)(?:\s|$)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private identifyAccount(message: string, sender: string): Account | undefined {
    const messageText = message.toLowerCase();
    const senderText = sender.toLowerCase();
    
    // First try to match by sender
    let matchedAccount = this.accounts.find(account => 
      account.smsKeywords.some(keyword => 
        senderText.includes(keyword.toLowerCase())
      )
    );
    
    // If no sender match, try account number pattern
    if (!matchedAccount) {
      const accountMatch = messageText.match(/acct[:\s]*(\d{4})\*+\d{2}/);
      if (accountMatch) {
        const accountPrefix = accountMatch[1];
        matchedAccount = this.accounts.find(account =>
          account.smsKeywords.some(keyword => 
            keyword.includes(accountPrefix) || 
            messageText.includes(keyword.toLowerCase())
          )
        );
      }
    }
    
    return matchedAccount;
  }

  private categorizeTransaction(message: string, merchant: string | undefined, type: 'income' | 'expense', sender?: string): Category {
    const messageText = message.toLowerCase();
    const merchantText = merchant?.toLowerCase() || '';
    const senderText = sender?.toLowerCase() || '';

    // Ensure categories are loaded
    if (!this.categories || this.categories.length === 0) {
      // Return a default category if none are loaded
      return {
        id: 'default',
        name: type === 'income' ? 'Other Income' : 'Other Expense',
        type: type,
        color: type === 'income' ? '#27AE60' : '#95A5A6',
        icon: type === 'income' ? 'plus-circle' : 'more-horizontal',
        keywords: [],
        createdAt: new Date().toISOString()
      };
    }

    // Special handling for MOMO/Mobile Money transfers
    if (senderText.includes('momo') || messageText.includes('mobile money') || 
        messageText.includes('payment received') || messageText.includes('payment sent') ||
        messageText.includes('has sent you') || messageText.includes('sent you') ||
        messageText.includes('via hbtl.co') || messageText.includes('hubtel')) {
      const transferCategory = this.categories.find(c => 
        c && c.type === type && c.name.toLowerCase().includes('transfer')
      );
      if (transferCategory) {
        console.log('Categorized as Transfer due to MOMO/mobile money keywords');
        return transferCategory;
      }
    }

    // Find the best matching category based on keywords
    const relevantCategories = this.categories.filter(c => c && c.type === type);
    let bestMatch: Category | undefined;
    let bestScore = 0;

    console.log('Categorizing transaction:', { messageText, merchantText, type });

    for (const category of relevantCategories) {
      if (!category || !category.keywords) continue;
      
      let score = 0;
      const matchedKeywords: string[] = [];
      
      for (const keyword of category.keywords) {
        const keywordLower = keyword.toLowerCase();
        if (messageText.includes(keywordLower) || merchantText.includes(keywordLower)) {
          score++;
          matchedKeywords.push(keyword);
          
          // Give extra weight to more specific keywords
          if (keywordLower.length > 5) {
            score += 0.5;
          }
          
          // Give extra weight to exact phrase matches
          if (keywordLower.includes(' ') && messageText.includes(keywordLower)) {
            score += 1;
          }
        }
      }
      
      console.log(`Category: ${category.name}, Score: ${score}, Matched: ${matchedKeywords.join(', ')}`);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = category;
      }
    }

    console.log(`Best match: ${bestMatch?.name} with score: ${bestScore}`);

    // Fallback to default category
    const fallbackCategory = bestMatch || 
      this.categories.find(c => c && c.name === (type === 'income' ? 'Other Income' : 'Other Expense')) ||
      this.categories.find(c => c && c.type === type) ||
      this.categories[0];
      
    // Final safety check
    if (!fallbackCategory) {
      return {
        id: 'fallback',
        name: type === 'income' ? 'Other Income' : 'Other Expense',
        type: type,
        color: type === 'income' ? '#27AE60' : '#95A5A6',
        icon: type === 'income' ? 'plus-circle' : 'more-horizontal',
        keywords: [],
        createdAt: new Date().toISOString()
      };
    }
    
    return fallbackCategory;
  }

  private cleanDescription(message: string): string {
    // Remove sensitive information and clean up the message
    return message
      .replace(/\b\d{4}\*+\d{4}\b/g, '**** ****') // Mask card numbers
      .replace(/\b\d{10,}\b/g, '**********') // Mask long numbers
      .replace(/ref\s*no[:\s]+\w+/gi, '') // Remove reference numbers
      .replace(/available\s+balance[:\s]+[\d,.]+/gi, '') // Remove balance info
      .trim()
      .substring(0, 200); // Limit description length
  }

  async saveTransaction(parsedTransaction: ParsedTransaction): Promise<string> {
    try {
      const db = await databaseService.getDatabase();
      if (!db) throw new Error('Database not available');

      const id = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();

      // Use execAsync instead of runAsync to avoid null pointer issues
      await db.execAsync(`
        INSERT INTO transactions 
        (id, amount, description, category, type, source, date, account, merchant, isRecurring, createdAt, updatedAt)
        VALUES ('${id}', ${parsedTransaction.amount}, '${parsedTransaction.description.replace(/'/g, "''")}', 
                '${parsedTransaction.category}', '${parsedTransaction.type}', 'sms', 
                '${parsedTransaction.date}', ${parsedTransaction.account ? `'${parsedTransaction.account}'` : 'NULL'}, 
                ${parsedTransaction.merchant ? `'${parsedTransaction.merchant.replace(/'/g, "''")}'` : 'NULL'}, 
                0, '${now}', '${now}')
      `);

      // Store raw SMS for debugging
      await AsyncStorage.setItem(`sms_${id}`, parsedTransaction.rawMessage);

      return id;
    } catch (error) {
      console.error('Error saving transaction:', error);
      throw error;
    }
  }

  // Method to create custom SMS parsing rules
  async createSMSRule(rule: Omit<SMSRule, 'id' | 'createdAt'>): Promise<string> {
    const db = await databaseService.getDatabase();
    if (!db) throw new Error('Database not available');

    const id = `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO sms_rules 
       (id, name, pattern, categoryId, accountId, amountExtraction, merchantExtraction, isActive, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, rule.name, rule.pattern, rule.categoryId, rule.accountId || null,
       rule.amountExtraction, rule.merchantExtraction || null, rule.isActive ? 1 : 0, now]
    );

    // Reload rules
    await this.loadSMSRules();

    return id;
  }
}

export const smsParserService = new SMSParserService();