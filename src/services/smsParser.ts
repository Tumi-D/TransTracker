import { Transaction, Category, Account, SMSRule } from '../database/schema';
import { databaseService } from '../database/schema';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ParsedTransaction {
  amount: number;
  currency: string;
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
    
    // Check if this is a financial SMS (enhanced filters)
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

    // Fallback to generic parsing with confidence scoring
    console.log('Using generic parsing...');
    const result = this.parseGeneric(message, sender, date);
    
    if (result) {
      const confidence = this.calculateTransactionConfidence(result, message, sender);
      console.log('Transaction confidence score:', confidence);
      
      // Only return transactions with high confidence (>= 0.7)
      if (confidence >= 0.7) {
        console.log('Transaction accepted with confidence:', confidence);
        console.log('=== SMS PARSING END (High Confidence) ===');
        return result;
      } else {
        console.log('Transaction rejected due to low confidence:', confidence);
        console.log('=== SMS PARSING END (Low Confidence) ===');
        return null;
      }
    }
    
    console.log('Generic parsing result:', result);
    console.log('=== SMS PARSING END ===');
    return result;
  }

  private isFinancialSMS(message: string, sender: string): boolean {
    const messageText = message.toLowerCase();
    const senderText = sender.toLowerCase();
    
    // Check for promotional patterns (multiple promotional indicators = promotional message)
    const promotionalScore = this.calculatePromotionalScore(messageText);
    if (promotionalScore >= 2) {
      console.log(`SMS rejected: High promotional score (${promotionalScore})`);
      return false;
    }
    
    // First check for promotional/marketing indicators that disqualify the message
    const promotionalKeywords = [
      // Marketing terms
      'offer', 'discount', 'promo', 'promotion', 'deal', 'save up to', 'get up to',
      'limited time', 'hurry', 'act now', 'don\'t miss', 'exclusive', 'special offer',
      'win', 'winner', 'congratulations', 'prize', 'reward points', 'loyalty',
      'cashback offer', 'bonus points', 'earn points', 'redeem points',
      
      // Marketing actions
      'visit', 'click', 'download', 'install', 'register', 'sign up', 'subscribe',
      'call now', 'text back', 'reply', 'dial', 'sms', 'ussd', 'terms apply',
      'terms and conditions', 't&c apply', 'participate', 'enter to win',
      
      // Promotional phrases
      'up to', 'as low as', 'starting from', 'from just', 'only', 'just',
      'free', 'complimentary', 'no cost', 'waived', 'zero', 'nil',
      'upgrade', 'new product', 'new service', 'launch', 'introducing',
      
      // Marketing urgency
      'expires', 'valid until', 'ends soon', 'last chance', 'final days',
      'today only', 'this week only', 'weekend special',
      
      // Ghana-specific promotional phrases
      'enjoy free', 'support you', 'take advantage', 'insurance for your',
      'help you grow', 'woman in business', 'business coverage', 'assistance',
      'calls on mondays', 'bonus with every purchase', 'whatsapp'
    ];
    
    // Check for promotional content
    const hasPromotionalContent = promotionalKeywords.some(keyword => 
      messageText.includes(keyword)
    );
    
    if (hasPromotionalContent) {
      console.log('SMS rejected: Contains promotional content');
      return false;
    }
    
    // Check for reminder/notification messages (not actual transactions)
    const reminderKeywords = [
      'payment due date', 'due date is', 'your payment due', 'ensure you have',
      'plan ahead', 'reminder', 'upcoming payment', 'balance reminder',
      'halfway into', 'payment term', 'settle your balance', 'overdue',
      'if you did not apply', 'please call', 'to report it'
    ];
    
    const isReminder = reminderKeywords.some(keyword => 
      messageText.includes(keyword)
    );
    
    if (isReminder) {
      console.log('SMS rejected: Payment reminder/notification message');
      return false;
    }
    
    // Enhanced financial transaction keywords (more specific)
    const strongTransactionKeywords = [
      // Actual transaction indicators
      'transaction successful', 'transaction completed', 'transaction failed',
      'payment received', 'payment sent', 'payment successful', 'payment failed',
      'transfer successful', 'transfer completed', 'transfer received',
      'withdrawal successful', 'deposit successful',
      'debited', 'credited', 'charged', 'refunded',
      
      // Account activity
      'current balance', 'available balance', 'account balance', 'bal:', 'avail.bal',
      'low balance', 'insufficient funds',
      
      // Transaction details
      'amt:', 'amount:', 'acct:', 'desc:', 'ref:', 'transaction id', 'trans id',
      'type: debit', 'type: credit', 'debit alert', 'credit alert'
    ];
    
    // Check for strong transaction indicators
    const hasStrongTransactionKeyword = strongTransactionKeywords.some(keyword => 
      messageText.includes(keyword)
    );
    
    if (hasStrongTransactionKeyword) {
      return true;
    }
    
    // Trusted financial institutions (more specific patterns)
    const trustedFinancialSenders = [
      'gtbank', 'gcb-bank', 'uba-ghana', 'absa-bank', 'fidelity-bank',
      'cal-bank', 'ecobank-ghana', 'stanbic-bank', 'societe-generale',
      'prudential-bank', 'zenith-bank', 'access-bank',
      'mtn-momo', 'vodafone-cash', 'airtel-money', 'tigo-cash',
      'zprompt', 'hubtel', 'expresspay'
    ];
    
    const isTrustedSender = trustedFinancialSenders.some(sender_keyword => 
      senderText.includes(sender_keyword)
    );
    
    // For trusted senders, we need additional transaction evidence
    if (isTrustedSender) {
      const transactionEvidence = [
        // Amount patterns
        /(?:ghs\.?\s*|₵\s*)([\d,]+(?:\.\d{2})?)/i,
        /amt[:\s]*([\d,]+(?:\.\d{2})?)/i,
        
        // Account references
        /acct[:\s]*\d{4}/i,
        /account.*\d{4}/i,
        
        // Transaction types
        /debit|credit|withdraw|deposit|transfer/i,
        
        // Balance information
        /balance[:\s]*(ghs|₵)/i
      ];
      
      const hasTransactionEvidence = transactionEvidence.some(pattern => 
        pattern.test(messageText)
      );
      
      if (hasTransactionEvidence) {
        return true;
      }
    }
    
    console.log('SMS rejected: No strong transaction evidence found');
    return false;
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

      const { amount, currency } = this.extractAmountAndCurrency(amountMatch);
      if (amount === 0) return null;

      const category = this.categories.find(c => c.id === rule.categoryId);
      const account = rule.accountId ? this.accounts.find(a => a.id === rule.accountId) : undefined;

      return {
        amount,
        currency,
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
    const { amount, currency } = this.extractAmountAndCurrency(message);
    console.log('Extracted amount and currency:', { amount, currency });
    
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
      currency,
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

  private extractAmountAndCurrency(text: string): { amount: number; currency: string } {
    // Multi-currency patterns for amount extraction
    const patterns = [
      // Explicit currency with symbols
      { pattern: /(?:payment\s+(?:received|sent)\s+for\s+|received\s+for\s+)usd\s*([\d,]+(?:\.\d{2})?)/i, currency: 'USD' },
      { pattern: /(?:payment\s+(?:received|sent)\s+for\s+|received\s+for\s+)ghs\s*([\d,]+(?:\.\d{2})?)/i, currency: 'GHS' },
      { pattern: /(?:payment\s+(?:received|sent)\s+for\s+|received\s+for\s+)eur\s*([\d,]+(?:\.\d{2})?)/i, currency: 'EUR' },
      { pattern: /(?:payment\s+(?:received|sent)\s+for\s+|received\s+for\s+)gbp\s*([\d,]+(?:\.\d{2})?)/i, currency: 'GBP' },
      
      // Amount with currency code patterns
      { pattern: /amt[:\s]*usd\s*([\d,]+(?:\.\d{2})?)/i, currency: 'USD' },
      { pattern: /amt[:\s]*ghs\s*([\d,]+(?:\.\d{2})?)/i, currency: 'GHS' },
      { pattern: /amt[:\s]*eur\s*([\d,]+(?:\.\d{2})?)/i, currency: 'EUR' },
      { pattern: /amt[:\s]*gbp\s*([\d,]+(?:\.\d{2})?)/i, currency: 'GBP' },
      { pattern: /amt[:\s]*cad\s*([\d,]+(?:\.\d{2})?)/i, currency: 'CAD' },
      { pattern: /amt[:\s]*aud\s*([\d,]+(?:\.\d{2})?)/i, currency: 'AUD' },
      { pattern: /amt[:\s]*ngn\s*([\d,]+(?:\.\d{2})?)/i, currency: 'NGN' },
      { pattern: /amt[:\s]*zar\s*([\d,]+(?:\.\d{2})?)/i, currency: 'ZAR' },
      
      // Currency symbols
      { pattern: /(?:\$\s*)([\d,]+(?:\.\d{2})?)/i, currency: 'USD' },
      { pattern: /(?:€\s*)([\d,]+(?:\.\d{2})?)/i, currency: 'EUR' },
      { pattern: /(?:£\s*)([\d,]+(?:\.\d{2})?)/i, currency: 'GBP' },
      { pattern: /(?:₵\s*)([\d,]+(?:\.\d{2})?)/i, currency: 'GHS' },
      { pattern: /(?:₦\s*)([\d,]+(?:\.\d{2})?)/i, currency: 'NGN' },
      { pattern: /(?:R\s*)([\d,]+(?:\.\d{2})?)/i, currency: 'ZAR' },
      
      // Currency code followed by amount
      { pattern: /(?:usd\.?\s*)([\d,]+(?:\.\d{2})?)/i, currency: 'USD' },
      { pattern: /(?:ghs\.?\s*)([\d,]+(?:\.\d{2})?)/i, currency: 'GHS' },
      { pattern: /(?:eur\.?\s*)([\d,]+(?:\.\d{2})?)/i, currency: 'EUR' },
      { pattern: /(?:gbp\.?\s*)([\d,]+(?:\.\d{2})?)/i, currency: 'GBP' },
      { pattern: /(?:cad\.?\s*)([\d,]+(?:\.\d{2})?)/i, currency: 'CAD' },
      { pattern: /(?:aud\.?\s*)([\d,]+(?:\.\d{2})?)/i, currency: 'AUD' },
      { pattern: /(?:ngn\.?\s*)([\d,]+(?:\.\d{2})?)/i, currency: 'NGN' },
      { pattern: /(?:zar\.?\s*)([\d,]+(?:\.\d{2})?)/i, currency: 'ZAR' },
      
      // Amount with currency after
      { pattern: /([\d,]+(?:\.\d{2})?)\s*usd/i, currency: 'USD' },
      { pattern: /([\d,]+(?:\.\d{2})?)\s*ghs/i, currency: 'GHS' },
      { pattern: /([\d,]+(?:\.\d{2})?)\s*eur/i, currency: 'EUR' },
      { pattern: /([\d,]+(?:\.\d{2})?)\s*gbp/i, currency: 'GBP' },
      { pattern: /([\d,]+(?:\.\d{2})?)\s*cad/i, currency: 'CAD' },
      { pattern: /([\d,]+(?:\.\d{2})?)\s*aud/i, currency: 'AUD' },
      { pattern: /([\d,]+(?:\.\d{2})?)\s*ngn/i, currency: 'NGN' },
      { pattern: /([\d,]+(?:\.\d{2})?)\s*zar/i, currency: 'ZAR' },
      
      // Generic amount patterns with context-based currency detection
      { pattern: /amount[:\s]+(?:[\$€£₵₦R]\s*)?([\d,]+(?:\.\d{2})?)/i, currency: 'GHS' }, // Default to GHS
      { pattern: /(?:debit|credit|paid|spent|charged)[^0-9]*([\d,]+(?:\.\d{2})?)/i, currency: 'GHS' }, // Default to GHS
      { pattern: /amt[:\s]*([\d,]+(?:\.\d{2})?)/i, currency: 'GHS' } // Default to GHS (fallback)
    ];

    for (const { pattern, currency } of patterns) {
      const match = text.match(pattern);
      if (match) {
        const amountStr = match[1].replace(/,/g, '');
        const amount = parseFloat(amountStr);
        
        // Enhanced validation for realistic transaction amounts
        if (!isNaN(amount) && this.isValidTransactionAmount(amount, currency)) {
          return { amount, currency };
        }
      }
    }

    // If no currency found, try to determine from context
    const contextCurrency = this.detectCurrencyFromContext(text);
    return { amount: 0, currency: contextCurrency };
  }

  private extractAmount(text: string): number {
    const { amount } = this.extractAmountAndCurrency(text);
    return amount;
  }

  private detectCurrencyFromContext(text: string): string {
    const lowerText = text.toLowerCase();
    
    // Currency indicators in message content
    const currencyClues = [
      { keywords: ['ghana', 'accra', 'kumasi', 'tamale', 'gtbank', 'gcb', 'zenith-gh'], currency: 'GHS' },
      { keywords: ['nigeria', 'lagos', 'abuja', 'naira', 'gtbank-ng', 'zenith-ng'], currency: 'NGN' },
      { keywords: ['south africa', 'johannesburg', 'cape town', 'rand', 'absa', 'fnb'], currency: 'ZAR' },
      { keywords: ['united states', 'usa', 'america', 'dollars'], currency: 'USD' },
      { keywords: ['europe', 'euro', 'germany', 'france', 'italy'], currency: 'EUR' },
      { keywords: ['united kingdom', 'britain', 'uk', 'pounds', 'sterling'], currency: 'GBP' },
      { keywords: ['canada', 'toronto', 'vancouver'], currency: 'CAD' },
      { keywords: ['australia', 'sydney', 'melbourne'], currency: 'AUD' }
    ];

    for (const { keywords, currency } of currencyClues) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return currency;
      }
    }

    // Default based on common African mobile money patterns
    if (lowerText.includes('momo') || lowerText.includes('mobile money')) {
      if (lowerText.includes('mtn') || lowerText.includes('vodafone') || lowerText.includes('airtel')) {
        return 'GHS'; // Ghana mobile money providers
      }
    }

    return 'GHS'; // Default fallback
  }

  private isValidTransactionAmount(amount: number, currency: string = 'GHS'): boolean {
    // Currency-specific validation ranges
    const currencyLimits: {[key: string]: { min: number; max: number; suspiciousSmall: number[] }} = {
      'USD': { 
        min: 0.01, 
        max: 500000, 
        suspiciousSmall: [1, 5, 10, 20, 25, 50, 100] 
      },
      'EUR': { 
        min: 0.01, 
        max: 450000, 
        suspiciousSmall: [1, 5, 10, 20, 25, 50, 100] 
      },
      'GBP': { 
        min: 0.01, 
        max: 400000, 
        suspiciousSmall: [1, 5, 10, 20, 25, 50, 100] 
      },
      'GHS': { 
        min: 1, 
        max: 2000000, 
        suspiciousSmall: [10, 20, 50, 100, 200, 500, 1000] 
      },
      'NGN': { 
        min: 50, 
        max: 100000000, 
        suspiciousSmall: [100, 500, 1000, 2000, 5000, 10000] 
      },
      'ZAR': { 
        min: 1, 
        max: 5000000, 
        suspiciousSmall: [10, 50, 100, 200, 500, 1000] 
      },
      'KES': { 
        min: 10, 
        max: 10000000, 
        suspiciousSmall: [100, 500, 1000, 2000, 5000] 
      },
      'CAD': { 
        min: 0.01, 
        max: 700000, 
        suspiciousSmall: [1, 5, 10, 20, 25, 50, 100] 
      },
      'AUD': { 
        min: 0.01, 
        max: 750000, 
        suspiciousSmall: [1, 5, 10, 20, 25, 50, 100] 
      }
    };
    
    const limits = currencyLimits[currency] || currencyLimits['GHS'];
    
    // Too small for the currency
    if (amount < limits.min) {
      console.log(`Amount rejected: Too small for ${currency}:`, amount);
      return false;
    }
    
    // Suspicious small amounts that are common in promotional text for this currency
    if (limits.suspiciousSmall.includes(amount)) {
      console.log(`Amount rejected: Suspicious promotional amount for ${currency}:`, amount);
      return false;
    }
    
    // Too large for the currency (likely account numbers, phone numbers, or fake promotional amounts)
    if (amount > limits.max) {
      console.log(`Amount rejected: Unrealistically large for ${currency}:`, amount);
      return false;
    }
    
    // Currency-specific round number patterns (common in promotional text)
    const roundNumberThresholds: {[key: string]: { start: number; end: number; divisor: number }} = {
      'USD': { start: 100, end: 1000, divisor: 100 },
      'EUR': { start: 100, end: 1000, divisor: 100 },
      'GBP': { start: 100, end: 1000, divisor: 100 },
      'GHS': { start: 500, end: 5000, divisor: 500 },
      'NGN': { start: 10000, end: 100000, divisor: 10000 },
      'ZAR': { start: 1000, end: 10000, divisor: 1000 },
      'KES': { start: 1000, end: 50000, divisor: 1000 },
      'CAD': { start: 100, end: 1000, divisor: 100 },
      'AUD': { start: 100, end: 1000, divisor: 100 }
    };
    
    const roundThreshold = roundNumberThresholds[currency] || roundNumberThresholds['GHS'];
    if (amount >= roundThreshold.start && 
        amount <= roundThreshold.end && 
        amount % roundThreshold.divisor === 0) {
      console.log(`Amount flagged: Round promotional amount for ${currency}:`, amount);
      // Don't reject entirely, but flag for confidence scoring
    }
    
    return true;
  }

  private calculateTransactionConfidence(
    transaction: ParsedTransaction, 
    originalMessage: string, 
    sender: string
  ): number {
    let confidence = 0;
    const messageText = originalMessage.toLowerCase();
    const senderText = sender.toLowerCase();
    
    // Base confidence for having parsed a transaction
    confidence += 0.3;
    
    // Confidence based on sender trustworthiness
    const highlyTrustedSenders = [
      'gtbank', 'gcb-bank', 'uba-ghana', 'absa-bank', 'fidelity-bank',
      'mtn-momo', 'vodafone-cash', 'zprompt', 'hubtel'
    ];
    
    if (highlyTrustedSenders.some(sender_keyword => senderText.includes(sender_keyword))) {
      confidence += 0.2;
    }
    
    // Confidence based on transaction indicators
    const strongIndicators = [
      'transaction successful', 'payment received', 'payment sent',
      'debited', 'credited', 'current balance', 'available balance',
      'transaction id', 'ref:', 'acct:'
    ];
    
    const indicatorMatches = strongIndicators.filter(indicator => 
      messageText.includes(indicator)
    ).length;
    
    confidence += Math.min(indicatorMatches * 0.1, 0.3);
    
    // Currency-aware amount validation
    const currencyBounds: {[key: string]: { min: number; max: number }} = {
      'USD': { min: 0.1, max: 50000 },
      'EUR': { min: 0.1, max: 45000 },
      'GBP': { min: 0.1, max: 40000 },
      'GHS': { min: 1, max: 100000 },
      'NGN': { min: 50, max: 50000000 },
      'ZAR': { min: 1, max: 1000000 },
      'CAD': { min: 0.1, max: 70000 },
      'AUD': { min: 0.1, max: 75000 }
    };
    
    const bounds = currencyBounds[transaction.currency] || currencyBounds['GHS'];
    if (transaction.amount >= bounds.min && transaction.amount <= bounds.max) {
      confidence += 0.1;
    } else {
      confidence -= 0.2; // Penalty for unrealistic amounts for the currency
    }
    
    // Currency-specific promotional amount patterns
    const suspiciousAmountPatterns: {[key: string]: number[]} = {
      'USD': [1, 5, 10, 20, 25, 50, 100],
      'EUR': [1, 5, 10, 20, 25, 50, 100],
      'GBP': [1, 5, 10, 20, 25, 50, 100],
      'GHS': [10, 20, 50, 100, 200, 500, 1000],
      'NGN': [100, 500, 1000, 2000, 5000, 10000],
      'ZAR': [10, 50, 100, 200, 500, 1000],
      'CAD': [1, 5, 10, 20, 25, 50, 100],
      'AUD': [1, 5, 10, 20, 25, 50, 100]
    };
    
    const suspiciousAmounts = suspiciousAmountPatterns[transaction.currency] || suspiciousAmountPatterns['GHS'];
    if (suspiciousAmounts.includes(transaction.amount)) {
      confidence -= 0.15; // Higher penalty for currency-specific promotional amounts
    }
    
    // Explicit currency mention increases confidence
    const currencyMentioned = messageText.includes(transaction.currency.toLowerCase()) ||
                              this.hasCurrencySymbol(messageText, transaction.currency);
    if (currencyMentioned) {
      confidence += 0.1;
    }
    
    // Confidence based on having structured transaction details
    if (transaction.merchant) confidence += 0.05;
    if (transaction.account) confidence += 0.05;
    
    // Penalty for generic categories (suggests poor parsing)
    if (transaction.category === 'Other' || transaction.category === 'Other Expense') {
      confidence -= 0.1;
    }
    
    // Confidence based on description quality
    if (transaction.description.length > 20 && 
        !transaction.description.includes('*')) {
      confidence += 0.05;
    }
    
    return Math.max(0, Math.min(1, confidence));
  }

  private hasCurrencySymbol(text: string, currency: string): boolean {
    const currencySymbols: {[key: string]: string} = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'GHS': '₵',
      'NGN': '₦',
      'ZAR': 'R',
      'CAD': '$',
      'AUD': '$'
    };
    
    const symbol = currencySymbols[currency];
    return symbol ? text.includes(symbol) : false;
  }

  private determineTransactionType(message: string): 'income' | 'expense' {
    const messageText = message.toLowerCase();
    
    // Enhanced loan detection with context analysis
    const loanContexts = this.analyzeLoanContext(messageText);
    
    // Strong income indicators (these override other keywords)
    const strongIncomeKeywords = [
      'payment received', 'money received', 'received for', 'credited', 
      'has sent you', 'sent you', 'you received', 'received from',
      'salary', 'refund', 'cashback', 'type: credit', 'credit alert',
      'deposit successful', 'transfer received', 'cash deposit',
      
      // Enhanced loan-specific income keywords with context
      'loan was paid into', 'loan of', 'loan disbursement', 'loan approved',
      'loan credited to', 'amount disbursed', 'funded by', 'loan facility',
      'credit facility approved', 'overdraft facility', 'loan amount credited',
      'disbursement successful', 'loan proceeds', 'advance payment received'
    ];
    
    // Strong expense indicators
    const strongExpenseKeywords = [
      'payment sent', 'money sent', 'debited', 'withdraw', 'spent', 
      'charged', 'purchase', 'type: debit', 'debit alert',
      'withdrawal successful', 'pos transaction', 'atm withdrawal',
      'bill payment', 'utility payment', 'subscription fee',
      'transfer sent', 'payment made'
    ];
    
    // Context-aware loan payment vs loan receipt analysis
    if (loanContexts.isLoanRelated) {
      // If it's a loan being received (disbursement)
      if (loanContexts.isLoanReceipt) {
        console.log('Detected loan receipt - categorizing as income');
        return 'income';
      }
      // If it's a loan payment (repayment)
      if (loanContexts.isLoanPayment) {
        console.log('Detected loan payment/repayment - categorizing as expense');
        return 'expense';
      }
    }
    
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
    
    // Enhanced context-based analysis
    const contextScore = this.calculateTransactionTypeScore(messageText);
    
    // Fallback to general keywords with improved scoring
    const generalIncomeKeywords = ['credit', 'deposit', 'received', 'transfer for', 'into your account'];
    const generalExpenseKeywords = ['debit', 'payment', 'transfer to', 'from your account'];
    
    const incomeScore = generalIncomeKeywords.reduce((score, keyword) => 
      messageText.includes(keyword) ? score + 1 : score, 0) + contextScore.income;
    const expenseScore = generalExpenseKeywords.reduce((score, keyword) => 
      messageText.includes(keyword) ? score + 1 : score, 0) + contextScore.expense;

    return incomeScore > expenseScore ? 'income' : 'expense';
  }
  
  private analyzeLoanContext(messageText: string): {
    isLoanRelated: boolean;
    isLoanReceipt: boolean;
    isLoanPayment: boolean;
    confidence: number;
  } {
    let isLoanRelated = false;
    let isLoanReceipt = false;
    let isLoanPayment = false;
    let confidence = 0;
    
    // Loan-related keywords
    const loanKeywords = [
      'loan', 'credit facility', 'overdraft', 'advance', 'financing',
      'disbursement', 'facility', 'credit line'
    ];
    
    // Check if message is loan-related
    for (const keyword of loanKeywords) {
      if (messageText.includes(keyword)) {
        isLoanRelated = true;
        confidence += 0.3;
        break;
      }
    }
    
    if (isLoanRelated) {
      // Loan receipt indicators (money coming in)
      const loanReceiptIndicators = [
        'loan was paid into', 'loan of', 'loan disbursement', 'loan credited',
        'amount disbursed', 'loan facility approved', 'loan proceeds',
        'disbursement successful', 'credit facility', 'funded by',
        'loan amount credited', 'advance payment received'
      ];
      
      // Loan payment indicators (money going out - repayment)
      const loanPaymentIndicators = [
        'loan payment', 'loan repayment', 'installment payment', 'emi payment',
        'loan installment', 'monthly payment', 'repay loan', 'loan due',
        'payment towards loan', 'loan settlement', 'principal payment',
        'interest payment', 'loan servicing'
      ];
      
      // Check for loan receipt
      for (const indicator of loanReceiptIndicators) {
        if (messageText.includes(indicator)) {
          isLoanReceipt = true;
          confidence += 0.4;
          break;
        }
      }
      
      // Check for loan payment (only if not already identified as receipt)
      if (!isLoanReceipt) {
        for (const indicator of loanPaymentIndicators) {
          if (messageText.includes(indicator)) {
            isLoanPayment = true;
            confidence += 0.4;
            break;
          }
        }
      }
      
      // Additional context clues
      if (messageText.includes('credited') || messageText.includes('received')) {
        isLoanReceipt = true;
        confidence += 0.2;
      } else if (messageText.includes('debited') || messageText.includes('paid')) {
        isLoanPayment = true;
        confidence += 0.2;
      }
    }
    
    return {
      isLoanRelated,
      isLoanReceipt,
      isLoanPayment,
      confidence: Math.min(confidence, 1.0)
    };
  }
  
  private calculateTransactionTypeScore(messageText: string): {
    income: number;
    expense: number;
  } {
    let incomeScore = 0;
    let expenseScore = 0;
    
    // Income context indicators
    const incomeContexts = [
      { phrase: 'money into', weight: 2 },
      { phrase: 'received from', weight: 2 },
      { phrase: 'sent to you', weight: 2 },
      { phrase: 'credit to', weight: 1.5 },
      { phrase: 'deposit into', weight: 1.5 },
      { phrase: 'balance increased', weight: 1 }
    ];
    
    // Expense context indicators
    const expenseContexts = [
      { phrase: 'money from', weight: 2 },
      { phrase: 'sent from', weight: 2 },
      { phrase: 'payment to', weight: 2 },
      { phrase: 'debit from', weight: 1.5 },
      { phrase: 'withdrawn from', weight: 1.5 },
      { phrase: 'balance reduced', weight: 1 }
    ];
    
    // Calculate income score
    for (const context of incomeContexts) {
      if (messageText.includes(context.phrase)) {
        incomeScore += context.weight;
      }
    }
    
    // Calculate expense score
    for (const context of expenseContexts) {
      if (messageText.includes(context.phrase)) {
        expenseScore += context.weight;
      }
    }
    
    return { income: incomeScore, expense: expenseScore };
  }

  private calculatePromotionalScore(messageText: string): number {
    let score = 0;
    
    // Marketing calls-to-action (high weight)
    const marketingActions = ['dial', 'call', 'text', 'visit', 'download', 'click', 'whatsapp'];
    score += marketingActions.filter(action => messageText.includes(action)).length * 2;
    
    // Business/service promotion indicators
    const businessPromo = ['support you', 'help you', 'for your business', 'woman in business'];
    score += businessPromo.filter(phrase => messageText.includes(phrase)).length * 1.5;
    
    // Product/service offers
    const offerWords = ['free', 'bonus', 'enjoy', 'take advantage', 'insurance'];
    score += offerWords.filter(word => messageText.includes(word)).length;
    
    // Contact information presence (phone numbers, URLs)
    if (/\b0\d{9}\b/.test(messageText)) score += 1.5; // Ghana phone number
    if (/http[s]?:\/\//.test(messageText)) score += 1.5; // URL
    if (/#\d+#/.test(messageText)) score += 1; // USSD code
    
    // Assistance/help desk language
    if (messageText.includes('assistance') || messageText.includes('need help')) score += 1;
    
    return score;
  }

  private extractMerchant(message: string): string | undefined {
    // Enhanced patterns to extract merchant names - covers Ghana, Nigeria, South Africa formats
    const patterns = [
      // MOMO format: "Payment received for GHS 123.00 from CHRIS ADJEI DEBRAH"
      /(?:from|to)\s+([A-Z][A-Z\s]+?)(?:\s+current\s+balance|\s+transaction|\s*\.|$)/i,
      // Ghana specific: "Wallet to Bank Transfer for 233546945817"
      /(?:transfer for|to)\s+(\d{12})/i,
      // Nigeria format: "Transfer to JOHN DOE via NRB123456789"
      /(?:transfer to|payment to)\s+([A-Z][A-Z\s]+?)(?:\s+via|\s+using|\s*\.|$)/i,
      // Bank transfer formats
      /desc[:\s]*([^\n\r]+?)(?:\s+trans|\s+id|$)/i,
      /(?:beneficiary|recipient)[:\s]+([A-Z][A-Z0-9\s&.-]+?)(?:\s|$)/i,
      // POS and ATM formats
      /(?:at|@)\s+([A-Z][A-Z0-9\s&.-]+?)(?:\s+on|\s+dated|\s*\.|$)/i,
      // Standard patterns
      /(?:to|from)\s+([A-Z][A-Z0-9\s&.-]+?)(?:\s+on|\s+dated|\s*\.|$)/i,
      /(?:merchant|vendor|payee)[:\s]*([A-Z][A-Z0-9\s&.-]+?)(?:\s|$)/i,
      // Mobile money specific
      /(?:sent to|received from)\s+([A-Z][A-Z\s]+?)(?:\s+\d{10}|\s*\.|$)/i,
      // South African formats
      /(?:payment from|transfer from)\s+([A-Z][A-Z\s]+?)(?:\s+ref|\s*\.|$)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const merchant = match[1].trim();
        // Filter out common false positives
        if (this.isValidMerchantName(merchant)) {
          return merchant;
        }
      }
    }

    return undefined;
  }

  private isValidMerchantName(name: string): boolean {
    const lowerName = name.toLowerCase();
    
    // Filter out common false positives
    const invalidMerchants = [
      'current balance', 'available balance', 'transaction', 'trans id',
      'reference number', 'ref no', 'account', 'acct', 'balance',
      'successful', 'failed', 'completed', 'alert', 'notification',
      'bank', 'momo', 'mobile money', 'wallet', 'transfer', 'payment',
      'debit', 'credit', 'deposit', 'withdrawal', 'charge', 'fee'
    ];
    
    if (invalidMerchants.some(invalid => lowerName.includes(invalid))) {
      return false;
    }
    
    // Must be at least 2 characters and contain letters
    if (name.length < 2 || !/[a-zA-Z]/.test(name)) {
      return false;
    }
    
    // Filter out purely numeric values (likely account numbers)
    if (/^\d+$/.test(name)) {
      return false;
    }
    
    return true;
  }

  private identifyAccount(message: string, sender: string): Account | undefined {
    const messageText = message.toLowerCase();
    const senderText = sender.toLowerCase();
    
    // Enhanced bank/service identification patterns
    const bankIdentifiers = [
      // Ghana banks
      { keywords: ['gtbank', 'gt bank', 'guaranty trust'], accountTypes: ['savings', 'current', 'checking'] },
      { keywords: ['gcb-bank', 'gcb bank', 'ghana commercial'], accountTypes: ['savings', 'current'] },
      { keywords: ['uba-ghana', 'uba ghana', 'united bank'], accountTypes: ['savings', 'domiciliary'] },
      { keywords: ['absa-bank', 'absa ghana', 'barclays'], accountTypes: ['savings', 'current'] },
      { keywords: ['fidelity-bank', 'fidelity ghana'], accountTypes: ['savings', 'current'] },
      { keywords: ['cal-bank', 'cal bank'], accountTypes: ['savings', 'current'] },
      { keywords: ['ecobank-ghana', 'ecobank'], accountTypes: ['savings', 'current'] },
      { keywords: ['stanbic-bank', 'stanbic'], accountTypes: ['savings', 'current'] },
      { keywords: ['zenith-bank', 'zenith'], accountTypes: ['savings', 'current'] },
      { keywords: ['access-bank', 'access'], accountTypes: ['savings', 'current'] },
      
      // Mobile money
      { keywords: ['mtn-momo', 'mtn momo', 'mtn mobile'], accountTypes: ['momo wallet'] },
      { keywords: ['vodafone-cash', 'voda cash', 'vodafone'], accountTypes: ['mobile wallet'] },
      { keywords: ['airtel-money', 'airtel money'], accountTypes: ['mobile wallet'] },
      { keywords: ['tigo-cash', 'tigo cash'], accountTypes: ['mobile wallet'] },
      
      // Payment processors
      { keywords: ['zprompt', 'z prompt'], accountTypes: ['payment gateway'] },
      { keywords: ['hubtel', 'hbtl.co'], accountTypes: ['payment gateway'] },
      { keywords: ['expresspay'], accountTypes: ['payment gateway'] },
      
      // Nigeria banks
      { keywords: ['gtbank-ng', 'gtb nigeria'], accountTypes: ['savings', 'current'] },
      { keywords: ['zenith-ng', 'zenith nigeria'], accountTypes: ['savings', 'current'] },
      { keywords: ['uba-nigeria', 'uba ng'], accountTypes: ['savings', 'current'] },
      
      // South Africa banks
      { keywords: ['fnb', 'first national'], accountTypes: ['cheque', 'savings'] },
      { keywords: ['absa-sa', 'absa south africa'], accountTypes: ['cheque', 'savings'] },
      { keywords: ['standard bank', 'standardbank'], accountTypes: ['cheque', 'savings'] },
      { keywords: ['nedbank'], accountTypes: ['cheque', 'savings'] }
    ];
    
    // First try to match by sender with enhanced patterns
    let matchedAccount = this.accounts.find(account => 
      account.smsKeywords.some(keyword => {
        const keywordLower = keyword.toLowerCase();
        return senderText.includes(keywordLower) || 
               bankIdentifiers.some(bank => 
                 bank.keywords.some(bankKeyword => 
                   senderText.includes(bankKeyword) && keywordLower.includes(bankKeyword)
                 )
               );
      })
    );
    
    // Enhanced account number pattern matching
    if (!matchedAccount) {
      // Various account number formats
      const accountPatterns = [
        /acct[:\s]*(\d{4})\*+\d{2}/i,
        /account[:\s]*(\d{4})\*+\d{4}/i,
        /a\/c[:\s]*(\d{4})\*+\d{2}/i,
        /account ending in (\d{4})/i,
        /card ending (\d{4})/i
      ];
      
      for (const pattern of accountPatterns) {
        const accountMatch = messageText.match(pattern);
        if (accountMatch) {
          const accountSuffix = accountMatch[1];
          matchedAccount = this.accounts.find(account =>
            account.smsKeywords.some(keyword => {
              const keywordLower = keyword.toLowerCase();
              return keywordLower.includes(accountSuffix) || 
                     messageText.includes(keywordLower);
            })
          );
          
          if (matchedAccount) break;
        }
      }
    }
    
    // Fallback: match by service type if no direct account match
    if (!matchedAccount) {
      for (const bank of bankIdentifiers) {
        if (bank.keywords.some(keyword => senderText.includes(keyword))) {
          // Look for an account that might be associated with this bank
          matchedAccount = this.accounts.find(account =>
            account.smsKeywords.some(keyword =>
              bank.keywords.some(bankKeyword => 
                keyword.toLowerCase().includes(bankKeyword)
              )
            )
          );
          
          if (matchedAccount) break;
        }
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
        (id, amount, currency, description, category, type, source, date, account, merchant, isRecurring, createdAt, updatedAt)
        VALUES ('${id}', ${parsedTransaction.amount}, '${parsedTransaction.currency}', 
                '${parsedTransaction.description.replace(/'/g, "''")}', 
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

  // Comprehensive test method for enhanced multi-regional SMS parsing
  async testEnhancedParser(): Promise<void> {
    const testMessages = [
      // Ghana - legitimate transactions (should parse)
      {
        message: "GTBank Alert: Transaction successful. Amt: GHS150.00 debited from Acct: ****1234. Desc: POS Purchase at SHOPRITE. Current Balance: GHS1,250.45",
        sender: "GTBank",
        shouldParse: true,
        expectedCurrency: "GHS",
        region: "Ghana"
      },
      {
        message: "MTN MoMo: Payment received for GHS75.50 from CHRIS ADJEI DEBRAH. Current balance: GHS2,500.00. Trans ID: MOM240815.1234",
        sender: "MTN-MoMo",
        shouldParse: true,
        expectedCurrency: "GHS",
        region: "Ghana"
      },
      {
        message: "GCB-Bank: Loan of GHS5,000.00 was paid into your account ****5678. Loan facility approved. Available balance: GHS7,250.25",
        sender: "GCB-Bank",
        shouldParse: true,
        expectedCurrency: "GHS",
        expectedType: "income",
        region: "Ghana"
      },
      
      // Nigeria - legitimate transactions
      {
        message: "GTBank: NGN12,500.00 debited from account ****5678. Purchase at SHOPRITE LAGOS. Transaction ID: GTB123456789. Current balance: NGN45,230.80",
        sender: "GTBank-NG",
        shouldParse: true,
        expectedCurrency: "NGN",
        region: "Nigeria"
      },
      {
        message: "OPay: Payment received for NGN8,750 from ADEBAYO WILLIAMS via mobile transfer. Available balance: NGN125,400. Ref: OPY240815",
        sender: "OPay",
        shouldParse: true,
        expectedCurrency: "NGN",
        region: "Nigeria"
      },
      
      // South Africa - legitimate transactions
      {
        message: "FNB: R2,350.00 withdrawn from ATM at SANDTON CITY. Acct: ****9012. Available balance: R15,420.80",
        sender: "FNB",
        shouldParse: true,
        expectedCurrency: "ZAR",
        region: "South Africa"
      },
      
      // Kenya - legitimate transactions
      {
        message: "M-Pesa: KES3,500.00 sent to MARY WANJIKU. Transaction cost KES25.00. New M-Pesa balance is KES12,450.00. Transaction ID: OGH2K4L5M",
        sender: "M-PESA",
        shouldParse: true,
        expectedCurrency: "KES",
        region: "Kenya"
      },
      
      // International currencies
      {
        message: "Chase Bank: $125.99 debited from account ****1234. Purchase at AMAZON.COM. Transaction ID: AMZ123456789. Current balance: $2,534.56",
        sender: "Chase",
        shouldParse: true,
        expectedCurrency: "USD",
        region: "USA"
      },
      {
        message: "Transaction successful. Amt: €89.50 credited to your account. Description: Salary payment from TECH COMPANY. Available balance: €5,750.25",
        sender: "Deutsche-Bank",
        shouldParse: true,
        expectedCurrency: "EUR",
        region: "Germany"
      },
      {
        message: "Barclays: £67.99 debited from account ****5678. Purchase at TESCO LONDON. Transaction ID: TES123456789. Current balance: £1,234.56",
        sender: "Barclays",
        shouldParse: true,
        expectedCurrency: "GBP",
        region: "UK"
      },
      
      // Promotional messages that should be rejected
      {
        message: "Get up to 20% cashback on your next purchase! Use your GTBank card at participating merchants. Terms and conditions apply. Visit gtbank.com for details.",
        sender: "GTBank",
        shouldParse: false,
        region: "Ghana"
      },
      {
        message: "Special offer! Earn $50 bonus when you spend $100 or more this weekend. Don't miss out on this exclusive deal. Reply STOP to opt out.",
        sender: "USABank-Promo",
        shouldParse: false,
        region: "USA"
      },
      {
        message: "OPay Nigeria: Enjoy free transfers up to NGN1,000 this weekend! Download our app and take advantage of this amazing offer. T&C apply.",
        sender: "OPay-Marketing",
        shouldParse: false,
        region: "Nigeria"
      },
      {
        message: "FNB: Win R10,000 in our monthly prize draw! Just spend R500 or more at any participating retailer. Visit fnb.co.za for terms.",
        sender: "FNB-Contest",
        shouldParse: false,
        region: "South Africa"
      },
      
      // Loan context analysis tests
      {
        message: "Fidelity Bank: Loan repayment of GHS850.00 debited from account ****3456. Monthly installment successful. Remaining balance: GHS12,150.00",
        sender: "Fidelity-Bank",
        shouldParse: true,
        expectedCurrency: "GHS",
        expectedType: "expense",
        region: "Ghana"
      },
      {
        message: "Access Bank: Personal loan of NGN250,000.00 disbursed to account ****7890. Loan facility activated. Available balance: NGN275,400.00",
        sender: "Access-Bank",
        shouldParse: true,
        expectedCurrency: "NGN",
        expectedType: "income",
        region: "Nigeria"
      }
    ];

    console.log('\n=== ENHANCED MULTI-REGIONAL SMS PARSER TEST RESULTS ===\n');

    let correctCount = 0;
    let totalCount = testMessages.length;

    for (let i = 0; i < testMessages.length; i++) {
      const test = testMessages[i];
      console.log(`Test ${i + 1} (${test.region}): ${test.shouldParse ? 'VALID TRANSACTION' : 'PROMOTIONAL MESSAGE'}`);
      console.log(`Sender: ${test.sender}`);
      console.log(`Message: ${test.message.substring(0, 100)}...`);
      
      try {
        const result = await this.parseMessage(test.message, test.sender, new Date());
        const parsed = result !== null;
        
        console.log(`Expected: ${test.shouldParse ? 'PARSE' : 'REJECT'}`);
        console.log(`Actual: ${parsed ? 'PARSED' : 'REJECTED'}`);
        
        const isCorrect = parsed === test.shouldParse;
        if (isCorrect) correctCount++;
        
        console.log(`Result: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`);
        
        if (result) {
          console.log(`  Amount: ${result.currency} ${result.amount}`);
          console.log(`  Currency: ${result.currency}`);
          console.log(`  Type: ${result.type}`);
          console.log(`  Category: ${result.category}`);
          console.log(`  Merchant: ${result.merchant || 'N/A'}`);
          
          // Check if currency detection is correct for legitimate transactions
          if (test.shouldParse && test.expectedCurrency && result.currency !== test.expectedCurrency) {
            console.log(`  ⚠️  Currency mismatch: Expected ${test.expectedCurrency}, got ${result.currency}`);
          }
          
          // Check transaction type for loan tests
          if (test.expectedType && result.type !== test.expectedType) {
            console.log(`  ⚠️  Type mismatch: Expected ${test.expectedType}, got ${result.type}`);
          }
        }
        
      } catch (error) {
        console.log(`Error: ${error}`);
      }
      
      console.log('---\n');
    }
    
    const accuracy = (correctCount / totalCount * 100).toFixed(1);
    console.log(`=== TEST SUMMARY ===`);
    console.log(`Total Tests: ${totalCount}`);
    console.log(`Correct: ${correctCount}`);
    console.log(`Accuracy: ${accuracy}%`);
    console.log('=== ENHANCED MULTI-REGIONAL TEST COMPLETE ===\n');
  }
}

export const smsParserService = new SMSParserService();

// Export additional utilities for external usage
export type { SMSRule } from '../database/schema';