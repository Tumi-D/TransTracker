import { Platform, PermissionsAndroid } from 'react-native';
import { SMSMessage } from './smsListener';

// Try to import the SMS module, but handle cases where it's not available
let SmsAndroid: any = null;
try {
  SmsAndroid = require('react-native-get-sms-android');
} catch (error) {
  console.log('react-native-get-sms-android not available:', error);
}

export interface NativeSMSReader {
  hasPermission(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  getSMSHistory(fromDate: Date, toDate: Date): Promise<SMSMessage[]>;
}

class AndroidSMSReader implements NativeSMSReader {
  async hasPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    
    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_SMS
      );
      return granted;
    } catch (error) {
      console.error('Error checking SMS permission:', error);
      return false;
    }
  }

  async requestPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: 'SMS Permission',
          message: 'This app needs access to SMS messages to automatically track your transactions',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('Error requesting SMS permission:', error);
      return false;
    }
  }

  async getSMSHistory(fromDate: Date, toDate: Date): Promise<SMSMessage[]> {
    console.log(`Attempting to get SMS history from ${fromDate.toISOString()} to ${toDate.toISOString()}`);
    
    // Check if we're on Android and have the SMS module
    if (Platform.OS !== 'android') {
      console.log('SMS reading not available on iOS - using fallback data');
      return this.getFallbackMockData(fromDate, toDate);
    }
    
    if (!SmsAndroid) {
      console.log('react-native-get-sms-android module not available - using fallback data');
      console.log('To enable real SMS reading, you need to:');
      console.log('1. Run: npx expo run:android');
      console.log('2. Or eject from managed Expo workflow');
      return this.getFallbackMockData(fromDate, toDate);
    }

    try {
      return new Promise((resolve) => {
        // Filter criteria for financial SMS
        const filter = {
          box: 'inbox',
          minDate: fromDate.getTime(),
          maxDate: toDate.getTime(),
          maxCount: 100,
        };

        console.log('Attempting to read SMS with native module...');

        SmsAndroid.list(
          JSON.stringify(filter),
          (fail: any) => {
            console.error('SMS module failed:', fail);
            console.log('Falling back to mock data due to SMS reading failure');
            resolve(this.getFallbackMockData(fromDate, toDate));
          },
          (count: number, smsList: string) => {
            try {
              console.log(`✅ Successfully retrieved ${count} SMS messages from phone!`);
              
              if (count === 0) {
                console.log('No SMS found in date range, using minimal fallback');
                resolve(this.getFallbackMockData(fromDate, toDate));
                return;
              }
              
              const parsedSMS = JSON.parse(smsList);
              console.log('Sample SMS structure:', {
                address: parsedSMS[0]?.address,
                bodyPreview: parsedSMS[0]?.body?.substring(0, 50) + '...',
                date: new Date(parseInt(parsedSMS[0]?.date)).toISOString()
              });
              
              // Convert to our format
              const messages: SMSMessage[] = parsedSMS.map((sms: any) => ({
                id: sms._id?.toString() || `real_${Date.now()}_${Math.random()}`,
                address: sms.address || 'Unknown',
                body: sms.body || '',
                date: parseInt(sms.date) || Date.now(),
                read: sms.read === 1 || sms.read === '1'
              }));

              // Filter for financial messages
              const financialMessages = this.filterFinancialMessages(messages);
              
              console.log(`✅ Found ${financialMessages.length} REAL financial SMS messages!`);
              
              if (financialMessages.length > 0) {
                console.log('Real SMS sample:', financialMessages[0].body.substring(0, 80) + '...');
              }
              
              resolve(financialMessages.length > 0 ? financialMessages : this.getFallbackMockData(fromDate, toDate));
              
            } catch (error) {
              console.error('Error processing SMS data:', error);
              resolve(this.getFallbackMockData(fromDate, toDate));
            }
          }
        );
      });
    } catch (error) {
      console.error('SMS reading error:', error);
      return this.getFallbackMockData(fromDate, toDate);
    }
  }

  private filterFinancialMessages(messages: SMSMessage[]): SMSMessage[] {
    return messages.filter(sms => {
      const bodyLower = sms.body.toLowerCase();
      const addressLower = sms.address.toLowerCase();
      
      // Financial keywords
      const financialKeywords = [
        'debit', 'credit', 'payment', 'transaction', 'balance', 'withdraw',
        'deposit', 'transfer', 'purchase', 'spent', 'charged', 'refund',
        'salary', 'atm', 'pos', 'momo', 'mobile money', 'wallet',
        'bank', 'account', 'card', 'cedis', 'ghs', '$', '₵', 'sent you'
      ];
      
      // Financial senders
      const financialSenders = [
        'bank', 'momo', 'gtbank', 'gcb', 'uba', 'absa',
        'fidelity', 'cal', 'ecobank', 'stanbic', 'vodafone', 'mtn',
        'airtel', 'hubtel', 'zenith', 'access'
      ];
      
      const hasFinancialKeyword = financialKeywords.some(keyword => 
        bodyLower.includes(keyword)
      );
      
      const hasFinancialSender = financialSenders.some(sender => 
        addressLower.includes(sender)
      );
      
      return hasFinancialKeyword || hasFinancialSender;
    });
  }

  private getFallbackMockData(fromDate: Date, toDate: Date): SMSMessage[] {
    console.log('📱 Using demonstration SMS data (not real SMS from your phone)');
    console.log('🔧 To read your actual SMS messages, you need to:');
    console.log('   1. Build the app with: npx expo run:android');
    console.log('   2. Grant SMS permissions when prompted');
    console.log('   3. The app will then read your real financial SMS messages');
    
    // Generate realistic demo messages within date range
    const now = new Date().getTime();
    const demoSMSData: SMSMessage[] = [
      {
        id: `demo_${Date.now()}_1`,
        address: 'GCB-BANK',
        body: '🏦 DEMO: GHS 250.00 has been debited from your account ending 1234 at SHOPRITE. Available balance: GHS 3,750.00.',
        date: now - (1000 * 60 * 60 * 3), // 3 hours ago
        read: true
      },
      {
        id: `demo_${Date.now()}_2`,
        address: 'MOMO',
        body: '💰 DEMO: Payment received for GHS 100.00 from JANE SMITH. Current Balance: GHS 650.00. Reference: 4321.',
        date: now - (1000 * 60 * 60 * 8), // 8 hours ago
        read: true
      },
      {
        id: `demo_${Date.now()}_3`,
        address: 'HUBTEL',
        body: '📲 DEMO: KWAME ASANTE 233244567890 has sent you GHS 50.00 via https://hbtl.co/app with a Note: Thank you.',
        date: now - (1000 * 60 * 60 * 12), // 12 hours ago
        read: true
      }
    ];

    // Filter messages within date range
    const filteredMessages = demoSMSData.filter(sms => {
      return sms.date >= fromDate.getTime() && sms.date <= toDate.getTime();
    });

    console.log(`📋 Generated ${filteredMessages.length} demo financial SMS messages for testing`);
    return filteredMessages;
  }
}

class IOSSMSReader implements NativeSMSReader {
  async hasPermission(): Promise<boolean> {
    // iOS doesn't allow third-party apps to read SMS messages
    return false;
  }

  async requestPermission(): Promise<boolean> {
    // iOS doesn't allow third-party apps to read SMS messages
    return false;
  }

  async getSMSHistory(fromDate: Date, toDate: Date): Promise<SMSMessage[]> {
    // iOS doesn't allow third-party apps to read SMS messages
    return [];
  }
}

// Factory function to get the appropriate SMS reader for the platform
export const createSMSReader = (): NativeSMSReader => {
  if (Platform.OS === 'android') {
    return new AndroidSMSReader();
  } else {
    return new IOSSMSReader();
  }
};

export const nativeSMSReader = createSMSReader();