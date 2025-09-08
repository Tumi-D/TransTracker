import * as SMS from 'expo-sms';
import * as Notifications from 'expo-notifications';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { smsParserService, ParsedTransaction } from './smsParser';
import { databaseService, ProcessedSMS } from '../database/schema';
import { nativeSMSReader } from './nativeSMSReader';

export interface SMSMessage {
  id: string;
  address: string;
  body: string;
  date: number;
  read: boolean;
}

export class SMSListenerService {
  private isListening: boolean = false;
  private lastProcessedSMSId: string | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private appStateSubscription: any = null;
  private hasLoggedPermissionWarning: boolean = false;

  constructor() {
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    // Load last processed SMS ID
    this.lastProcessedSMSId = await AsyncStorage.getItem('lastProcessedSMSId');
    
    // Setup app state listener
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );

    // Setup notification handling
    this.setupNotifications();
  }

  private async setupNotifications(): Promise<void> {
    // Request notification permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    // Configure notification behavior
    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }

  async startListening(): Promise<boolean> {
    try {
      // Check if SMS permissions are available (Android only)
      if (!SMS.isAvailableAsync()) {
        console.warn('SMS functionality not available on this platform');
        return false;
      }

      // For SMS reading, we need to implement a polling mechanism
      // since React Native doesn't have real-time SMS listeners
      this.isListening = true;
      this.startPeriodicCheck();
      
      // Process SMS history on startup (async, don't wait)
      setTimeout(() => {
        this.processSMSHistoryOnStartup();
      }, 2000); // Wait 2 seconds for app to fully initialize
      
      console.log('SMS listening started');
      return true;
    } catch (error) {
      console.error('Failed to start SMS listening:', error);
      return false;
    }
  }

  private startPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Check for new SMS every 30 seconds when app is active
    this.checkInterval = setInterval(() => {
      if (AppState.currentState === 'active') {
        this.checkForNewSMS();
      }
    }, 30000);
  }

  private async checkForNewSMS(): Promise<void> {
    try {
      // Note: This is a simplified version. In a real implementation,
      // you would use native modules to access SMS messages
      // For now, we'll simulate this functionality
      
      const recentSMS = await this.getRecentSMS();
      
      for (const sms of recentSMS) {
        if (await this.shouldProcessSMS(sms)) {
          await this.processSMS(sms);
        }
      }
    } catch (error) {
      console.error('Error checking for new SMS:', error);
    }
  }

  private async getRecentSMS(): Promise<SMSMessage[]> {
    try {
      // Check if we have SMS permission
      const hasPermission = await nativeSMSReader.hasPermission();
      if (!hasPermission) {
        // Only log this once per session to avoid spam
        if (!this.hasLoggedPermissionWarning) {
          console.warn('No SMS permission available - SMS auto-processing disabled');
          this.hasLoggedPermissionWarning = true;
        }
        return [];
      }

      // Get SMS from last 5 minutes for periodic checks
      const fiveMinutesAgo = new Date(Date.now() - (5 * 60 * 1000));
      const now = new Date();
      
      return await nativeSMSReader.getSMSHistory(fiveMinutesAgo, now);
    } catch (error) {
      console.error('Error getting recent SMS:', error);
      return [];
    }
  }

  private async shouldProcessSMS(sms: SMSMessage): Promise<boolean> {
    try {
      // Check if SMS already processed in database
      const db = await databaseService.getDatabase();
      if (!db) return false;

      const existing = await db.getFirstAsync(
        'SELECT id FROM processed_sms WHERE smsId = ?',
        [sms.id]
      );
      
      if (existing) {
        return false; // Already processed
      }

      // For periodic checks, only process recent messages (last 5 minutes)
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      return sms.date >= fiveMinutesAgo;
    } catch (error) {
      console.error('Error checking if SMS should be processed:', error);
      return false;
    }
  }

  private async processSMS(sms: SMSMessage): Promise<void> {
    try {
      // Record this SMS as processed to prevent duplicates
      await this.recordProcessedSMS(sms, null);

      const parsedTransaction = await smsParserService.parseMessage(
        sms.body,
        sms.address,
        new Date(sms.date)
      );

      if (parsedTransaction) {
        // Save the transaction
        const transactionId = await smsParserService.saveTransaction(parsedTransaction);
        
        // Update the processed SMS record with transaction ID
        await this.updateProcessedSMS(sms.id, transactionId);
        
        // Update last processed SMS ID
        this.lastProcessedSMSId = sms.id;
        await AsyncStorage.setItem('lastProcessedSMSId', sms.id);

        // Send notification to user
        await this.notifyUser(parsedTransaction, transactionId);

        // Update budgets if applicable
        await this.updateBudgets(parsedTransaction);

        console.log('Transaction processed successfully:', transactionId);
      }
    } catch (error) {
      console.error('Error processing SMS:', error);
    }
  }

  private async notifyUser(transaction: ParsedTransaction, transactionId: string): Promise<void> {
    const title = transaction.type === 'income' ? 'Money Received' : 'Money Spent';
    const emoji = transaction.type === 'income' ? '💰' : '💸';
    const amount = `₵${transaction.amount.toLocaleString()}`;
    
    let body = `${emoji} ${amount}`;
    if (transaction.merchant) {
      body += ` at ${transaction.merchant}`;
    }
    body += ` (${transaction.category})`;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { transactionId, type: 'transaction' },
      },
      trigger: null, // Show immediately
    });
  }

  private async updateBudgets(transaction: ParsedTransaction): Promise<void> {
    if (transaction.type !== 'expense') return;

    const db = await databaseService.getDatabase();
    if (!db) return;

    try {
      // Find active budgets for this category
      const budgets = await db.getAllAsync(
        'SELECT * FROM budgets WHERE category = ? AND isActive = 1 AND date(?) BETWEEN startDate AND endDate',
        [transaction.category, transaction.date.split('T')[0]]
      );

      // Update spent amounts
      for (const budget of budgets as any[]) {
        const newSpent = budget.spent + transaction.amount;
        await db.runAsync(
          'UPDATE budgets SET spent = ?, updatedAt = ? WHERE id = ?',
          [newSpent, new Date().toISOString(), budget.id]
        );

        // Check if budget is exceeded
        if (newSpent > budget.amount) {
          await this.sendBudgetAlert(budget, newSpent);
        } else if (newSpent / budget.amount >= 0.8) {
          await this.sendBudgetWarning(budget, newSpent);
        }
      }
    } catch (error) {
      console.error('Error updating budgets:', error);
    }
  }

  private async sendBudgetAlert(budget: any, spent: number): Promise<void> {
    const overspent = spent - budget.amount;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 Budget Exceeded',
        body: `You've overspent on ${budget.name} by ₵${overspent.toLocaleString()}`,
        data: { budgetId: budget.id, type: 'budget_alert' },
      },
      trigger: null,
    });
  }

  private async sendBudgetWarning(budget: any, spent: number): Promise<void> {
    const percentage = Math.round((spent / budget.amount) * 100);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ Budget Warning',
        body: `You've used ${percentage}% of your ${budget.name} budget`,
        data: { budgetId: budget.id, type: 'budget_warning' },
      },
      trigger: null,
    });
  }

  stopListening(): void {
    this.isListening = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('SMS listening stopped');
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'active' && this.isListening) {
      // App became active, check for missed SMS
      this.checkForNewSMS();
      this.startPeriodicCheck();
    } else if (nextAppState.match(/inactive|background/)) {
      // App went to background, stop periodic checking
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
    }
  }

  // Helper methods for SMS duplicate prevention
  private async recordProcessedSMS(sms: SMSMessage, transactionId: string | null): Promise<void> {
    try {
      const db = await databaseService.getDatabase();
      if (!db) return;

      const id = `psms_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();

      await db.runAsync(
        `INSERT OR REPLACE INTO processed_sms 
         (id, smsId, sender, body, date, transactionId, isProcessed, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [id, sms.id, sms.address, sms.body, new Date(sms.date).toISOString(), transactionId, now]
      );
    } catch (error) {
      console.error('Error recording processed SMS:', error);
    }
  }

  private async updateProcessedSMS(smsId: string, transactionId: string): Promise<void> {
    try {
      const db = await databaseService.getDatabase();
      if (!db) return;

      await db.runAsync(
        'UPDATE processed_sms SET transactionId = ? WHERE smsId = ?',
        [transactionId, smsId]
      );
    } catch (error) {
      console.error('Error updating processed SMS:', error);
    }
  }

  // Process SMS history on app startup (silent)
  private async processSMSHistoryOnStartup(): Promise<void> {
    try {
      console.log('🔍 Checking for SMS history on startup...');
      const result = await this.processSMSHistory();
      if (result.processed > 0) {
        console.log(`✅ Automatically processed ${result.processed} SMS transactions from history`);
      } else {
        console.log('📱 No new SMS transactions found in history');
      }
    } catch (error) {
      console.log('ℹ️  SMS history processing skipped:', error.message);
    }
  }

  // Method to process SMS history (3 months back)
  async processSMSHistory(): Promise<{ processed: number; errors: number }> {
    try {
      // Check SMS permission first
      console.log('Checking SMS permissions...');
      const hasPermission = await nativeSMSReader.hasPermission();
      console.log('SMS permission status:', hasPermission);
      
      if (!hasPermission) {
        console.log('Requesting SMS permissions from user...');
        const granted = await nativeSMSReader.requestPermission();
        console.log('SMS permission granted:', granted);
        
        if (!granted) {
          throw new Error('SMS permission not granted by user');
        }
      }

      // Get SMS from last 3 months (90 days)
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);
      const now = new Date();

      console.log('Fetching SMS history from:', threeMonthsAgo.toISOString());
      const smsHistory = await nativeSMSReader.getSMSHistory(threeMonthsAgo, now);
      
      let processed = 0;
      let errors = 0;

      // Process in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < smsHistory.length; i += batchSize) {
        const batch = smsHistory.slice(i, i + batchSize);
        
        for (const sms of batch) {
          try {
            // Check if already processed
            if (!(await this.shouldProcessSMSHistory(sms))) {
              continue;
            }

            await this.processSMS(sms);
            processed++;
          } catch (error) {
            console.error(`Error processing SMS ${sms.id}:`, error);
            errors++;
          }
        }

        // Small delay between batches to prevent overwhelming
        if (i + batchSize < smsHistory.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`SMS history processing complete. Processed: ${processed}, Errors: ${errors}`);
      return { processed, errors };
    } catch (error) {
      console.error('Error processing SMS history:', error);
      throw error;
    }
  }

  private async shouldProcessSMSHistory(sms: SMSMessage): Promise<boolean> {
    try {
      // Check if SMS already processed in database
      const db = await databaseService.getDatabase();
      if (!db) return false;

      const existing = await db.getFirstAsync(
        'SELECT id FROM processed_sms WHERE smsId = ?',
        [sms.id]
      );
      
      return !existing; // Process if not already in database
    } catch (error) {
      console.error('Error checking SMS history processing status:', error);
      return false;
    }
  }

  // Method to manually process a test SMS (for development/testing)
  async processTestSMS(message: string, sender: string = 'TEST-BANK'): Promise<string | null> {
    try {
      const parsedTransaction = await smsParserService.parseMessage(
        message,
        sender,
        new Date()
      );

      if (parsedTransaction) {
        const transactionId = await smsParserService.saveTransaction(parsedTransaction);
        await this.notifyUser(parsedTransaction, transactionId);
        await this.updateBudgets(parsedTransaction);
        return transactionId;
      }

      return null;
    } catch (error) {
      console.error('Error processing test SMS:', error);
      throw error;
    }
  }

  // Get SMS processing statistics
  async getProcessingStats(): Promise<{
    totalProcessed: number;
    transactionsCreated: number;
    lastProcessedDate: string | null;
  }> {
    try {
      const db = await databaseService.getDatabase();
      if (!db) return { totalProcessed: 0, transactionsCreated: 0, lastProcessedDate: null };

      const totalResult = await db.getFirstAsync(
        'SELECT COUNT(*) as count FROM processed_sms'
      ) as { count: number };

      const transactionsResult = await db.getFirstAsync(
        'SELECT COUNT(*) as count FROM processed_sms WHERE transactionId IS NOT NULL'
      ) as { count: number };

      const lastProcessedResult = await db.getFirstAsync(
        'SELECT MAX(date) as lastDate FROM processed_sms'
      ) as { lastDate: string | null };

      return {
        totalProcessed: totalResult.count,
        transactionsCreated: transactionsResult.count,
        lastProcessedDate: lastProcessedResult.lastDate
      };
    } catch (error) {
      console.error('Error getting processing stats:', error);
      return { totalProcessed: 0, transactionsCreated: 0, lastProcessedDate: null };
    }
  }

  // Get listening status
  getStatus(): { isListening: boolean; lastProcessedId: string | null } {
    return {
      isListening: this.isListening,
      lastProcessedId: this.lastProcessedSMSId
    };
  }

  // Cleanup
  destroy(): void {
    this.stopListening();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
  }
}

export const smsListenerService = new SMSListenerService();