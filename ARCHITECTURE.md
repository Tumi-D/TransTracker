# Budget Tracker - Modern Architecture Documentation

## 📱 Application Overview

Budget Tracker is a React Native financial management application that automatically tracks transactions through SMS parsing and email monitoring. The app features a modern navigation system with beautiful UI design, real-time financial tracking, and multi-provider email integration.

## 🏗️ Architecture Overview

The application follows a **component-based architecture** with **modern navigation patterns**, **centralized state management**, and **service-oriented business logic**.

```
Budget Tracker Architecture
├── Navigation Layer (React Navigation)
├── Screen Components (UI Containers)
├── Shared Components (Reusable UI)
├── Services Layer (Business Logic)
├── Database Layer (SQLite + Services)
└── Context Layer (State Management)
```

## 📂 Directory Structure

```
src/
├── components/                 # Reusable UI Components
│   ├── AddTransactionModal.tsx    # FAB menu and transaction modals
│   ├── BudgetOverview.tsx         # Statistics dashboard
│   ├── TransactionList.tsx        # Virtualized transaction display
│   └── MultiCurrencyBalance.tsx   # Multi-currency balance display ✨ NEW
├── screens/                    # Navigation Screen Components
│   ├── HomeScreen.tsx             # Main dashboard (with currency support)
│   ├── StatisticsScreen.tsx       # Analytics and charts
│   ├── TransactionsScreen.tsx     # Full transaction history
│   └── ProfileScreen.tsx          # Settings and currency management ✨ ENHANCED
├── navigation/                 # Navigation Configuration
│   └── BottomTabNavigator.tsx     # Tab navigation setup
├── services/                   # Business Logic Layer
│   ├── smsListener.ts             # SMS monitoring service
│   ├── smsParser.ts               # SMS parsing logic
│   ├── budgetService.ts           # Budget calculations
│   ├── currencyService.ts         # Currency conversion & rates ✨ NEW
│   ├── emailMonitorService.ts     # Email monitoring coordinator
│   ├── emailParser.ts             # Email parsing logic
│   ├── gmailService.ts            # Gmail integration (legacy)
│   ├── nativeSMSReader.ts         # Platform SMS access
│   └── emailProviders/            # Multi-provider email system
│       ├── baseEmailProvider.ts      # Abstract base class
│       ├── emailProviderManager.ts   # Provider coordinator
│       ├── gmailProvider.ts           # Gmail implementation
│       ├── yahooProvider.ts           # Yahoo Mail implementation
│       ├── outlookProvider.ts         # Outlook implementation
│       └── imapProvider.ts            # Generic IMAP implementation
├── database/                   # Data Layer
│   └── schema.ts                  # SQLite schema with currency support ✨ ENHANCED
└── context/                    # State Management
    └── AppContext.tsx             # Global state with currency context ✨ ENHANCED
```

## 🎯 Navigation Architecture

### Bottom Tab Navigation Structure

The app uses React Navigation v7 with a **bottom tab navigator** that provides smooth transitions and modern tab bar design.

```typescript
BottomTabNavigator
├── Home Tab (🏠)
├── Statistics Tab (📊)
├── Transactions Tab (💳)
└── Profile Tab (👤)
```

### Navigation Features

- **Custom Tab Icons**: Gradient-based active states with emoji indicators
- **Modern Tab Bar**: Rounded corners, shadows, and floating appearance
- **Consistent Theming**: Purple gradient theme throughout
- **Safe Area Handling**: Proper handling of device notches and bottom areas

### Screen Responsibilities

| Screen | Purpose | Key Features |
|--------|---------|--------------|
| **HomeScreen** | Main dashboard | Balance display, recent transactions, quick actions |
| **StatisticsScreen** | Analytics | Charts, spending breakdown, time-based analysis |
| **TransactionsScreen** | Transaction history | Full transaction list, search, filtering |
| **ProfileScreen** | Settings & tools | Account management, app settings, data tools |

