import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  RefreshControl,
  Alert,
  Modal,
  SafeAreaView,
  TextInput,
  ScrollView,
  Dimensions,
  Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { Transaction, databaseService } from '../database/schema';
import { useAppContext } from '../context/AppContext';
import { currencyService } from '../services/currencyService';

interface TransactionListProps {
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  contentContainerStyle?: any;
  showFilters?: boolean;
  maxTransactions?: number;
  transactionType?: 'all' | 'income' | 'expense';
}

interface FilterState {
  searchText: string;
  selectedType: 'all' | 'income' | 'expense';
  selectedCategory: string;
  selectedCurrency: string;
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  amountRange: {
    min: number | null;
    max: number | null;
  };
}

export const TransactionList: React.FC<TransactionListProps> = ({ 
  ListHeaderComponent, 
  contentContainerStyle,
  showFilters = true,
  maxTransactions,
  transactionType = 'all'
}) => {
  const { state, refreshData, getFormattedAmount } = useAppContext();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [customDateModalVisible, setCustomDateModalVisible] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null);
  const [formattedAmounts, setFormattedAmounts] = useState<{[id: string]: string}>({});
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [showFilterOptions, setShowFilterOptions] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    searchText: '',
    selectedType: 'all',
    selectedCategory: 'all',
    selectedCurrency: 'all',
    dateRange: { start: null, end: null },
    amountRange: { min: null, max: null }
  });

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    const formatTransactionAmounts = async () => {
      const formatted: {[id: string]: string} = {};
      const displayCurrency = state.userPreferences?.displayCurrency || 'GHS';
      
      for (const transaction of transactions) {
        const transactionCurrency = transaction.currency || 'GHS';
        
        // Convert amount to display currency
        const convertedAmount = await currencyService.convertAmount(
          transaction.amount,
          transactionCurrency,
          displayCurrency
        );
        
        // Format with display currency symbol
        formatted[transaction.id] = await currencyService.formatCurrency(convertedAmount, displayCurrency);
      }
      
      setFormattedAmounts(formatted);
    };
    
    if (transactions.length > 0) {
      formatTransactionAmounts();
    }
  }, [transactions, state.userPreferences?.displayCurrency]);

  // Filter transactions based on current filters or show latest for dashboard
  useEffect(() => {
    const applyFilters = () => {
      let filtered = [...transactions];

      if (showFilters) {
        // Apply all filters when filters are enabled (TransactionsScreen)
        // Search text filter
        if (filters.searchText.trim()) {
          const searchLower = filters.searchText.toLowerCase();
          filtered = filtered.filter(transaction => 
            transaction.description.toLowerCase().includes(searchLower) ||
            transaction.merchant?.toLowerCase().includes(searchLower) ||
            transaction.category.toLowerCase().includes(searchLower)
          );
        }

        // Transaction type filter
        if (filters.selectedType !== 'all') {
          filtered = filtered.filter(transaction => 
            transaction.type === filters.selectedType
          );
        }

        // Category filter
        if (filters.selectedCategory !== 'all') {
          filtered = filtered.filter(transaction => 
            transaction.category === filters.selectedCategory
          );
        }

        // Currency filter
        if (filters.selectedCurrency !== 'all') {
          filtered = filtered.filter(transaction => 
            (transaction.currency || 'GHS') === filters.selectedCurrency
          );
        }

        // Date range filter
        if (filters.dateRange.start || filters.dateRange.end) {
          filtered = filtered.filter(transaction => {
            const transactionDate = new Date(transaction.date);
            const start = filters.dateRange.start;
            const end = filters.dateRange.end;
            
            if (start && end) {
              return transactionDate >= start && transactionDate <= end;
            } else if (start) {
              return transactionDate >= start;
            } else if (end) {
              return transactionDate <= end;
            }
            return true;
          });
        }

        // Amount range filter
        if (filters.amountRange.min !== null || filters.amountRange.max !== null) {
          filtered = filtered.filter(transaction => {
            const { min, max } = filters.amountRange;
            if (min !== null && max !== null) {
              return transaction.amount >= min && transaction.amount <= max;
            } else if (min !== null) {
              return transaction.amount >= min;
            } else if (max !== null) {
              return transaction.amount <= max;
            }
            return true;
          });
        }
      }
      
      // Apply transaction type filter (for dashboard toggle)
      if (transactionType !== 'all') {
        filtered = filtered.filter(transaction => transaction.type === transactionType);
      }
      
      // Apply max transactions limit (for dashboard)
      if (maxTransactions && maxTransactions > 0) {
        filtered = filtered.slice(0, maxTransactions);
      }

      setFilteredTransactions(filtered);
    };

    applyFilters();
  }, [transactions, filters, showFilters, maxTransactions, transactionType]);

  const loadTransactions = async () => {
    try {
      const db = await databaseService.getDatabase();
      if (!db) return;

      const result = await db.getAllAsync(
        'SELECT * FROM transactions ORDER BY date DESC LIMIT 50'
      );
      setTransactions(result as Transaction[]);
    } catch (error) {
      console.error('Failed to load transactions:', error);
      Alert.alert('Error', 'Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadTransactions();
      await refreshData();
    } catch (error) {
      console.error('Failed to refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const renderFilterHeader = () => (
    <View style={styles.filterHeader}>
      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search transactions..."
            value={filters.searchText}
            onChangeText={(text) => setFilters(prev => ({ ...prev, searchText: text }))}
            placeholderTextColor="#9CA3AF"
          />
          <TouchableOpacity 
            style={styles.searchIcon}
            onPress={() => setFilters(prev => ({ ...prev, searchText: '' }))}
          >
            <Text style={styles.searchIconText}>🔍</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={[
            styles.filterIconButton,
            showFilterOptions && styles.filterIconButtonActive,
            hasActiveFilters() && styles.filterIconButtonHasActive
          ]}
          onPress={() => setShowFilterOptions(!showFilterOptions)}
        >
          <Text style={[
            styles.filterIconText,
            showFilterOptions && styles.filterIconActive,
            hasActiveFilters() && styles.filterIconHasActive
          ]}>≡</Text>
        </TouchableOpacity>
      </View>

      {/* Clear All Filters */}
      {hasActiveFilters() && (
        <View style={styles.clearAllContainer}>
          <TouchableOpacity
            style={styles.clearAllButton}
            onPress={clearFilters}
          >
            <Text style={styles.clearAllText}>Clear All Filters</Text>
            <Text style={styles.filterCountBadge}>
              {[filters.searchText, filters.selectedType, filters.selectedCategory, filters.selectedCurrency]
                .filter(v => v !== '' && v !== 'all')
                .length + 
               (filters.dateRange.start || filters.dateRange.end ? 1 : 0) + 
               (filters.amountRange.min !== null || filters.amountRange.max !== null ? 1 : 0)}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderFilterOptions = () => {
    if (!showFilterOptions) return null;
    
    return (
      <View style={styles.filterOptions}>
        {/* Quick Filters Row */}
        <View style={styles.quickFiltersRow}>
          <Text style={styles.filterSectionTitle}>Quick Filters</Text>
          <View style={styles.quickFiltersContainer}>
            {/* Transaction Type Filter */}
            <View style={styles.quickFilterGroup}>
              {['all', 'income', 'expense'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.quickFilterChip,
                    filters.selectedType === type && styles.quickFilterChipActive
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, selectedType: type as any }))}
                >
                  <Text style={[
                    styles.quickFilterText,
                    filters.selectedType === type && styles.quickFilterTextActive
                  ]}>
                    {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Advanced Filters - Stacked Vertically */}
        <View style={styles.advancedFiltersContainer}>
          {/* Category Filter */}
          <View style={styles.stackedFilterSection}>
            <Text style={styles.filterSectionTitle}>Categories</Text>
            <View style={styles.categoryGrid}>
              <TouchableOpacity
                style={[
                  styles.categoryPill,
                  filters.selectedCategory === 'all' && styles.categoryPillActive
                ]}
                onPress={() => setFilters(prev => ({ ...prev, selectedCategory: 'all' }))}
              >
                <Text style={styles.categoryIcon}>📋</Text>
                <Text style={[
                  styles.categoryText,
                  filters.selectedCategory === 'all' && styles.categoryTextActive
                ]}>All</Text>
              </TouchableOpacity>
              {getUniqueCategories().map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryPill,
                    filters.selectedCategory === category && styles.categoryPillActive
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, selectedCategory: category }))}
                >
                  <Text style={styles.categoryIcon}>{getTransactionIcon(category, 'expense')}</Text>
                  <Text style={[
                    styles.categoryText,
                    filters.selectedCategory === category && styles.categoryTextActive
                  ]}>{category}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Currency Filter */}
          {getUniqueCurrencies().length > 1 && (
            <View style={styles.stackedFilterSection}>
              <Text style={styles.filterSectionTitle}>Currency</Text>
              <View style={styles.filterChips}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    filters.selectedCurrency === 'all' && styles.filterChipActive
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, selectedCurrency: 'all' }))}
                >
                  <Text style={[
                    styles.filterChipText,
                    filters.selectedCurrency === 'all' && styles.filterChipTextActive
                  ]}>All</Text>
                </TouchableOpacity>
                {getUniqueCurrencies().map((currency) => (
                  <TouchableOpacity
                    key={currency}
                    style={[
                      styles.filterChip,
                      filters.selectedCurrency === currency && styles.filterChipActive
                    ]}
                    onPress={() => setFilters(prev => ({ ...prev, selectedCurrency: currency }))}
                  >
                    <Text style={[
                      styles.filterChipText,
                      filters.selectedCurrency === currency && styles.filterChipTextActive
                    ]}>{currency}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Date Filter */}
          <View style={styles.stackedFilterSection}>
            <Text style={styles.filterSectionTitle}>Date Range</Text>
            <View style={styles.dateFilterContainer}>
              <TouchableOpacity
                style={[
                  styles.dateFilterButton,
                  (!filters.dateRange.start && !filters.dateRange.end) && styles.dateFilterButtonActive
                ]}
                onPress={() => setFilters(prev => ({ ...prev, dateRange: { start: null, end: null } }))}
              >
                <Text style={[
                  styles.dateFilterText,
                  (!filters.dateRange.start && !filters.dateRange.end) && styles.dateFilterTextActive
                ]}>All Time</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dateFilterButton}
                onPress={() => {
                  const today = new Date();
                  setFilters(prev => ({ ...prev, dateRange: { start: today, end: today } }));
                }}
              >
                <Text style={styles.dateFilterText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dateFilterButton}
                onPress={() => {
                  const today = new Date();
                  const lastWeek = new Date();
                  lastWeek.setDate(today.getDate() - 7);
                  setFilters(prev => ({ ...prev, dateRange: { start: lastWeek, end: today } }));
                }}
              >
                <Text style={styles.dateFilterText}>7 days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dateFilterButton}
                onPress={() => {
                  const today = new Date();
                  const lastMonth = new Date();
                  lastMonth.setMonth(today.getMonth() - 1);
                  setFilters(prev => ({ ...prev, dateRange: { start: lastMonth, end: today } }));
                }}
              >
                <Text style={styles.dateFilterText}>30 days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.customRangeButton}
                onPress={() => setCustomDateModalVisible(true)}
              >
                <Text style={styles.customRangeText}>📅 Custom</Text>
              </TouchableOpacity>
            </View>
            {(filters.dateRange.start || filters.dateRange.end) && (
              <View style={styles.dateRangeDisplay}>
                <Text style={styles.dateRangeText}>
                  {filters.dateRange.start ? filters.dateRange.start.toLocaleDateString() : '...'} - {filters.dateRange.end ? filters.dateRange.end.toLocaleDateString() : '...'}
                </Text>
                <TouchableOpacity
                  onPress={() => setFilters(prev => ({ ...prev, dateRange: { start: null, end: null } }))}
                >
                  <Text style={styles.clearDateText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const deleteTransaction = async (transaction: Transaction) => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await databaseService.getDatabase();
              if (!db) return;

              await db.runAsync('DELETE FROM transactions WHERE id = ?', [transaction.id]);
              await loadTransactions();
              await refreshData();
            } catch (error) {
              console.error('Failed to delete transaction:', error);
              Alert.alert('Error', 'Failed to delete transaction');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      return date.toLocaleDateString('en-US', options);
    }
  };


  const clearFilters = () => {
    setFilters({
      searchText: '',
      selectedType: 'all',
      selectedCategory: 'all',
      selectedCurrency: 'all',
      dateRange: { start: null, end: null },
      amountRange: { min: null, max: null }
    });
  };

  const hasActiveFilters = () => {
    return filters.searchText.trim() !== '' ||
           filters.selectedType !== 'all' ||
           filters.selectedCategory !== 'all' ||
           filters.selectedCurrency !== 'all' ||
           filters.dateRange.start !== null ||
           filters.dateRange.end !== null ||
           filters.amountRange.min !== null ||
           filters.amountRange.max !== null;
  };

  const getUniqueCategories = () => {
    const categories = [...new Set(transactions.map(t => t.category))];
    return categories.sort();
  };

  const getUniqueCurrencies = () => {
    const currencies = [...new Set(transactions.map(t => t.currency || 'GHS'))];
    return currencies.sort();
  };

  const getTransactionIcon = (category: string, type: 'income' | 'expense') => {
    const iconMap: { [key: string]: string } = {
      // Income icons
      'Salary': '💰',
      // 'Transfers': '🔄',
      'Investment': '📈',
      'Other Income': '💰',
      
      // Expense icons  
      'Food & Dining': '🍽️',
      'Transportation': '🚗',
      'Shopping': '🛒',
      'Bills & Utilities': '💡',
      'Healthcare': '🏥',
      'Entertainment': '🎬',
      'Transfers': '💸'
    };

    return iconMap[category] || (type === 'income' ? '💰' : '💳');
  };

  const getIconBackground = (category: string, type: 'income' | 'expense') => {
    const colorMap: { [key: string]: string[] } = {
      // Income colors
      'Salary': ['#22C55E', '#16A34A'],
      'Transfers': ['#06B6D4', '#0891B2'], 
      'Investment': ['#8B5CF6', '#7C3AED'],
      'Other Income': ['#F59E0B', '#D97706'],
      
      // Expense colors
      'Food & Dining': ['#EF4444', '#DC2626'],
      'Transportation': ['#3B82F6', '#2563EB'],
      'Shopping': ['#EC4899', '#DB2777'],
      'Bills & Utilities': ['#F59E0B', '#D97706'],
      'Healthcare': ['#10B981', '#059669'],
      'Entertainment': ['#8B5CF6', '#7C3AED'],
      // 'Transfers': ['#6B7280', '#4B5563']
    };

    return colorMap[category] || (type === 'income' ? ['#22C55E', '#16A34A'] : ['#EF4444', '#DC2626']);
  };

  const openTransactionDetail = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDetailModalVisible(true);
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <TouchableOpacity 
      style={styles.transactionCard}
      onPress={() => openTransactionDetail(item)}
      onLongPress={() => deleteTransaction(item)}
      activeOpacity={0.7}
    >
      <View style={styles.transactionContent}>
        <ExpoLinearGradient
          colors={getIconBackground(item.category, item.type)}
          style={styles.transactionIcon}
        >
          <Text style={styles.iconText}>
            {getTransactionIcon(item.category, item.type)}
          </Text>
        </ExpoLinearGradient>
        
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionDescription} numberOfLines={1}>
            {item.description || item.category}
          </Text>
          <Text style={styles.transactionDate}>
            {formatDate(item.date)}
          </Text>
        </View>
        
        <Text style={[
          styles.transactionAmount,
          { color: item.type === 'income' ? '#22C55E' : '#EF4444' }
        ]}>
          {item.type === 'income' ? '+' : '-'} {formattedAmounts[item.id] || '₵0.00'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </View>
    );
  }

  const SectionHeader = () => {
    const getTitle = () => {
      if (!showFilters) {
        const typeText = transactionType === 'income' ? 'Income' : 
                        transactionType === 'expense' ? 'Expenses' : 'Transactions';
        return maxTransactions ? `Latest ${maxTransactions} ${typeText}` : `Latest ${typeText}`;
      }
      return hasActiveFilters() ? 'Filtered Transactions' : 'All Transactions';
    };
    
    const showCount = showFilters && filteredTransactions.length !== transactions.length;
    
    return (
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>
          {getTitle()}
          {showCount && (
            <Text style={styles.countText}> ({filteredTransactions.length})</Text>
          )}
        </Text>
        {/* {showSeeAll && showFilters && (
          <TouchableOpacity onPress={() => Alert.alert('Feature coming soon', 'View all transactions feature is coming soon!')}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        )} */}
      </View>
    );
  };

  const ListHeader = () => (
    <>
      {ListHeaderComponent && <ListHeaderComponent />}
      {showFilters && renderFilterHeader()}
      {showFilters && renderFilterOptions()}
      <View style={styles.sectionHeaderContainer}>
        <SectionHeader />
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredTransactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={['#8B5CF6']}
            tintColor="#8B5CF6"
          />
        }
        contentContainerStyle={[styles.listContainer, contentContainerStyle]}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
            <Text style={styles.emptyText}>
              Your transactions will appear here when you start tracking your finances
            </Text>
          </View>
        )}
      />

      {/* Transaction Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={detailModalVisible}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <SafeAreaView>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Transaction Details</Text>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setDetailModalVisible(false)}
                >
                  <Text style={styles.closeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
              
              {selectedTransaction && (
                <View style={styles.detailContent}>
                  <View style={styles.detailIconContainer}>
                    <ExpoLinearGradient
                      colors={getIconBackground(selectedTransaction.category, selectedTransaction.type)}
                      style={styles.detailIcon}
                    >
                      <Text style={styles.detailIconText}>
                        {getTransactionIcon(selectedTransaction.category, selectedTransaction.type)}
                      </Text>
                    </ExpoLinearGradient>
                  </View>
                  
                  <Text style={styles.detailAmount}>
                    {selectedTransaction.type === 'income' ? '+' : '-'} {formattedAmounts[selectedTransaction.id] || '₵0.00'}
                  </Text>
                  
                  <View style={styles.detailInfo}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Description</Text>
                      <Text style={styles.detailValue}>{selectedTransaction.description}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Category</Text>
                      <Text style={styles.detailValue}>{selectedTransaction.category}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Type</Text>
                      <Text style={styles.detailValue}>
                        {selectedTransaction.type === 'income' ? 'Income' : 'Expense'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Date</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedTransaction.date).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Source</Text>
                      <Text style={styles.detailValue}>
                        {selectedTransaction.source === 'sms' ? 'SMS Auto-detected' : 'Manual Entry'}
                      </Text>
                    </View>
                    {selectedTransaction.merchant && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Merchant</Text>
                        <Text style={styles.detailValue}>{selectedTransaction.merchant}</Text>
                      </View>
                    )}
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={() => {
                      setDetailModalVisible(false);
                      deleteTransaction(selectedTransaction);
                    }}
                  >
                    <Text style={styles.deleteButtonText}>Delete Transaction</Text>
                  </TouchableOpacity>
                </View>
              )}
            </SafeAreaView>
          </View>
        </View>
      </Modal>

      {/* Custom Date Range Modal */}
      <Modal
        visible={customDateModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCustomDateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.dateModalContainer}>
            <Text style={styles.dateModalTitle}>Select Custom Date Range</Text>
            
            <View style={styles.dateInputContainer}>
              <Text style={styles.dateInputLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={styles.datePickerButtonText}>
                  {tempStartDate ? tempStartDate.toLocaleDateString() : 'Select start date'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.dateInputContainer}>
              <Text style={styles.dateInputLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={styles.datePickerButtonText}>
                  {tempEndDate ? tempEndDate.toLocaleDateString() : 'Select end date'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.dateModalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setTempStartDate(null);
                  setTempEndDate(null);
                  setCustomDateModalVisible(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => {
                  if (tempStartDate && tempEndDate) {
                    setFilters(prev => ({ 
                      ...prev, 
                      dateRange: { start: tempStartDate, end: tempEndDate } 
                    }));
                    setTempStartDate(null);
                    setTempEndDate(null);
                    setCustomDateModalVisible(false);
                  }
                }}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      {showStartDatePicker && (
        <DateTimePicker
          value={tempStartDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, selectedDate) => {
            setShowStartDatePicker(false);
            if (selectedDate) {
              setTempStartDate(selectedDate);
            }
          }}
        />
      )}

      {showEndDatePicker && (
        <DateTimePicker
          value={tempEndDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, selectedDate) => {
            setShowEndDatePicker(false);
            if (selectedDate) {
              setTempEndDate(selectedDate);
            }
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionHeaderContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    backgroundColor: '#F8FAFC',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  seeAllText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  listContainer: {
    paddingBottom: 100,
  },
  transactionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  transactionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  detailContent: {
    paddingVertical: 20,
  },
  detailIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  detailIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailIconText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  detailAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 24,
  },
  detailInfo: {
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '600',
  },
  // Filter Styles
  filterHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    color: '#1F2937',
  },
  searchIcon: {
    padding: 4,
  },
  searchIconText: {
    fontSize: 16,
  },
  filterIconButton: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
  },
  filterIconText: {
    fontSize: 16,
    color: '#6B7280',
  },
  filterIconActive: {
    color: '#8B5CF6',
  },
  filterIconHasActive: {
    color: '#EF4444',
  },
  filterIconButtonActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  filterIconButtonHasActive: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  dateFilterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  dateFilterButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateFilterButtonActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  dateFilterText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  dateFilterTextActive: {
    color: '#FFFFFF',
  },
  dateRangeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  dateRangeText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
  clearDateText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: 'bold',
    paddingHorizontal: 4,
  },
  clearAllContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  filterCountBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#EF4444',
    minWidth: 18,
    textAlign: 'center',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryPillActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  customRangeButton: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  customRangeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#92400E',
  },
  filterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 80,
  },
  filterToggleActive: {
    backgroundColor: '#8B5CF6',
  },
  filterToggleHasFilters: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterToggleTextActive: {
    color: '#FFFFFF',
  },
  filterBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  clearFiltersButton: {
    backgroundColor: '#EF4444',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearFiltersText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  filterOptions: {
    backgroundColor: '#F9FAFB',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  quickFiltersRow: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  quickFiltersContainer: {
    marginTop: 8,
  },
  quickFilterGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  quickFilterChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  quickFilterChipActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  quickFilterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  quickFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  advancedFiltersContainer: {
    paddingHorizontal: 20,
  },
  stackedFilterSection: {
    marginBottom: 20,
  },
  filterSection: {
    marginHorizontal: 16,
    marginRight: 24,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  filterChips: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  filterChipActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  countText: {
    fontSize: 14,
    fontWeight: 'normal',
    color: '#8B5CF6',
  },
  dateModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    margin: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  dateModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  dateInputContainer: {
    marginBottom: 16,
  },
  dateInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
  },
  datePickerButton: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  datePickerButtonText: {
    fontSize: 16,
    color: '#1F2937',
  },
  dateModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  applyButton: {
    flex: 1,
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});