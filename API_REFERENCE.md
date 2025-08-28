# Budget Tracker API Reference

## Database Service (`databaseService`)

### Initialization
```typescript
await databaseService.init(): Promise<void>
```
Initializes the SQLite database, creates tables, and inserts default categories.

### Transaction Management
```typescript
await databaseService.clearDemoTransactions(): Promise<number>
```
Removes all demo/mock transactions while preserving real SMS data.
- **Returns**: Number of transactions deleted

```typescript
await databaseService.removeDuplicateTransactions(): Promise<number>
```
Intelligently removes duplicate transactions using multi-criteria analysis.
- **Returns**: Number of duplicate transactions removed

### Database Access
```typescript
await databaseService.getDatabase(): Promise<SQLiteDatabase | null>
```
Returns the initialized SQLite database instance.

---

## SMS Listener Service (`smsListenerService`)

### Core Methods
```typescript
await smsListenerService.startListening(): Promise<boolean>
```
Starts SMS monitoring with periodic checks every 30 seconds.
- **Returns**: Success status

```typescript
await smsListenerService.processSMSHistory(): Promise<{processed: number, errors: number}>
```
Processes SMS history from the last 30 days.
- **Returns**: Processing statistics

```typescript
await smsListenerService.processTestSMS(message: string, sender?: string): Promise<string | null>
```
Manually processes a test SMS message for development.
- **Parameters**: 
  - `message`: SMS content to parse
  - `sender`: SMS sender (optional, defaults to 'TEST-BANK')
- **Returns**: Created transaction ID or null

### Status and Statistics
```typescript
smsListenerService.getStatus(): {isListening: boolean, lastProcessedId: string | null}
```
Returns current SMS listening status.

```typescript
await smsListenerService.getProcessingStats(): Promise<{
  totalProcessed: number,
  transactionsCreated: number,
  lastProcessedDate: string | null
}>
```
Returns SMS processing statistics.

### Lifecycle
```typescript
smsListenerService.stopListening(): void
```
Stops SMS monitoring and clears intervals.

```typescript
smsListenerService.destroy(): void
```
Cleanup method for removing listeners and stopping monitoring.

---

## SMS Parser Service (`smsParserService`)

### Core Parsing
```typescript
await smsParserService.parseMessage(
  message: string, 
  sender: string, 
  date: Date
): Promise<ParsedTransaction | null>
```
Parses SMS message and extracts transaction data.
- **Parameters**:
  - `message`: SMS content
  - `sender`: SMS sender address
  - `date`: SMS timestamp
- **Returns**: Parsed transaction object or null if not financial

```typescript
await smsParserService.saveTransaction(
  parsedTransaction: ParsedTransaction
): Promise<string>
```
Saves parsed transaction to database.
- **Returns**: Generated transaction ID

### Custom Rules
```typescript
await smsParserService.createSMSRule(
  rule: Omit<SMSRule, 'id' | 'createdAt'>
): Promise<string>
```
Creates custom SMS parsing rule.
- **Returns**: Generated rule ID

---

## Native SMS Reader (`nativeSMSReader`)

### Permissions
```typescript
await nativeSMSReader.hasPermission(): Promise<boolean>
```
Checks if SMS read permission is granted.

```typescript
await nativeSMSReader.requestPermission(): Promise<boolean>
```
Requests SMS read permission from user.

### SMS Retrieval
```typescript
await nativeSMSReader.getSMSHistory(
  fromDate: Date, 
  toDate: Date
): Promise<SMSMessage[]>
```
Retrieves SMS messages within date range.
- **Parameters**:
  - `fromDate`: Start date for SMS retrieval
  - `toDate`: End date for SMS retrieval
- **Returns**: Array of SMS messages

---

## Gmail Service (`gmailService`)

### Authentication
```typescript
await gmailService.authenticate(): Promise<boolean>
```
Authenticates with Gmail using OAuth 2.0 (currently mock for development).