## 🔧 Component Architecture

### VirtualizedList Optimization

**Problem Solved**: Eliminated nested VirtualizedList warnings by restructuring scroll components.

#### Before (Problematic):
```typescript
ScrollView
└── FlatList // ❌ Nested VirtualizedList error
```

#### After (Optimized):
```typescript
FlatList
├── ListHeaderComponent // ✅ Header content
└── Transaction Items   // ✅ Virtualized content
```

### Component Hierarchy

```
Screen Components (Container)
├── Header Components (Static/List Headers)
├── Content Components (VirtualizedLists)
└── Modal Components (Overlays)
```

### Key Component Patterns

1. **Header-as-ListComponent Pattern**
   ```typescript
   const HeaderComponent = () => <GradientHeader />
   
   <FlatList 
     ListHeaderComponent={HeaderComponent}
     data={items}
     renderItem={renderItem}
   />
   ```

2. **Compound Component Pattern**
   ```typescript
   <TransactionList 
     ListHeaderComponent={CustomHeader}
     contentContainerStyle={customStyles}
   />
   ```

3. **Modal Management Pattern**
   ```typescript
   const [modalVisible, setModalVisible] = useState(false)
   // Centralized modal state management
   ```

## 📊 State Management Architecture

### Context-Based State Management

The app uses **React Context** with **useReducer** for centralized state management.

```typescript
AppContext
├── State (AppState)
├── Actions (AppAction)  
├── Computed Values (totalBalance, totalIncome, totalExpenses)
└── Refresh Function (refreshData)
```

### State Structure

```typescript
interface AppState {
  transactions: Transaction[]
  budgets: Budget[]
  categories: Category[]
  budgetSummary: BudgetSummary | null
  categorySpending: CategorySpending[]
  currencies: Currency[]                              // 🆕 Available currencies
  userPreferences: UserPreferences | null            // 🆕 Currency preferences
  multiCurrencyBalances: {[currency: string]: number} // 🆕 Balance by currency
  isLoading: boolean
  error: string | null
}
```

### Computed Properties

Real-time calculations derived from state:
- `totalIncome`: Sum of all income transactions
- `totalExpenses`: Sum of all expense transactions  
- `totalBalance`: Income minus expenses
- `getFormattedAmount()`: Format amount with currency symbol ✨ NEW
- `convertAmount()`: Convert between currencies ✨ NEW
- `getConsolidatedBalance()`: Total balance in display currency ✨ NEW

## 🛠️ Services Architecture

### Service Layer Organization

The services layer follows a **modular, single-responsibility** pattern:

```
Services Layer
├── Data Processing Services
│   ├── SMS Processing (smsListener, smsParser)
│   ├── Email Processing (emailMonitor, emailParser)  
│   ├── Budget Processing (budgetService)
│   └── Currency Processing (currencyService) ✨ NEW
├── Platform Services  
│   └── Native SMS Reader (nativeSMSReader)
├── Integration Services
│   ├── Email Providers (multi-provider system)
│   └── Exchange Rate Providers (ExchangeRate-API, Fallback) ✨ NEW
└── Database Services
    └── Schema & Operations (schema.ts)
```

### Email Provider Architecture

**Multi-Provider Email System** with extensible architecture:

```typescript
BaseEmailProvider (Abstract)
├── GmailProvider (OAuth 2.0 + Gmail API)
├── YahooProvider (Yahoo OAuth + API)
├── OutlookProvider (Microsoft Graph API)
└── ImapProvider (Generic IMAP protocol)

EmailProviderManager
├── Provider Registration
├── Unified Email Retrieval  
├── Authentication Management
└── Connection Status Tracking
```

### Service Communication Pattern

```
Screen Component
    ↓
Context (State Management)
    ↓  
Service Layer (Business Logic)
    ↓
Database Layer (Data Persistence)
```

## 💾 Database Architecture

### SQLite Schema Design

