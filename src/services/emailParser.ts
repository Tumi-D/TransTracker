import { Transaction, Category, Account, databaseService } from '../database/schema';
import { smsParserService, ParsedTransaction } from './smsParser';
import { GmailMessage } from './gmailService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ParsedEmail {
  emailId: string;
  from: string;
  subject: string;
  body: string;
  date: string;
  transactionId?: string;
  isProcessed: boolean;
  createdAt: string;
}

export class EmailParserService {
  private categories: Category[] = [];
  private accounts: Account[] = [];

  constructor() {
    this.initializeParser();
  }

  private async initializeParser() {
    try {
      // Ensure database is initialized first
      await databaseService.init();
      await this.loadCategories();
      await this.loadAccounts();
    } catch (error) {
      console.error('Error initializing email parser:', error);
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

  async parseEmail(email: GmailMessage): Promise<ParsedTransaction | null> {
    console.log('=== EMAIL PARSING START ===');
    console.log('From:', email.from);
    console.log('Subject:', email.subject);
    console.log('Body preview:', email.body.substring(0, 200));

    // Ensure categories are loaded
    if (!this.categories || this.categories.length === 0) {
      await this.loadCategories();
    }

    // Check if this is a financial email
    if (!this.isFinancialEmail(email)) {
      console.log('Not a financial email');
      console.log('=== EMAIL PARSING END (Not Financial) ===');
      return null;
    }

    // Extract transaction data from email
    const amount = this.extractAmountFromEmail(email);
    if (amount === 0) {
      console.log('No amount found in email');
      console.log('=== EMAIL PARSING END (No Amount) ===');
      return null;
    }

    const type = this.determineTransactionType(email);
    const merchant = this.extractMerchantFromEmail(email);
    const account = this.identifyAccountFromEmail(email);
    const category = this.categorizeEmailTransaction(email, merchant, type);
    const description = this.createDescriptionFromEmail(email);

    const result: ParsedTransaction = {
      amount,
      description,
      merchant,
      account: account?.name,
      type,
      category: category.name,
      date: email.date.toISOString(),
      rawMessage: `${email.subject}\n\n${email.body}`,
    };

    console.log('Parsed email transaction:', result);
    console.log('=== EMAIL PARSING END ===');
    return result;
  }

  private isFinancialEmail(email: GmailMessage): boolean {
    const subject = email.subject.toLowerCase();
    const body = email.body.toLowerCase();
    const from = email.from.toLowerCase();

    // Financial keywords in subject or body
    const financialKeywords = [
      'payment', 'transaction', 'receipt', 'invoice', 'bill', 'statement',
      'debit', 'credit', 'transfer', 'deposit', 'withdrawal', 'balance',
      'purchase', 'refund', 'charge', 'fee', 'salary', 'payroll',
      'ghs', 'cedis', '$', '₵', 'amount', 'total', 'paid', 'received'
    ];

    // Trusted financial senders
    const financialSenders = [
      'bank', 'payment', 'paypal', 'stripe', 'visa', 'mastercard',
      'gcb', 'gtbank', 'uba', 'absa', 'fidelity', 'cal', 'ecobank',
      'stanbic', 'momo', 'mobile money', 'airtel', 'vodafone', 'mtn',
      'amazon', 'uber', 'bolt', 'jumia', 'shoprite', 'bills'
    ];

    const hasFinancialKeywords = financialKeywords.some(keyword => 
      subject.includes(keyword) || body.includes(keyword)
    );

    const isFromFinancialSender = financialSenders.some(sender =>
      from.includes(sender)
    );

    return hasFinancialKeywords || isFromFinancialSender;
  }

  private extractAmountFromEmail(email: GmailMessage): number {
    const text = `${email.subject} ${email.body}`;
    
    // Enhanced patterns for email amounts
    const patterns = [
      // Ghana formats: GHS 1,000.00, GHS1000, ₵ 500.00
      /(?:ghs|cedis)\s*[:\s]*₵?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
      /₵\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
      
      // Common email formats
      /amount[:\s]*(?:ghs|₵)?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
      /total[:\s]*(?:ghs|₵)?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
      /paid[:\s]*(?:ghs|₵)?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
      /received[:\s]*(?:ghs|₵)?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
      /charged[:\s]*(?:ghs|₵)?\s*([0-9,]+(?:\.[0-9]{2})?)/gi,
      
      // PayPal/Stripe formats
      /\$([0-9,]+(?:\.[0-9]{2})?)/g,
      
      // Generic number extraction (last resort)
      /([0-9,]+\.[0-9]{2})/g
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const amountStr = match[1].replace(/,/g, '');
        const amount = parseFloat(amountStr);
        
        if (!isNaN(amount) && amount > 0 && amount < 1000000) { // Reasonable amount range
          console.log(`Extracted amount: ${amount} from pattern: ${pattern}`);
          return amount;
        }
      }
    }

    return 0;
  }

  private determineTransactionType(email: GmailMessage): 'income' | 'expense' {
    const text = `${email.subject} ${email.body}`.toLowerCase();

    const incomeKeywords = [
      'received', 'credited', 'deposit', 'refund', 'cashback', 'salary',
      'payment received', 'money received', 'transfer received',
      'bonus', 'dividend', 'interest', 'payout', 'reimbursement'
    ];

    const expenseKeywords = [
      'paid', 'charged', 'debited', 'purchase', 'bill', 'invoice',
      'payment sent', 'money sent', 'transfer sent', 'withdrawal',
      'subscription', 'fee', 'penalty', 'fine'
    ];

    const incomeScore = incomeKeywords.reduce((score, keyword) =>
      text.includes(keyword) ? score + 1 : score, 0
    );
    
    const expenseScore = expenseKeywords.reduce((score, keyword) =>
      text.includes(keyword) ? score + 1 : score, 0
    );

    return incomeScore > expenseScore ? 'income' : 'expense';
  }

  private extractMerchantFromEmail(email: GmailMessage): string | undefined {
    const subject = email.subject;
    const body = email.body;

    // Patterns to extract merchant from email
    const patterns = [
      // "Payment to MERCHANT_NAME"
      /(?:payment\s+to|paid\s+to|sent\s+to)\s+([A-Z][A-Za-z0-9\s&.-]+?)(?:\s|$|\.)/gi,
      
      // "Purchase from MERCHANT_NAME"
      /(?:purchase\s+from|bought\s+from|order\s+from)\s+([A-Z][A-Za-z0-9\s&.-]+?)(?:\s|$|\.)/gi,
      
      // "Transaction at MERCHANT_NAME"
      /(?:transaction\s+at|purchase\s+at|payment\s+at)\s+([A-Z][A-Za-z0-9\s&.-]+?)(?:\s|$|\.)/gi,
      
      // Email subject patterns
      /^([A-Z][A-Za-z0-9\s&.-]+?)\s+(?:receipt|invoice|payment|transaction)/gi,
      
      // From field extraction (remove email domain)
      /^([^@\s]+)(?:@|$)/gi,
    ];

    // Try to extract from subject first
    for (const pattern of patterns) {
      const match = subject.match(pattern);
      if (match && match[1]) {
        return match[1].trim().substring(0, 50); // Limit length
      }
    }

    // Try to extract from body
    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match && match[1]) {
        return match[1].trim().substring(0, 50);
      }
    }