```typescript
await gmailService.isAuthenticated(): Promise<boolean>
```
Checks current Gmail authentication status.

```typescript
await gmailService.disconnect(): Promise<void>
```
Disconnects from Gmail and revokes tokens.

### Email Retrieval
```typescript
await gmailService.getFinancialEmails(
  maxResults?: number, 
  pageToken?: string
): Promise<{
  messages: GmailMessage[],
  nextPageToken?: string
}>
```
Retrieves financial emails from Gmail inbox.
- **Parameters**:
  - `maxResults`: Maximum emails to retrieve (default: 50)
  - `pageToken`: Pagination token for next page
- **Returns**: Financial emails and pagination info

---

## Email Parser Service (`emailParserService`)

### Email Processing
```typescript
await emailParserService.parseEmail(
  email: GmailMessage
): Promise<ParsedTransaction | null>
```
Parses email content and extracts transaction data.
- **Returns**: Parsed transaction or null if not financial

---

## Email Monitor Service (`emailMonitorService`)

### Gmail Integration
```typescript
await emailMonitorService.connectGmail(): Promise<boolean>
```
Connects to Gmail and starts monitoring.

```typescript
await emailMonitorService.disconnectGmail(): Promise<void>
```
Disconnects from Gmail monitoring.

```typescript
await emailMonitorService.startMonitoring(): Promise<void>
```
Starts periodic email monitoring (5-minute intervals).

```typescript
emailMonitorService.stopMonitoring(): void
```
Stops email monitoring.

### Status
```typescript
await emailMonitorService.getConnectionStatus(): Promise<{
  isConnected: boolean,
  lastSync: string | null,
  emailsProcessed: number
}>
```
Returns Gmail connection and sync status.

---

## Data Types

### ParsedTransaction
```typescript
interface ParsedTransaction {
  amount: number;
  description: string;
  merchant?: string;
  account?: string;
  type: 'income' | 'expense';
  category: string;
  date: string;
  rawMessage: string;
}
```

### SMSMessage
```typescript
interface SMSMessage {
  id: string;
  address: string;
  body: string;
  date: number;
  read: boolean;
}
```

### Transaction
```typescript
interface Transaction {
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
```

### Category
```typescript
interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon: string;
  keywords: string[];
  createdAt: string;
}
```

### Budget
```typescript
interface Budget {
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
```

### GmailMessage
```typescript
interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  body: string;
  date: Date;
  snippet: string;
}
```

---

## Error Handling

All services implement consistent error handling patterns:

### Try-Catch Pattern
```typescript
try {
  const result = await serviceMethod();
  return result;
} catch (error) {
  console.error('Service error:', error);
  throw error; // or return default value
}
```

### Graceful Degradation
Services fall back to safe defaults when errors occur:
- SMS reader falls back to demo data
- Parser returns null for invalid SMS
- Database operations return 0 for failed counts

### Permission Handling
```typescript
// Check permission before operation
const hasPermission = await checkPermission();
if (!hasPermission) {
  const granted = await requestPermission();
  if (!granted) {
    throw new Error('Permission denied');
  }
}
```

---

## Usage Examples

### Process SMS History
```typescript
const result = await smsListenerService.processSMSHistory();
console.log(`Processed: ${result.processed}, Errors: ${result.errors}`);
```

### Clear Demo Data
```typescript
const deletedCount = await databaseService.clearDemoTransactions();
Alert.alert('Demo Data Cleared', `Removed ${deletedCount} transactions`);
```

### Remove Duplicates
```typescript
const duplicatesRemoved = await databaseService.removeDuplicateTransactions();
console.log(`Removed ${duplicatesRemoved} duplicate transactions`);
```

### Test SMS Parsing
```typescript
const transactionId = await smsListenerService.processTestSMS(
  'Payment received for GHS 100.00 from JOHN DOE',
  'MOMO'
);
```

### Connect Gmail
```typescript
const connected = await emailMonitorService.connectGmail();
if (connected) {
  await emailMonitorService.startMonitoring();
}
```