```sql
-- Core Financial Data
transactions (id, amount, description, category, type, source, date, currency, exchangeRate, originalAmount, originalCurrency, ...)
categories (id, name, type, color, icon, keywords, ...)
budgets (id, name, category, amount, spent, period, currency, ...)
accounts (id, name, type, balance, currency, ...)

-- Currency System 🆕 NEW
currencies (id, code, name, symbol, decimalPlaces, exchangeRate, lastUpdated, ...)
user_preferences (id, baseCurrency, displayCurrency, autoConvert, showMultipleCurrencies, ...)

-- SMS Processing
sms_rules (id, pattern, category, merchant_extraction, ...)
sms_processing_log (id, sms_id, processed_at, success, ...)
```

### Database Operations

- **CRUD Operations**: Full Create, Read, Update, Delete functionality
- **Complex Queries**: Category spending analysis, duplicate detection
- **Data Integrity**: Transaction validation, category consistency
- **Performance**: Indexed queries, efficient data retrieval

## 🎨 UI/UX Architecture

### Design System

**Purple Gradient Theme** with modern glassmorphism effects:

```typescript
Primary Colors:
- Purple: #8B5CF6, #A855F7, #C084FC
- Success: #10B981, #22C55E  
- Error: #EF4444, #DC2626
- Warning: #F59E0B, #D97706
```

### Component Design Patterns

1. **Gradient Headers**
   ```typescript
   <ExpoLinearGradient colors={['#8B5CF6', '#A855F7']}>
   ```

2. **Card-Based Layout**
   ```typescript
   backgroundColor: '#FFFFFF'
   borderRadius: 16
   shadowColor: '#000'
   elevation: 3
   ```

3. **Modern FAB System**
   ```typescript
   // Main FAB with expandable sub-actions
   FAB Container → Sub-FABs → Action Modals
   ```

### Responsive Design

- **Safe Area Handling**: Proper notch and navigation avoidance
- **Dynamic Spacing**: Consistent padding and margins
- **Touch Targets**: 44px minimum touch targets
- **Accessibility**: Proper color contrast and text sizing

## 🔄 Data Flow Architecture

### Transaction Processing Flow

```
SMS Received → SMS Parser → Category Detection → Database Storage → UI Update
Email Received → Email Parser → Transaction Extraction → Database Storage → UI Update
Manual Entry → Validation → Category Assignment → Database Storage → UI Update
```

### Real-time Updates

```
Database Change → Context Refresh → Component Re-render → UI Update
```

### Background Processing

```
SMS Monitoring (30s intervals) → Parse Financial SMS → Create Transactions
Email Monitoring (5min intervals) → Parse Financial Emails → Create Transactions
```

## 🧪 Testing Architecture

### Component Testing Strategy

1. **Unit Tests**: Individual service functions
2. **Integration Tests**: Service-to-database interactions
3. **Component Tests**: UI component rendering and interactions
4. **E2E Tests**: Complete user workflows

### Mock Data Strategy

```typescript
// Development mock data for testing
Demo Transactions: JANE SMITH, KWAME ASANTE
Mock Email Data: PayPal, Bank notifications
Test SMS Formats: Ghana banks, Mobile money
```

## 🚀 Performance Architecture

### Optimization Strategies

1. **VirtualizedLists**: Efficient rendering of large transaction lists
2. **Lazy Loading**: Components loaded on-demand
3. **Memoization**: React.memo for expensive components
4. **Background Processing**: SMS/Email monitoring in background
5. **Database Indexing**: Fast query performance

### Memory Management

```typescript
// Proper cleanup patterns
useEffect(() => {
  const subscription = service.subscribe()
  return () => subscription.unsubscribe() // Cleanup
}, [])
```

## 💱 Multi-Currency Architecture

### Currency System Overview

The Budget Tracker now supports **comprehensive multi-currency functionality** with real-time exchange rates, automatic conversions, and intelligent currency management.

```
Multi-Currency System
├── Currency Service (Exchange rates & conversion)
├── Database Schema (Currency fields & preferences)
├── UI Components (Multi-currency displays)
└── Context Integration (State management)
```