    // Fallback: extract from sender email
    const senderMatch = email.from.match(/^([^@<\s]+)/);
    if (senderMatch) {
      return senderMatch[1].trim().substring(0, 50);
    }

    return undefined;
  }

  private identifyAccountFromEmail(email: GmailMessage): Account | undefined {
    const text = `${email.from} ${email.subject} ${email.body}`.toLowerCase();

    return this.accounts.find(account =>
      account.smsKeywords.some(keyword =>
        text.includes(keyword.toLowerCase())
      )
    );
  }

  private categorizeEmailTransaction(email: GmailMessage, merchant: string | undefined, type: 'income' | 'expense'): Category {
    const text = `${email.subject} ${email.body} ${merchant || ''}`.toLowerCase();

    // Ensure categories are loaded
    if (!this.categories || this.categories.length === 0) {
      return this.getDefaultCategory(type);
    }

    // Find the best matching category
    const relevantCategories = this.categories.filter(c => c && c.type === type);
    let bestMatch: Category | undefined;
    let bestScore = 0;

    for (const category of relevantCategories) {
      if (!category || !category.keywords) continue;

      let score = 0;
      for (const keyword of category.keywords) {
        if (text.includes(keyword.toLowerCase())) {
          score++;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = category;
      }
    }

    return bestMatch || this.getDefaultCategory(type);
  }

  private getDefaultCategory(type: 'income' | 'expense'): Category {
    const defaultCategory = this.categories.find(c =>
      c && c.name === (type === 'income' ? 'Other Income' : 'Other Expense')
    ) || this.categories.find(c => c && c.type === type);

    if (defaultCategory) return defaultCategory;

    // Final fallback
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

  private createDescriptionFromEmail(email: GmailMessage): string {
    // Create a clean description from email subject and key body content
    let description = email.subject;

    // If subject is too generic, try to extract from body
    if (description.length < 10 || /^(receipt|invoice|transaction|payment)$/i.test(description)) {
      const bodyLines = email.body.split('\n').filter(line => line.trim().length > 0);
      const meaningfulLine = bodyLines.find(line => 
        line.length > 10 && line.length < 100 && !line.includes('@')
      );
      if (meaningfulLine) {
        description = meaningfulLine.trim();
      }
    }

    // Clean up the description
    return description
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 200); // Limit length
  }

  async saveEmailTransaction(email: GmailMessage, parsedTransaction: ParsedTransaction): Promise<string> {
    const db = await databaseService.getDatabase();
    if (!db) throw new Error('Database not available');

    // Save the transaction
    const transactionId = await smsParserService.saveTransaction(parsedTransaction);

    // Record processed email
    const emailRecordId = `email_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO processed_sms 
       (id, smsId, sender, body, date, transactionId, isProcessed, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [emailRecordId, email.id, email.from, email.subject, email.date.toISOString(), transactionId, now]
    );

    console.log('Email transaction saved:', transactionId);
    return transactionId;
  }

  async isEmailProcessed(emailId: string): Promise<boolean> {
    try {
      const db = await databaseService.getDatabase();
      if (!db) return false;

      const result = await db.getFirstAsync(
        'SELECT id FROM processed_sms WHERE smsId = ?',
        [emailId]
      );

      return !!result;
    } catch (error) {
      console.error('Error checking if email is processed:', error);
      return false;
    }
  }
}

export const emailParserService = new EmailParserService();