# Budget Tracker 💰

A React Native app that automatically tracks your financial transactions by parsing SMS messages and emails. Built with Expo and optimized for Ghana banking systems.

![Budget Tracker](https://img.shields.io/badge/Platform-Android%20%7C%20iOS-blue)
![React Native](https://img.shields.io/badge/React%20Native-0.79.6-green)
![Expo](https://img.shields.io/badge/Expo-53.0.22-black)

## ✨ Features

- **🔄 Automatic SMS Processing** - Reads and parses financial SMS from banks and mobile money
- **📧 Gmail Integration** - Processes financial emails for transaction data  
- **🎯 Smart Categorization** - AI-powered categorization with Ghana-specific categories
- **🔍 Duplicate Detection** - Intelligent removal of duplicate transactions
- **📊 Budget Management** - Set budgets and get real-time spending alerts
- **📱 Real-time Monitoring** - Background processing of new transactions
- **🗑️ Data Management** - Easy cleanup of demo data and duplicates

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Expo CLI
- Android Studio (for Android development)
- Xcode (for iOS development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd BudgetTracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npx expo start
   ```

4. **Run on device**
   ```bash
   # Android (recommended for SMS features)
   npx expo run:android
   
   # iOS (limited SMS support)
   npx expo run:ios
   ```

## 📱 SMS Reading Setup

### Android
1. Build the app with native modules:
   ```bash
   npx expo run:android
   ```
2. Grant SMS permissions when prompted
3. The app will automatically read and process your financial SMS messages

### iOS
- SMS reading is not supported on iOS due to platform restrictions
- Manual transaction entry is always available as fallback

## 🏗️ Architecture

```
src/
├── components/          # UI Components
│   ├── AddTransactionModal.tsx    # FAB menu and modals
│   ├── BudgetOverview.tsx         # Budget dashboard
│   └── TransactionList.tsx        # Transaction display
├── services/           # Business Logic
│   ├── smsListener.ts            # SMS monitoring
│   ├── smsParser.ts              # SMS parsing logic
│   ├── gmailService.ts           # Gmail integration
│   └── nativeSMSReader.ts        # Platform SMS reading
├── database/           # Data Layer
│   └── schema.ts                 # SQLite schema & operations
└── context/           # State Management
    └── AppContext.tsx            # Global app state
```

## 💳 Supported SMS Formats

The app supports various Ghana banking and mobile money SMS formats:

### Banks
- **GCB Bank**: "Dear Customer, GHS 500.00 has been debited..."
- **GTBank**: "Your account has been credited with GHS 5,000..."
- **UBA/Absa/Cal Bank**: Standard debit/credit notifications

### Mobile Money
- **MTN MOMO**: "Payment received for GHS 123.00 from..."
- **Vodafone**: "Transfer successful. Amount: GHS..."
- **AirtelTigo**: "You have received GHS..."

### Hubtel
- "JOHN DOE 233123456789 has sent you GHS 50.00 via https://hbtl.co/app"

## 🎛️ App Controls

### Floating Action Button (FAB) Menu
Tap the main + button to access:

- **📧 Gmail Sync** (250px) - Connect and sync Gmail transactions
- **📋 SMS History** (200px) - Process SMS from last 30 days  
- **📱 Test SMS** (150px) - Test SMS parsing with custom messages
- **🗑️ Clear Demo** (125px) - Remove all demo/test transactions
- **🔍 Remove Duplicates** (75px) - Smart duplicate transaction removal
- **➕ Add Transaction** (25px) - Manual transaction entry

## 📊 Categories

### Expense Categories
- **Food & Dining** - Restaurants, cafes, food purchases
- **Transportation** - Fuel, Uber, taxi, public transport
- **Shopping** - Markets, malls, retail purchases
- **Bills & Utilities** - Electricity, water, internet, phone
- **Healthcare** - Hospitals, pharmacies, medical services
- **Entertainment** - Movies, concerts, games
- **Transfers** - Bank transfers, mobile money transfers

### Income Categories  
- **Salary** - Employment income, wages
- **Transfers** - Money received, mobile money credits
- **Investment** - Dividends, interest, returns
- **Other Income** - Bonuses, gifts, refunds

## 🔧 Configuration

### Default Settings
- SMS monitoring: Every 30 seconds when app is active
- History processing: Last 30 days on app startup
- Email sync: Every 5 minutes (when Gmail connected)
- Duplicate detection: 1-minute time window

### Customization
- Add custom SMS parsing rules
- Create custom categories with keywords
- Set up budgets for different categories
- Configure notification preferences

## 📱 Development

### Testing SMS Parsing
1. Use the **📱 Test SMS** button in the FAB menu
2. Enter custom SMS text to test parsing logic
3. View parsing results and categorization

### Demo Data Management
- **🗑️ Clear Demo** removes all test/demo transactions
- **🔍 Remove Duplicates** finds and removes duplicate transactions
- Real SMS transactions are preserved during cleanup

### Debugging
- Check console logs for parsing details
- View SMS processing statistics
- Monitor transaction categorization accuracy

## 🔒 Privacy & Security

- **Local Storage**: All data stored locally in SQLite database
- **No External Servers**: SMS processing happens on-device
- **Permission Control**: SMS permissions requested explicitly
- **Secure Parsing**: No sensitive data logged or transmitted

## 🛠️ Troubleshooting

### Common Issues

**SMS Not Being Processed**
- Ensure SMS permissions are granted
- Check if app is built with native modules (`npx expo run:android`)
- Verify SMS format is supported

**Duplicate Transactions**
- Use **🔍 Remove Duplicates** feature
- Check if SMS processing ran multiple times
- Review transaction timestamps

**Categories Not Loading**  
- Clear app data and restart
- Check database initialization logs
- Use category retry mechanism in UI

**Gmail Integration Issues**
- Currently uses mock authentication for development
- Production requires Google Cloud Console setup
- Check OAuth configuration

### Debug Information
The app provides detailed logging:
```
LOG  ✅ Successfully retrieved 15 SMS messages from phone!
LOG  Filtered to 8 financial messages  
LOG  ✅ Found 3 REAL financial SMS messages!
LOG  Automatically processed 3 SMS transactions from history
```

## 📈 Future Enhancements

- [ ] Production Gmail OAuth setup
- [ ] Custom SMS rule creation UI
- [ ] Transaction analytics and insights  
- [ ] Export functionality (CSV, PDF)
- [ ] Cloud backup and sync
- [ ] Multi-currency support
- [ ] Receipt OCR scanning
- [ ] Investment tracking integration

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Expo team for excellent React Native tooling
- Ghana banking institutions for standardized SMS formats
- Mobile money providers for transaction notifications
- React Native community for open-source packages

---

**Built with ❤️ for personal financial management**