### Core Currency Features

#### 1. **Multi-Currency Data Model**
```typescript
interface Transaction {
  currency: string;           // ISO 4217 code (USD, EUR, GHS)
  exchangeRate?: number;      // Rate at transaction time
  originalAmount?: number;    // Amount in foreign currency
  originalCurrency?: string;  // Original currency if converted
}

interface UserPreferences {
  baseCurrency: string;       // Primary calculation currency
  displayCurrency: string;    // UI display currency
  autoConvert: boolean;       // Auto-convert transactions
  showMultipleCurrencies: boolean; // Show currency breakdown
}
```

#### 2. **Exchange Rate Management**
- **Real-time Rates**: Fetches from ExchangeRate-API
- **Fallback Rates**: Static rates when API unavailable
- **Update Frequencies**: Hourly, Daily, Weekly, Manual
- **Rate Caching**: Persistent storage in SQLite
- **Multiple Providers**: Extensible provider system

#### 3. **Currency Conversion Service**
```typescript
class CurrencyConversionService {
  convertAmount(amount: number, from: string, to: string): Promise<number>
  getExchangeRate(from: string, to: string): Promise<number>
  updateExchangeRates(): Promise<boolean>
  getMultiCurrencyBalance(): Promise<{[currency: string]: number}>
  formatCurrency(amount: number, currency: string): Promise<string>
}
```

### Supported Currencies

| Currency | Code | Symbol | Name |
|----------|------|--------|---------|
| 🇬🇭 Ghanaian Cedi | GHS | ₵ | Base currency |
| 🇺🇸 US Dollar | USD | $ | International |
| 🇪🇺 Euro | EUR | € | European |
| 🇬🇧 British Pound | GBP | £ | British |
| 🇳🇬 Nigerian Naira | NGN | ₦ | West African |
| 🇿🇦 South African Rand | ZAR | R | Southern African |

### Database Migration Strategy

#### **Safe Schema Evolution**
```sql
-- Backward-compatible column additions
ALTER TABLE transactions ADD COLUMN currency TEXT DEFAULT 'GHS';
ALTER TABLE transactions ADD COLUMN exchangeRate REAL DEFAULT 1.0;
ALTER TABLE budgets ADD COLUMN currency TEXT DEFAULT 'GHS';
ALTER TABLE accounts ADD COLUMN currency TEXT DEFAULT 'GHS';

-- New currency tables
CREATE TABLE currencies (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  exchangeRate REAL DEFAULT 1.0,
  lastUpdated TEXT NOT NULL
);

CREATE TABLE user_preferences (
  id TEXT PRIMARY KEY,
  baseCurrency TEXT NOT NULL DEFAULT 'GHS',
  displayCurrency TEXT NOT NULL DEFAULT 'GHS',
  autoConvert INTEGER DEFAULT 1,
  showMultipleCurrencies INTEGER DEFAULT 0
);
```

### Multi-Currency UI Components

#### **MultiCurrencyBalance Component**
```typescript
<MultiCurrencyBalance>
├── Main Balance Card (Consolidated in display currency)
├── Currency Breakdown (Individual currency balances)
├── Exchange Rate Info (Last update time)
└── Conversion Indicators (Cross-currency calculations)
```

**Features:**
- Consolidated balance in display currency
- Individual currency cards with native amounts
- Real-time conversion indicators
- Responsive horizontal scroll for currencies
- Loading states and error handling

#### **Currency Settings (ProfileScreen)**
```typescript
Currency Settings Section:
├── Base Currency Selection (4-option grid)
├── Display Currency Selection (4-option grid)
├── Multi-Currency Toggle (Show/hide breakdown)
├── Exchange Rates Display (Current rates table)
└── Manual Update Button (Force rate refresh)
```

### Context Integration

