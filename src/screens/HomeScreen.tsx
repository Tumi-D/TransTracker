import React, { useState, useEffect } from 'react';
import { 
  SafeAreaView, 
  StyleSheet,
  View,
  Text,
  TouchableOpacity
} from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { TransactionList } from '../components/TransactionList';
import { AddTransactionModal } from '../components/AddTransactionModal';
import { MultiCurrencyBalance } from '../components/MultiCurrencyBalance';
import { useAppContext } from '../context/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const HomeScreen: React.FC = () => {
  const { totalBalance, totalIncome, totalExpenses, state, getFormattedAmount, getConvertedTotals } = useAppContext();
  const [formattedBalance, setFormattedBalance] = useState('₵0.00');
  const [formattedIncome, setFormattedIncome] = useState('₵0.00');
  const [formattedExpenses, setFormattedExpenses] = useState('₵0.00');
  const [selectedTransactionType, setSelectedTransactionType] = useState<'income' | 'expense'>('expense');
  const [userName, setUserName] = useState('User');

  useEffect(() => {
    loadUserName();
  }, []);

  const loadUserName = async () => {
    try {
      const savedUserName = await AsyncStorage.getItem('userName');
      if (savedUserName) {
        setUserName(savedUserName);
      }
    } catch (error) {
      console.error('Error loading user name:', error);
    }
  };
  
  // Get user's first name
  const getFirstName = () => {
    return userName.split(' ')[0] || 'User';
  };
  
  useEffect(() => {
    const formatAmounts = async () => {
      const displayCurrency = state.userPreferences?.displayCurrency || 'GHS';
      
      try {
        // Get properly converted totals in display currency
        const convertedTotals = await getConvertedTotals();
        
        const balance = await getFormattedAmount(convertedTotals.balance, displayCurrency, displayCurrency);
        const income = await getFormattedAmount(convertedTotals.income, displayCurrency, displayCurrency);
        const expenses = await getFormattedAmount(convertedTotals.expenses, displayCurrency, displayCurrency);
        
        setFormattedBalance(balance);
        setFormattedIncome(income);
        setFormattedExpenses(expenses);
      } catch (error) {
        console.error('Error formatting amounts:', error);
        // Fallback to Cedi symbol
        const cediFallback = (amount: number) => `₵${amount.toFixed(2)}`;
        setFormattedBalance(cediFallback(totalBalance));
        setFormattedIncome(cediFallback(totalIncome));
        setFormattedExpenses(cediFallback(totalExpenses));
      }
    };
    
    formatAmounts();
  }, [totalBalance, totalIncome, totalExpenses, state.userPreferences?.displayCurrency, getFormattedAmount, getConvertedTotals]);
  
  const HeaderComponent = () => (
    <>
      <ExpoLinearGradient
        colors={['#8B5CF6', '#A855F7', '#C084FC']}
        style={styles.headerGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Hey {getFirstName()}</Text>
              <Text style={styles.balanceLabel}>Your balance</Text>
            </View>
            <TouchableOpacity style={styles.shareButton}>
              <Text style={styles.shareIcon}>↗</Text>
            </TouchableOpacity>
          </View>
        
        {/* Income/Expense Cards */}
        <View style={styles.summaryCards}>
          <View style={styles.summaryCard}>
            <View style={styles.incomeIcon}>
              <Text style={styles.iconText}>↗</Text>
            </View>
            <View>
              <Text style={styles.summaryLabel}>Income</Text>
              <Text style={styles.summaryAmount}>{formattedIncome}</Text>
            </View>
          </View>
          
          <View style={styles.summaryCard}>
            <View style={styles.expenseIcon}>
              <Text style={styles.iconText}>↘</Text>
            </View>
            <View>
              <Text style={styles.summaryLabel}>Expenses</Text>
              <Text style={styles.summaryAmount}>{formattedExpenses}</Text>
            </View>
          </View>
        </View>
        
        {/* Category Chips */}
        <View style={styles.categoryChips}>
          <View style={styles.categoryChip}>
            <View style={[styles.chipIcon, { backgroundColor: '#8B5CF6' }]} />
            <Text style={styles.chipText}>Electricity</Text>
          </View>
          <View style={styles.categoryChip}>
            <View style={[styles.chipIcon, { backgroundColor: '#EC4899' }]} />
            <Text style={styles.chipText}>Internet</Text>
          </View>
          <View style={styles.categoryChip}>
            <View style={[styles.chipIcon, { backgroundColor: '#3B82F6' }]} />
            <Text style={styles.chipText}>Shopping</Text>
          </View>
          <View style={styles.categoryChip}>
            <View style={[styles.chipIcon, { backgroundColor: '#10B981' }]} />
            <Text style={styles.chipText}>Insurance</Text>
          </View>
        </View>
      </SafeAreaView>
      </ExpoLinearGradient>
      
      {/* Multi-Currency Balance Section */}
      <View style={styles.balanceSection}>
        <MultiCurrencyBalance />
        
        {/* Transaction Type Toggle */}
        <View style={styles.transactionToggleSection}>
          <Text style={styles.toggleSectionTitle}>Recent Activity</Text>
          <View style={styles.transactionToggle}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                selectedTransactionType === 'income' && styles.toggleButtonActive
              ]}
              onPress={() => setSelectedTransactionType('income')}
            >
              <Text style={[
                styles.toggleButtonText,
                selectedTransactionType === 'income' && styles.toggleButtonTextActive
              ]}>Income</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                selectedTransactionType === 'expense' && styles.toggleButtonActive
              ]}
              onPress={() => setSelectedTransactionType('expense')}
            >
              <Text style={[
                styles.toggleButtonText,
                selectedTransactionType === 'expense' && styles.toggleButtonTextActive
              ]}>Expenses</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </>
  );
  
  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.container}>
        <TransactionList 
          ListHeaderComponent={HeaderComponent}
          contentContainerStyle={styles.listContent}
          showFilters={false}
          maxTransactions={5}
          transactionType={selectedTransactionType}
        />
      </View>
      
      <AddTransactionModal />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 100, // Space for bottom navigation
  },
  headerGradient: {
    paddingTop: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 16,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  balance: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 24,
  },
  summaryCards: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  incomeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(34,197,94,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expenseIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  chipIcon: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  balanceSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: '#F8FAFC',
  },
  transactionToggleSection: {
    marginTop: 24,
    marginBottom: 8,
  },
  toggleSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  transactionToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
});