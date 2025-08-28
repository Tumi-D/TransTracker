# Budget Tracker - Code Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Services](#services)
5. [Database Schema](#database-schema)
6. [SMS Processing](#sms-processing)
7. [UI Components](#ui-components)
8. [Data Flow](#data-flow)
9. [Deployment](#deployment)

---

## Overview

Budget Tracker is a React Native + Expo application that automatically tracks financial transactions by parsing SMS messages and emails. It provides intelligent categorization, duplicate detection, budget management, and real-time financial monitoring.

### Key Features
- **Automatic SMS Transaction Parsing** - Reads financial SMS messages from banks and mobile money services
- **Gmail Integration** - Processes financial emails for transaction extraction
- **Intelligent Categorization** - Auto-categorizes transactions using keyword matching
- **Duplicate Detection** - Smart removal of duplicate transactions within time windows
- **Budget Management** - Track spending against category budgets with alerts
- **Real-time Monitoring** - Background processing of new transactions

### Tech Stack
- **Frontend**: React Native 0.79.6, Expo 53.0.22
- **Database**: SQLite (expo-sqlite)
- **SMS Reading**: react-native-get-sms-android
- **Notifications**: expo-notifications
- **Storage**: AsyncStorage

---

## Architecture

```
BudgetTracker/
├── src/
│   ├── components/          # UI Components
│   ├── services/           # Business Logic Services
│   ├── database/           # Database Schema & Operations
│   ├── context/           # React Context Providers
│   └── types/             # TypeScript Interfaces
├── android/               # Android Native Code
├── ios/                  # iOS Native Code (limited SMS support)
└── assets/               # Static Assets
```

### Core Architecture Patterns

**1. Service Layer Pattern**
- Services handle business logic and data processing
- Database operations abstracted through service layer
- Clear separation between UI and business logic

**2. Context Pattern**
- App-wide state management using React Context
- Centralized data refresh and state updates

**3. Observer Pattern**
- SMS and Email monitoring services run in background
- Automatic processing and notification on new data

---

## Core Components

### App.tsx
Main application entry point with initialization and error handling.

```typescript
export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const initializeApp = async () => {
    // Initialize database
    await databaseService.init();
    
    // Start SMS listening
    await smsListenerService.startListening();
  };
}
```

**Key Responsibilities:**
- Database initialization
- Service startup coordination
- Error boundary and loading states
- App-wide styling and layout

### AddTransactionModal.tsx
Floating Action Button menu system and modal dialogs.

**Features:**
- Collapsible FAB menu with 5 action buttons
- Manual transaction entry
- SMS history processing
- Gmail sync management
- Demo data clearing
- Duplicate transaction removal

**FAB Menu Structure:**
```typescript
// FAB positions (bottom to top)
- 25px:  ➕ Add Transaction
- 75px:  🔍 Remove Duplicates (Orange)
- 125px: 🗑️ Clear Demo (Red)
- 150px: 📱 Test SMS
- 200px: 📋 SMS History
- 250px: 📧 Gmail Sync
```

### BudgetOverview.tsx
Dashboard displaying budget status and financial summaries.

**Features:**
- Real-time budget calculations
- Progress indicators
- Spending alerts
- Category-wise breakdowns

### TransactionList.tsx
Scrollable list of transactions with filtering and search.

**Features:**
- Infinite scroll/pagination
- Transaction detail modals
- Type and category filtering
- Date range selection
- Real-time updates

---

## Services

### SMS Listener Service (`smsListener.ts`)

**Purpose:** Monitors and processes SMS messages for financial transactions.

```typescript
export class SMSListenerService {
  private isListening: boolean = false;
  private lastProcessedSMSId: string | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  async startListening(): Promise<boolean>
  async processSMSHistory(): Promise<{processed: number, errors: number}>
  private async processSMS(sms: SMSMessage): Promise<void>
}
```

**Key Methods:**
- `startListening()` - Starts periodic SMS monitoring (30-second intervals)
- `processSMSHistory()` - Processes SMS from last 30 days on startup
- `getProcessingStats()` - Returns SMS processing statistics
- `processTestSMS()` - Manual SMS testing for development

**SMS Processing Flow:**
1. Check SMS permissions
2. Retrieve recent SMS (5-minute window for periodic, 30-day for history)
3. Filter for financial keywords/senders
4. Parse with SMS Parser Service
5. Save to database and send notifications
6. Update budgets if applicable

### SMS Parser Service (`smsParser.ts`)

**Purpose:** Intelligent parsing and categorization of SMS messages.

```typescript
export class SMSParserService {
  private categories: Category[] = [];
  private accounts: Account[] = [];
  private smsRules: SMSRule[] = [];

  async parseMessage(message: string, sender: string, date: Date): Promise<ParsedTransaction | null>
  private extractAmount(text: string): number
  private determineTransactionType(message: string): 'income' | 'expense'
  private categorizeTransaction(message: string, merchant?: string, type?: string): Category
}
```

**Parsing Logic:**

**1. Amount Extraction Patterns:**
```typescript
const patterns = [
  /(?:payment\s+(?:received|sent)\s+for\s+|received\s+for\s+)ghs\s*([\d,]+(?:\.\d{2})?)/i, // MOMO
  /amt[:\s]*ghs\s*([\d,]+(?:\.\d{2})?)/i, // Bank format
  /(?:ghs\.?\s*|₵\s*)([\d,]+(?:\.\d{2})?)/i, // General GHS
];
```

**2. Transaction Type Detection:**
```typescript
const strongIncomeKeywords = [
  'payment received', 'money received', 'received for', 'credited',
  'has sent you', 'sent you', 'salary', 'refund'
];

const strongExpenseKeywords = [
  'payment sent', 'money sent', 'debited', 'withdraw', 'spent',
  'charged', 'purchase'
];
```

**3. Category Matching:**
- Keyword-based scoring system
- Weighted scoring for longer, more specific keywords
- Special handling for MOMO/mobile money transactions
- Fallback to appropriate default categories

### Email Services

#### Gmail Service (`gmailService.ts`)
**Purpose:** OAuth authentication and email retrieval from Gmail.

```typescript
export class GmailService {
  private tokens: GmailAuthTokens | null = null;

  async authenticate(): Promise<boolean>
  async getFinancialEmails(maxResults?: number): Promise<{messages: GmailMessage[]}>
  async disconnect(): Promise<void>
}
```

**Current Implementation:**
- Mock authentication for development
- Financial email filtering by sender and subject
- OAuth token management
- Ready for production Gmail API integration

#### Email Parser (`emailParser.ts`)
**Purpose:** Extract transaction data from email content.

```typescript
export class EmailParserService {
  async parseEmail(email: GmailMessage): Promise<ParsedTransaction | null>
  private extractAmountFromEmail(body: string): number
  private determineEmailTransactionType(subject: string, body: string): 'income' | 'expense'
}
```

#### Email Monitor Service (`emailMonitorService.ts`)
**Purpose:** Background email monitoring and processing.

```typescript
export class EmailMonitorService {
  async connectGmail(): Promise<boolean>
  async startMonitoring(): Promise<void>
  private async syncRecentEmails(): Promise<void>
}
```

**Features:**
- 5-minute sync intervals
- Duplicate email prevention
- Background processing
- Integration with notification system

### Native SMS Reader (`nativeSMSReader.ts`)

**Purpose:** Platform-specific SMS reading implementation.

```typescript
export interface NativeSMSReader {
  hasPermission(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  getSMSHistory(fromDate: Date, toDate: Date): Promise<SMSMessage[]>;
}
```

**Implementations:**
- `AndroidSMSReader` - Uses react-native-get-sms-android
- `IOSSMSReader` - Limited support (iOS restrictions)

**Android SMS Reading:**
```typescript
// Real SMS reading with filtering
const filter = {
  box: 'inbox',
  minDate: fromDate.getTime(),
  maxDate: toDate.getTime(),
  maxCount: 100,
};

SmsAndroid.list(JSON.stringify(filter), failCallback, successCallback);
```

**Fallback System:**
- Graceful degradation when SMS module unavailable
- Demo data generation for testing
- Clear user instructions for enabling real SMS reading

---

## Database Schema

### Core Tables

#### Transactions Table
```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,              -- Unique transaction ID
  amount REAL NOT NULL,             -- Transaction amount
  description TEXT NOT NULL,        -- Full description/memo
  category TEXT NOT NULL,           -- Category name
  type TEXT CHECK (type IN ('income', 'expense')), -- Transaction type
  source TEXT CHECK (source IN ('sms', 'manual')), -- Data source
  date TEXT NOT NULL,               -- ISO date string
  account TEXT,                     -- Account name (optional)
  merchant TEXT,                    -- Merchant/recipient (optional)
  isRecurring INTEGER DEFAULT 0,    -- Recurring flag
  createdAt TEXT NOT NULL,          -- Creation timestamp
  updatedAt TEXT NOT NULL           -- Last update timestamp
);
```

#### Categories Table
```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY,              -- Unique category ID
  name TEXT NOT NULL,               -- Display name
  type TEXT CHECK (type IN ('income', 'expense')), -- Category type
  color TEXT NOT NULL,              -- Hex color code
  icon TEXT NOT NULL,               -- Icon identifier
  keywords TEXT NOT NULL,           -- JSON array of matching keywords
  createdAt TEXT NOT NULL           -- Creation timestamp
);
```

#### Budgets Table
```sql
CREATE TABLE budgets (
  id TEXT PRIMARY KEY,              -- Unique budget ID
  name TEXT NOT NULL,               -- Budget name
  category TEXT NOT NULL,           -- Associated category
  amount REAL NOT NULL,             -- Budget limit
  spent REAL DEFAULT 0,             -- Current spending
  period TEXT CHECK (period IN ('weekly', 'monthly', 'yearly')), -- Budget period
  startDate TEXT NOT NULL,          -- Period start date
  endDate TEXT NOT NULL,            -- Period end date
  isActive INTEGER DEFAULT 1,       -- Active flag
  createdAt TEXT NOT NULL,          -- Creation timestamp
  updatedAt TEXT NOT NULL           -- Last update timestamp
);
```

#### Processed SMS Table
```sql
CREATE TABLE processed_sms (
  id TEXT PRIMARY KEY,              -- Unique record ID
  smsId TEXT UNIQUE NOT NULL,       -- Original SMS message ID
  sender TEXT NOT NULL,             -- SMS sender
  body TEXT NOT NULL,               -- SMS content
  date TEXT NOT NULL,               -- SMS date
  transactionId TEXT,               -- Created transaction ID (optional)
  isProcessed INTEGER DEFAULT 1,    -- Processing status
  createdAt TEXT NOT NULL           -- Processing timestamp
);
```

### Default Categories

The system includes 12 pre-configured categories optimized for Ghana financial patterns:

**Expense Categories:**
- Food & Dining (restaurant, food, dining, cafe, pizza, kfc, chop bar)
- Transportation (fuel, petrol, uber, taxi, bus, trotro, transport, goil, shell)
- Shopping (shopping, store, purchase, market, mall, shoprite)
- Bills & Utilities (electric, water, internet, phone, utility, bill, ecg, vodafone, mtn)
- Healthcare (hospital, pharmacy, doctor, medical, health, clinic)
- Entertainment (movie, entertainment, game, concert, cinema)
- Transfers (transfer, wallet, bank transfer, mobile money, momo)
- Other Expense (misc, other, miscellaneous)

**Income Categories:**
- Salary (salary, wage, payroll, income, pay)
- Transfers (transfer, wallet to bank, mobile money, momo, received)
- Investment (dividend, interest, investment, profit, return)
- Other Income (bonus, gift, refund, cashback)

### Database Service Methods

#### Core Operations
```typescript
class DatabaseService {
  async init(): Promise<void>                    // Initialize database and tables
  async getDatabase(): Promise<SQLiteDatabase>   // Get database instance
  
  // Data Management
  async clearDemoTransactions(): Promise<number>        // Remove demo/test data
  async removeDuplicateTransactions(): Promise<number>  // Smart duplicate removal
  async cleanupDuplicateCategories(): Promise<void>    // Remove duplicate categories
}
```

#### Duplicate Detection Logic

**Detection Criteria:**
- Same amount, type, and category
- Within 1-minute time window
- Additional similarity checks:
  - Same merchant extraction
  - Same account number pattern
  - Similar SMS formatting patterns

**Similarity Scoring:**
```typescript
private isDuplicateTransaction(dup: any): boolean {
  const similarityChecks = [
    this.extractMerchantFromDescription(desc1) === this.extractMerchantFromDescription(desc2),
    this.haveSimilarSMSPatterns(desc1, desc2),
    this.extractAccountFromDescription(desc1) === this.extractAccountFromDescription(desc2)
  ];
  
  // Requires 2 of 3 checks to pass
  return similarityChecks.filter(Boolean).length >= 2;
}
```

---

## SMS Processing

### Supported SMS Formats

#### Ghana Banking SMS Formats

**1. Standard Bank Debit:**
```
Dear Customer, GHS 500.00 has been debited from your account ending 1234 at SHOPRITE. Available balance: GHS 2,500.00.
```

**2. ZPrompt Format:**
```
ZPrompt Acct: 4010****58 Date: 2025-08-27 Desc: Wallet to Bank Transfer for 233546945817 Trans Id: 63801273704 Amt: GHS1,000.00 Branch: H/O Curr.Avail.Bal: GHS1,050.40 Type: Credit
```

**3. MOMO Payment Received:**
```
Payment received for GHS 123.00 from CHRIS ADJEI DEBRAH Current Balance: GHS 301.16. Available Balance: GHS 301.16. Reference: 1234.
```

**4. Hubtel Transfer:**
```
CHRIS ADJEI DEBRAH 233546945817 has sent you GHS 2.00 via https://hbtl.co/app with a Note: Coins
```

### Financial SMS Detection

**Trusted Senders:**
```typescript
const financialSenders = [
  'bank', 'momo', 'gtbank', 'gcb', 'uba', 'absa',
  'fidelity', 'cal', 'ecobank', 'stanbic', 'vodafone', 'mtn',
  'airtel', 'hubtel', 'zenith', 'access'
];
```

**Financial Keywords:**
```typescript
const financialKeywords = [
  'debit', 'credit', 'payment', 'transaction', 'balance', 'withdraw',
  'deposit', 'transfer', 'purchase', 'spent', 'charged', 'refund',
  'salary', 'atm', 'pos', 'momo', 'mobile money', 'wallet',
  'bank', 'account', 'card', 'cedis', 'ghs', '$', '₵', 'sent you'
];
```

### Processing Pipeline

**1. SMS Retrieval**
```typescript
// Periodic check (every 30 seconds)
const fiveMinutesAgo = new Date(Date.now() - (5 * 60 * 1000));
const recentSMS = await nativeSMSReader.getSMSHistory(fiveMinutesAgo, new Date());

// History processing (on startup)
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
const historySMS = await nativeSMSReader.getSMSHistory(thirtyDaysAgo, new Date());
```

**2. Duplicate Prevention**
```typescript
// Check if SMS already processed
const existing = await db.getFirstAsync(
  'SELECT id FROM processed_sms WHERE smsId = ?',
  [sms.id]
);

if (existing) return false; // Skip already processed
```

**3. Transaction Creation**
```typescript
const parsedTransaction = await smsParserService.parseMessage(
  sms.body,
  sms.address,
  new Date(sms.date)
);

if (parsedTransaction) {
  const transactionId = await smsParserService.saveTransaction(parsedTransaction);
  await this.notifyUser(parsedTransaction, transactionId);
  await this.updateBudgets(parsedTransaction);
}
```

**4. Budget Updates**
```typescript
// Find active budgets for category
const budgets = await db.getAllAsync(
  'SELECT * FROM budgets WHERE category = ? AND isActive = 1 AND date(?) BETWEEN startDate AND endDate',
  [transaction.category, transaction.date.split('T')[0]]
);

// Update spent amounts and send alerts
for (const budget of budgets) {
  const newSpent = budget.spent + transaction.amount;
  if (newSpent > budget.amount) {
    await this.sendBudgetAlert(budget, newSpent);
  }
}
```

---

## UI Components

### Component Hierarchy

```
App
├── AppProvider (Context)
│   ├── BudgetOverview
│   │   ├── BudgetCard[]
│   │   └── QuickStats
│   ├── TransactionList
│   │   ├── TransactionItem[]
│   │   ├── TransactionDetailModal
│   │   └── FilterControls
│   └── AddTransactionModal
│       ├── FABMenu
│       ├── TransactionForm
│       ├── SMSHistoryModal
│       ├── GmailSyncModal
│       └── TestSMSModal
```

### Key UI Patterns

#### Floating Action Button System
```typescript
const fabPositions = {
  gmail: 250,      // 📧 Gmail Sync
  history: 200,    // 📋 SMS History  
  test: 150,       // 📱 Test SMS
  clear: 125,      // 🗑️ Clear Demo
  duplicates: 75,  // 🔍 Remove Duplicates
  add: 25          // ➕ Add Transaction
};
```

#### Modal Management
```typescript
const [modalVisible, setModalVisible] = useState(false);
const [testModalVisible, setTestModalVisible] = useState(false);
const [historyModalVisible, setHistoryModalVisible] = useState(false);
const [gmailModalVisible, setGmailModalVisible] = useState(false);
```

#### Context-Based State Management
```typescript
export const AppProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  
  const refreshData = async () => {
    // Reload all app data
  };
  
  return (
    <AppContext.Provider value={{ transactions, budgets, refreshData }}>
      {children}
    </AppContext.Provider>
  );
};
```

### Styling Architecture

#### Color Palette
```typescript
const colors = {
  primary: '#3498db',      // Main blue
  secondary: '#2c3e50',    // Dark gray
  success: '#27AE60',      // Green (income)
  warning: '#f39c12',      // Orange (duplicates)
  danger: '#e74c3c',       // Red (clear demo)
  light: '#ecf0f1',        // Light gray
  dark: '#34495e'          // Dark text
};
```

#### Component Styling Patterns
- **Consistent spacing**: 8px, 16px, 24px increments
- **Border radius**: 8px for cards, 24px/28px for FABs
- **Elevation/Shadow**: Consistent shadow patterns for cards and FABs
- **Typography**: Clear hierarchy with font weights 400, 600, bold

---

## Data Flow

### Transaction Processing Flow

```
SMS Received
    ↓
Permission Check
    ↓
Financial SMS Filter
    ↓
Duplicate Check (processed_sms table)
    ↓
SMS Parser Service
    ↓
Amount Extraction → Transaction Type → Merchant → Category
    ↓
Save to Database
    ↓
Update Budgets → Send Notifications
    ↓
Refresh UI Context
```

### User Action Flow

```
User Interaction (FAB Menu)
    ↓
Action Selection (Add/History/Clear/etc.)
    ↓
Confirmation Dialog (if destructive)
    ↓
Service Method Execution
    ↓
Database Operations
    ↓
Result Notification
    ↓
Context Refresh
    ↓
UI Update
```

### Background Processing Flow

```
App Startup
    ↓
Database Initialization
    ↓
SMS History Processing (30 days)
    ↓
Periodic SMS Monitoring (30s intervals)
    ↓
Email Monitoring (5min intervals)
    ↓
Real-time Processing & Notifications
```

---

## Deployment

### Development Build

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on Android (with native modules)
npx expo run:android

# Run on iOS
npx expo run:ios
```

### Production Considerations

#### SMS Permissions
- Android: Requires `READ_SMS` permission
- iOS: Not supported due to platform restrictions
- Fallback: Manual transaction entry always available

#### Gmail Integration
- Requires Google Cloud Console setup
- OAuth 2.0 client configuration
- Production API key management

#### Database
- SQLite migrations for schema updates
- Backup and restore functionality
- Performance optimization for large datasets

#### Security
- No sensitive data logging
- Secure token storage
- Permission handling best practices

### Build Configuration

#### Android
```javascript
// app.json
{
  "expo": {
    "android": {
      "permissions": [
        "android.permission.READ_SMS",
        "android.permission.RECEIVE_SMS"
      ]
    }
  }
}
```

#### Dependencies
```json
{
  "expo": "~53.0.22",
  "react-native": "0.79.6",
  "expo-sqlite": "^15.2.14",
  "expo-notifications": "^0.31.4",
  "react-native-get-sms-android": "^2.1.0"
}
```

---

## Testing

### Manual Testing Scenarios

1. **SMS Processing**
   - Test various SMS formats
   - Verify duplicate detection
   - Check categorization accuracy

2. **Data Management**
   - Clear demo transactions
   - Remove duplicates
   - Budget calculations

3. **UI Interactions**
   - FAB menu functionality
   - Modal workflows
   - Form validation

### Development Tools
- SMS testing modal for simulating messages
- Demo data for UI testing
- Processing statistics for monitoring
- Detailed console logging

---

This documentation provides a comprehensive overview of the Budget Tracker codebase. For specific implementation details, refer to the source code files and inline comments.