#### **Enhanced AppContext**
```typescript
interface AppState {
  currencies: Currency[];
  userPreferences: UserPreferences | null;
  multiCurrencyBalances: {[currency: string]: number};
}

// Helper functions
getFormattedAmount(amount: number, currency?: string): Promise<string>
convertAmount(amount: number, from: string, to?: string): Promise<number>
getConsolidatedBalance(): Promise<number>
```

### Exchange Rate Provider Architecture

```typescript
interface ExchangeRateProvider {
  name: string;
  fetchRates(baseCurrency: string): Promise<{[currency: string]: number}>;
}

// Primary Provider
class ExchangeRateApiProvider implements ExchangeRateProvider {
  // Fetches from api.exchangerate-api.com
}

// Fallback Provider
class FallbackRateProvider implements ExchangeRateProvider {
  // Static rates when APIs fail
}
```

### Performance Optimizations

1. **Rate Caching**: Exchange rates cached in SQLite
2. **Lazy Loading**: Currency data loaded on-demand
3. **Batch Conversions**: Multiple conversions in single operation
4. **Smart Updates**: Only update rates when necessary
5. **Background Processing**: Rate updates don't block UI

### Error Handling

- **API Failures**: Graceful fallback to cached/static rates
- **Network Issues**: Offline-first with last known rates
- **Invalid Currencies**: Default to base currency
- **Conversion Errors**: Show original amount with warning
- **Migration Failures**: Non-blocking with comprehensive logging

## 🔒 Security Architecture

### Data Security

- **Local Storage**: All data stored locally in SQLite
- **No External Transmission**: SMS/Email processing on-device
- **Token Management**: Secure OAuth token storage
- **Permission Handling**: Explicit SMS/Email permissions
- **Currency Data**: Exchange rates cached locally, no sensitive data transmitted

### Privacy Protection

- **SMS Redaction**: Phone numbers masked in logs
- **Financial Data**: Never transmitted externally
- **User Control**: Easy data deletion and management
- **Exchange Rate Privacy**: No personal data sent to rate providers

## 🔧 Development Architecture

### Build System

```
Expo SDK 53 → Metro Bundler → React Native 0.79.6
├── TypeScript compilation
├── Asset optimization  
├── Native module linking
└── Platform-specific builds
```

### Code Organization Principles

1. **Single Responsibility**: Each file has one clear purpose
2. **Separation of Concerns**: UI, logic, and data layers separated
3. **Reusability**: Shared components and utilities
4. **Maintainability**: Clear naming and documentation
5. **Scalability**: Modular architecture for easy expansion

## 📈 Future Architecture Considerations

### Planned Enhancements

1. **Cloud Sync**: Optional cloud backup and sync
2. ~~**Multi-Currency**: International currency support~~ ✅ **IMPLEMENTED**
3. **Investment Tracking**: Portfolio integration
4. **Receipt OCR**: Camera-based receipt scanning
5. **Export Features**: CSV, PDF export functionality

### Scalability Considerations

- **Microservices**: Potential service extraction
- **Caching Layer**: Redis for performance
- **Real-time Sync**: WebSocket connections
- **Push Notifications**: Background transaction alerts

## 🎯 Architecture Benefits

### Developer Benefits

- **Type Safety**: Full TypeScript implementation
- **Hot Reload**: Fast development iterations  
- **Modular Structure**: Easy feature additions
- **Clear Patterns**: Consistent code organization
- **Documentation**: Comprehensive API docs

### User Benefits

- **Fast Performance**: Optimized rendering and data access
- **Smooth Navigation**: Modern navigation patterns
- **Offline First**: Works without internet connection
- **Real-time Updates**: Automatic transaction detection
- **Beautiful UI**: Modern, professional design

---

## 📚 Related Documentation

- [API Reference](./API_REFERENCE.md) - Service and component APIs
- [User Guide](./README.md) - Setup and usage instructions  
- [Technical Docs](./DOCUMENTATION.md) - Detailed technical documentation

---

**Built with ❤️ using React Native, Expo, and modern mobile development practices**