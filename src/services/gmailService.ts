import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  body: string;
  date: Date;
  snippet: string;
}

export interface GmailAuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export class GmailService {
  private static readonly CLIENT_ID = ''; // Will be set up later in Google Console
  private static readonly SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify'
  ];
  private static readonly REDIRECT_URI = 'budgettracker://oauth/callback';

  private tokens: GmailAuthTokens | null = null;

  constructor() {
    this.loadStoredTokens();
  }

  private async loadStoredTokens(): Promise<void> {
    try {
      const storedTokens = await AsyncStorage.getItem('gmail_tokens');
      if (storedTokens) {
        this.tokens = JSON.parse(storedTokens);
      }
    } catch (error) {
      console.error('Failed to load stored Gmail tokens:', error);
    }
  }

  private async storeTokens(tokens: GmailAuthTokens): Promise<void> {
    try {
      this.tokens = tokens;
      await AsyncStorage.setItem('gmail_tokens', JSON.stringify(tokens));
    } catch (error) {
      console.error('Failed to store Gmail tokens:', error);
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      // For now, return a mock successful authentication
      // In production, this would open a WebView for OAuth
      console.log('Gmail authentication - using mock authentication for development');
      
      // Mock tokens for development
      const mockTokens: GmailAuthTokens = {
        access_token: 'mock_access_token',
        refresh_token: 'mock_refresh_token',
        expires_at: Date.now() + (3600 * 1000), // 1 hour from now
      };
      
      await this.storeTokens(mockTokens);
      return true;
    } catch (error) {
      console.error('Gmail authentication failed:', error);
      return false;
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<GmailAuthTokens> {
    // Mock token exchange for development
    console.log('Mock token exchange for code:', code);
    return {
      access_token: 'mock_access_token_' + Date.now(),
      refresh_token: 'mock_refresh_token_' + Date.now(),
      expires_at: Date.now() + (3600 * 1000),
    };
  }

  async isAuthenticated(): Promise<boolean> {
    // For development, always return true if we have mock tokens
    if (!this.tokens) return false;
    return true;
  }

  private async refreshAccessToken(): Promise<boolean> {
    // Mock token refresh for development
    if (!this.tokens?.refresh_token) return false;
    
    console.log('Mock token refresh');
    const newTokens: GmailAuthTokens = {
      access_token: 'refreshed_mock_token_' + Date.now(),
      refresh_token: this.tokens.refresh_token,
      expires_at: Date.now() + (3600 * 1000),
    };
    
    await this.storeTokens(newTokens);
    return true;
  }

  private async makeGmailRequest(endpoint: string, params?: Record<string, string>): Promise<any> {
    if (!await this.isAuthenticated()) {
      throw new Error('Not authenticated with Gmail');
    }

    // For development, return mock data instead of actual API calls
    console.log(`Mock Gmail API call: ${endpoint}`, params);
    
    if (endpoint === 'messages') {
      return this.getMockEmailMessages();
    }
    
    if (endpoint.startsWith('messages/')) {
      const messageId = endpoint.split('/')[1];
      return this.getMockMessageDetails(messageId);
    }

    return { messages: [] };
  }

  async getFinancialEmails(maxResults: number = 50, pageToken?: string): Promise<{
    messages: GmailMessage[];
    nextPageToken?: string;
  }> {
    try {
      // Search query for financial emails
      const query = [
        'from:(bank OR payment OR paypal OR stripe OR visa OR mastercard)',
        'OR from:(gcb OR gtbank OR uba OR absa OR fidelity OR cal OR ecobank OR stanbic)',
        'OR subject:(transaction OR payment OR transfer OR debit OR credit OR receipt)',
        'OR subject:(invoice OR bill OR statement OR balance)',
        '-(from:noreply@github.com OR from:notifications@slack.com)'
      ].join(' ');

      const params: Record<string, string> = {
        q: query,
        maxResults: maxResults.toString(),
      };

      if (pageToken) {
        params.pageToken = pageToken;
      }

      const result = await this.makeGmailRequest('messages', params);
      
      if (!result.messages || result.messages.length === 0) {
        return { messages: [] };
      }

      // Get full message details for each message
      const messages = await Promise.all(
        result.messages.map((msg: any) => this.getMessageDetails(msg.id))
      );

      return {
        messages: messages.filter(msg => msg !== null) as GmailMessage[],
        nextPageToken: result.nextPageToken,
      };
    } catch (error) {
      console.error('Failed to get financial emails:', error);
      return { messages: [] };
    }
  }

  private async getMessageDetails(messageId: string): Promise<GmailMessage | null> {
    try {
      const message = await this.makeGmailRequest(`messages/${messageId}`, {
        format: 'full'
      });

      const headers = message.payload.headers;
      const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || '';
      const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '';
      const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value || '';

      const body = this.extractBodyFromPayload(message.payload);

      return {
        id: message.id,
        threadId: message.threadId,
        from: fromHeader,
        subject: subjectHeader,
        body: body,
        date: new Date(dateHeader || message.internalDate),
        snippet: message.snippet || '',
      };
    } catch (error) {
      console.error(`Failed to get message details for ${messageId}:`, error);
      return null;
    }
  }

  private extractBodyFromPayload(payload: any): string {
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
        
        if (part.mimeType === 'text/html' && part.body?.data) {
          const html = Buffer.from(part.body.data, 'base64').toString('utf-8');
          // Basic HTML to text conversion (you might want to use a proper library)
          return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        // Recursively check nested parts
        const nestedBody = this.extractBodyFromPayload(part);
        if (nestedBody) return nestedBody;
      }
    }

    return '';
  }

  async disconnect(): Promise<void> {
    try {
      if (this.tokens?.access_token) {
        // Revoke the token
        await fetch(`https://oauth2.googleapis.com/revoke?token=${this.tokens.access_token}`, {
          method: 'POST',
        });
      }
    } catch (error) {
      console.error('Failed to revoke Gmail token:', error);
    } finally {
      this.tokens = null;
      await AsyncStorage.removeItem('gmail_tokens');
    }
  }

  private getMockEmailMessages(): any {
    return {
      messages: [
        { id: 'msg1', threadId: 'thread1' },
        { id: 'msg2', threadId: 'thread2' },
        { id: 'msg3', threadId: 'thread3' },
      ],
      nextPageToken: undefined
    };
  }

  private getMockMessageDetails(messageId: string): any {
    const mockMessages: { [key: string]: any } = {
      'msg1': {
        id: 'msg1',
        threadId: 'thread1',
        payload: {
          headers: [
            { name: 'From', value: 'GCB Bank <noreply@gcbbank.com.gh>' },
            { name: 'Subject', value: 'Transaction Alert - Account Debit' },
            { name: 'Date', value: new Date().toISOString() }
          ],
          body: {
            data: Buffer.from('Dear Customer, GHS 500.00 has been debited from your account ending 1234 at SHOPRITE on ' + new Date().toDateString() + '. Available balance: GHS 2,500.00. Thank you for banking with GCB.').toString('base64')
          }
        },
        snippet: 'Dear Customer, GHS 500.00 has been debited from your account...',
        internalDate: Date.now().toString()
      },
      'msg2': {
        id: 'msg2',
        threadId: 'thread2',
        payload: {
          headers: [
            { name: 'From', value: 'PayPal <service@paypal.com>' },
            { name: 'Subject', value: 'You sent a payment of $25.00 USD' },
            { name: 'Date', value: new Date(Date.now() - 60000).toISOString() }
          ],
          body: {
            data: Buffer.from('You sent a payment of $25.00 USD to Amazon.com. Transaction ID: 12345-ABCDE. Your PayPal balance is $150.00 USD.').toString('base64')
          }
        },
        snippet: 'You sent a payment of $25.00 USD to Amazon.com...',
        internalDate: (Date.now() - 60000).toString()
      },
      'msg3': {
        id: 'msg3',
        threadId: 'thread3',
        payload: {
          headers: [
            { name: 'From', value: 'GTBank <alerts@gtbank.com.gh>' },
            { name: 'Subject', value: 'Credit Transaction Notification' },
            { name: 'Date', value: new Date(Date.now() - 120000).toISOString() }
          ],
          body: {
            data: Buffer.from('Dear Valued Customer, Your account has been credited with GHS 3,000.00 being salary payment from ABC COMPANY LTD on ' + new Date().toDateString() + '. Your account balance is GHS 8,500.00.').toString('base64')
          }
        },
        snippet: 'Your account has been credited with GHS 3,000.00...',
        internalDate: (Date.now() - 120000).toString()
      }
    };

    return mockMessages[messageId] || mockMessages['msg1'];
  }
}

export const gmailService = new GmailService();