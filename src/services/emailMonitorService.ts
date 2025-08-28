import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gmailService, GmailMessage } from './gmailService';
import { emailParserService } from './emailParser';
import { smsListenerService } from './smsListener'; // For notifications

export interface EmailMonitorStats {
  totalProcessed: number;
  transactionsCreated: number;
  lastSyncDate: string | null;
  isConnected: boolean;
}

export class EmailMonitorService {
  private isMonitoring: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private appStateSubscription: any = null;
  private lastSyncTime: Date | null = null;

  constructor() {
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    // Load last sync time
    const lastSync = await AsyncStorage.getItem('email_last_sync');
    if (lastSync) {
      this.lastSyncTime = new Date(lastSync);
    }

    // Setup app state listener
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  async startMonitoring(): Promise<boolean> {
    try {
      // Check Gmail authentication
      const isAuthenticated = await gmailService.isAuthenticated();
      if (!isAuthenticated) {
        console.warn('Gmail not authenticated - email monitoring disabled');
        return false;
      }

      this.isMonitoring = true;
      console.log('Email monitoring started');

      // Initial sync
      await this.syncEmails();

      // Start periodic sync (every 5 minutes when app is active)
      this.startPeriodicSync();

      return true;
    } catch (error) {
      console.error('Failed to start email monitoring:', error);
      return false;
    }
  }

  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Sync every 5 minutes when app is active
    this.syncInterval = setInterval(() => {
      if (AppState.currentState === 'active' && this.isMonitoring) {
        this.syncEmails();
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  async syncEmails(): Promise<{
    processed: number;
    transactionsCreated: number;
    errors: number;
  }> {
    try {
      console.log('Starting email sync...');

      // Determine sync period
      const now = new Date();
      const syncSince = this.lastSyncTime || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      console.log(`Syncing emails since: ${syncSince.toISOString()}`);

      let processed = 0;
      let transactionsCreated = 0;
      let errors = 0;
      let nextPageToken: string | undefined;
      
      do {
        const result = await gmailService.getFinancialEmails(50, nextPageToken);
        
        for (const email of result.messages) {
          try {
            // Skip if email is older than our sync window
            if (email.date < syncSince) {
              continue;
            }

            // Skip if already processed
            if (await emailParserService.isEmailProcessed(email.id)) {
              processed++;
              continue;
            }

            // Parse email for transaction data
            const parsedTransaction = await emailParserService.parseEmail(email);
            
            if (parsedTransaction) {
              // Save the transaction
              const transactionId = await emailParserService.saveEmailTransaction(email, parsedTransaction);
              
              // Send notification to user
              await this.notifyUserOfEmailTransaction(email, parsedTransaction, transactionId);
              
              transactionsCreated++;
              console.log(`Email transaction created: ${transactionId}`);
            }
            
            processed++;
          } catch (error) {
            console.error(`Error processing email ${email.id}:`, error);
            errors++;
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        nextPageToken = result.nextPageToken;
        
      } while (nextPageToken && processed < 200); // Limit to prevent excessive API calls

      // Update last sync time
      this.lastSyncTime = now;
      await AsyncStorage.setItem('email_last_sync', now.toISOString());

      console.log(`Email sync complete. Processed: ${processed}, Transactions: ${transactionsCreated}, Errors: ${errors}`);
      
      return { processed, transactionsCreated, errors };
    } catch (error) {
      console.error('Email sync failed:', error);
      return { processed: 0, transactionsCreated: 0, errors: 1 };
    }
  }

  private async notifyUserOfEmailTransaction(
    email: GmailMessage, 
    transaction: any, 
    transactionId: string
  ): Promise<void> {
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
        title: `📧 ${title}`,
        body: `${body}\nFrom email: ${email.from}`,
        data: { 
          transactionId, 
          type: 'email_transaction',
          emailId: email.id 
        },
      },
      trigger: null,
    });
  }

  async connectGmail(): Promise<boolean> {
    try {
      const success = await gmailService.authenticate();
      if (success) {
        // Start monitoring after successful connection
        await this.startMonitoring();
        
        // Show success notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '📧 Gmail Connected',
            body: 'Your email transactions will now be automatically tracked!',
          },
          trigger: null,
        });
      }
      return success;
    } catch (error) {
      console.error('Gmail connection failed:', error);
      return false;
    }
  }

  async disconnectGmail(): Promise<void> {
    try {
      await gmailService.disconnect();
      this.stopMonitoring();
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📧 Gmail Disconnected',
          body: 'Email transaction tracking has been disabled.',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Gmail disconnection failed:', error);
    }
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    console.log('Email monitoring stopped');
  }

  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'active' && this.isMonitoring) {
      // App became active, sync emails
      this.syncEmails();
      this.startPeriodicSync();
    } else if (nextAppState.match(/inactive|background/)) {
      // App went to background, stop periodic sync
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
    }
  }

  async getMonitoringStats(): Promise<EmailMonitorStats> {
    try {
      const isConnected = await gmailService.isAuthenticated();
      const lastSyncDate = await AsyncStorage.getItem('email_last_sync');
      
      // Get stats from database
      const stats = await smsListenerService.getProcessingStats(); // Reuse SMS stats structure
      
      return {
        totalProcessed: stats.totalProcessed,
        transactionsCreated: stats.transactionsCreated,
        lastSyncDate,
        isConnected,
      };
    } catch (error) {
      console.error('Error getting monitoring stats:', error);
      return {
        totalProcessed: 0,
        transactionsCreated: 0,
        lastSyncDate: null,
        isConnected: false,
      };
    }
  }

  getStatus(): { 
    isMonitoring: boolean; 
    lastSyncTime: Date | null;
    isConnected: boolean;
  } {
    return {
      isMonitoring: this.isMonitoring,
      lastSyncTime: this.lastSyncTime,
      isConnected: gmailService.isAuthenticated !== undefined,
    };
  }

  // Manual sync trigger
  async manualSync(): Promise<{
    processed: number;
    transactionsCreated: number;
    errors: number;
  }> {
    console.log('Manual email sync triggered');
    return await this.syncEmails();
  }

  // Cleanup
  destroy(): void {
    this.stopMonitoring();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
  }
}

export const emailMonitorService = new EmailMonitorService();