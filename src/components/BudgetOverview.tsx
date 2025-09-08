import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions
} from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { useAppContext } from '../context/AppContext';

const { width } = Dimensions.get('window');

export const BudgetOverview: React.FC = () => {
  const { state, totalExpenses, totalIncome, getFormattedAmount } = useAppContext();
  const { budgetSummary, categorySpending, isLoading } = state;
  const [activeTab, setActiveTab] = useState<'Daily' | 'Weekly' | 'Monthly'>('Monthly');
  const [selectedType, setSelectedType] = useState<'income' | 'expense'>('expense');
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);
  const [formattedAmounts, setFormattedAmounts] = useState({
    chartTotal: '₵0.00',
    categories: {} as {[key: string]: string}
  });

  useEffect(() => {
    const formatAmounts = async () => {
      const currentData = getCurrentData();
      const chartTotal = await formatCurrency(currentData.total);
      const categoryAmounts: {[key: string]: string} = {};
      
      for (const category of currentData.categories) {
        categoryAmounts[category.name] = await formatCurrency(category.amount);
      }
      
      // Format individual bar values for tooltips
      for (let i = 0; i < currentData.chartData.length; i++) {
        categoryAmounts[`bar_${i}`] = await formatCurrency(currentData.chartData[i]);
      }
      
      setFormattedAmounts({ chartTotal, categories: categoryAmounts });
    };
    
    formatAmounts();
  }, [activeTab, selectedType, state.userPreferences?.displayCurrency, state.transactions]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading statistics...</Text>
        </View>
      </View>
    );
  }

  // Get date range based on active tab
  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (activeTab) {
      case 'Daily':
        // Last 7 days
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6);
        return { start: sevenDaysAgo, end: now };
        
      case 'Weekly':
        // Last 4 weeks (28 days)
        const fourWeeksAgo = new Date(today);
        fourWeeksAgo.setDate(today.getDate() - 27);
        return { start: fourWeeksAgo, end: now };
        
      case 'Monthly':
        // Last 6 months
        const sixMonthsAgo = new Date(today);
        sixMonthsAgo.setMonth(today.getMonth() - 5);
        sixMonthsAgo.setDate(1); // Start of month
        return { start: sixMonthsAgo, end: now };
        
      default:
        return { start: new Date(0), end: now };
    }
  };
  
  // Get current data based on selected type and period
  const getCurrentData = () => {
    const transactions = state.transactions || [];
    const dateRange = getDateRange();
    
    // Filter by type and date range
    const filteredTransactions = transactions.filter(t => {
      if (t.type !== selectedType) return false;
      
      const transactionDate = new Date(t.date);
      return transactionDate >= dateRange.start && transactionDate <= dateRange.end;
    });
    
    // Calculate total for the selected type and period
    const total = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    // Group by category and calculate amounts
    const categoryMap = new Map<string, { amount: number, detail: Set<string> }>();
    
    filteredTransactions.forEach(transaction => {
      const category = transaction.category;
      const existing = categoryMap.get(category) || { amount: 0, detail: new Set() };
      existing.amount += transaction.amount;
      if (transaction.merchant) {
        existing.detail.add(transaction.merchant);
      }
      categoryMap.set(category, existing);
    });
    
    // Convert to array and calculate percentages
    const categories = Array.from(categoryMap.entries())
      .map(([name, data]) => ({
        name,
        detail: Array.from(data.detail).slice(0, 3).join(', ') || 'Various',
        amount: data.amount,
        percentage: total > 0 ? Math.round((data.amount / total) * 100) : 0,
        color: getCategoryColor(name)
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5); // Top 5 categories
    
    // Generate time-based chart data
    const chartData = generateChartData(filteredTransactions, dateRange);
    
    return {
      total,
      categories,
      chartData
    };
  };
  
  // Generate chart data based on time period
  const generateChartData = (transactions: typeof state.transactions, dateRange: { start: Date, end: Date }) => {
    const data: number[] = [];
    
    if (activeTab === 'Daily') {
      // Last 7 days - one bar per day
      for (let i = 6; i >= 0; i--) {
        const date = new Date(dateRange.end);
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        
        const dayTotal = transactions
          .filter(t => {
            const tDate = new Date(t.date);
            return tDate >= dayStart && tDate < dayEnd;
          })
          .reduce((sum, t) => sum + t.amount, 0);
          
        data.push(dayTotal);
      }
    } else if (activeTab === 'Weekly') {
      // Last 4 weeks - one bar per week
      for (let i = 3; i >= 0; i--) {
        const weekEnd = new Date(dateRange.end);
        weekEnd.setDate(weekEnd.getDate() - (i * 7));
        const weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() - 6);
        
        const weekTotal = transactions
          .filter(t => {
            const tDate = new Date(t.date);
            return tDate >= weekStart && tDate <= weekEnd;
          })
          .reduce((sum, t) => sum + t.amount, 0);
          
        data.push(weekTotal);
      }
    } else if (activeTab === 'Monthly') {
      // Last 6 months - one bar per month
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(dateRange.end);
        monthDate.setMonth(monthDate.getMonth() - i);
        const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        
        const monthTotal = transactions
          .filter(t => {
            const tDate = new Date(t.date);
            return tDate >= monthStart && tDate < monthEnd;
          })
          .reduce((sum, t) => sum + t.amount, 0);
          
        data.push(monthTotal);
      }
    }
    
    return data.length > 0 ? data : [0];
  };
  
  const getCategoryColor = (category: string) => {
    const colorMap: {[key: string]: string} = {
      'Food & Dining': '#FF6B35',
      'Transportation': '#4ECDC4', 
      'Shopping': '#45B7D1',
      'Bills & Utilities': '#F39C12',
      'Healthcare': '#E74C3C',
      'Entertainment': '#9B59B6',
      'Transfers': '#8E44AD',
      'Salary': '#27AE60',
      'Investment': '#2ECC71',
      'Other Income': '#1ABC9C',
      'Other Expense': '#95A5A6'
    };
    const colors = ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899'];
    return colorMap[category] || colors[category.length % colors.length];
  };

  const formatCurrency = async (amount: number) => {
    const displayCurrency = state.userPreferences?.displayCurrency || 'GHS';
    try {
      return await getFormattedAmount(amount, displayCurrency);
    } catch (error) {
      console.error('Error formatting currency:', error);
      return `₵${amount.toLocaleString()}`; // Fallback to Cedi
    }
  };

  // Get labels for chart based on time period
  const getChartLabels = () => {
    const now = new Date();
    
    if (activeTab === 'Daily') {
      // Last 7 days - show day names
      const labels = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('en', { weekday: 'short' }));
      }
      return labels;
    } else if (activeTab === 'Weekly') {
      // Last 4 weeks - show week numbers or dates
      return ['W1', 'W2', 'W3', 'W4'];
    } else if (activeTab === 'Monthly') {
      // Last 6 months - show month names
      const labels = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now);
        date.setMonth(date.getMonth() - i);
        labels.push(date.toLocaleDateString('en', { month: 'short' }));
      }
      return labels;
    }
    return [''];
  };
  
  const renderChart = () => {
    const currentData = getCurrentData();
    const maxValue = Math.max(...currentData.chartData);
    const labels = getChartLabels();
    
    // Use income colors for income chart, expense colors for expense chart
    const chartColors = selectedType === 'income' 
      ? ['#10B981', '#059669'] // Green for income
      : ['#EF4444', '#DC2626']; // Red for expenses
    
    return (
      <View style={styles.chartContainer}>
        <TouchableOpacity 
          style={styles.chartArea}
          activeOpacity={1}
          onPress={() => setSelectedBarIndex(null)}
        >
          {currentData.chartData.map((value, index) => {
            const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
            const isSelected = selectedBarIndex === index;
            return (
              <TouchableOpacity 
                key={index} 
                style={styles.chartBar}
                onPress={() => setSelectedBarIndex(selectedBarIndex === index ? null : index)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.bar, 
                  { height: `${Math.max(height, 5)}%` },
                  isSelected && styles.selectedBar
                ]}>
                  <ExpoLinearGradient
                    colors={isSelected ? ['#8B5CF6', '#7C3AED'] : chartColors}
                    style={styles.barGradient}
                  />
                </View>
                <Text style={[styles.barLabel, isSelected && styles.selectedBarLabel]}>
                  {labels[index] || ''}
                </Text>
                {isSelected && value > 0 && (
                  <View style={styles.valueTooltip}>
                    <Text style={styles.tooltipText}>
                      {formattedAmounts.categories[`bar_${index}`] || `₵${value.toFixed(2)}`}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          
          {/* Highlight point - show highest value */}
          {currentData.total > 0 && maxValue > 0 && (
            <View style={[
              styles.highlightPoint,
              { right: `${((currentData.chartData.length - 1 - currentData.chartData.indexOf(maxValue)) / currentData.chartData.length) * 100}%` }
            ]}>
              <View style={styles.highlightDot} />
              <Text style={styles.highlightAmount}>
                {formattedAmounts.chartTotal}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        
        {/* Show period info */}
        <View style={styles.periodInfo}>
          <Text style={styles.periodText}>
            {activeTab === 'Daily' && 'Last 7 days'}
            {activeTab === 'Weekly' && 'Last 4 weeks'}
            {activeTab === 'Monthly' && 'Last 6 months'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Statistics Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Statistics</Text>
        <TouchableOpacity style={styles.downloadButton}>
          <Text style={styles.downloadIcon}>⬇</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        {(['Daily', 'Weekly', 'Monthly'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && styles.activeTab
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[
              styles.tabText,
              activeTab === tab && styles.activeTabText
            ]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Income/Expense Toggle */}
      <View style={styles.toggleContainer}>
        <View style={styles.toggle}>
          <TouchableOpacity 
            style={[
              styles.toggleOption, 
              selectedType === 'income' && styles.activeToggle
            ]}
            onPress={() => setSelectedType('income')}
          >
            <Text style={[
              styles.toggleLabel, 
              selectedType === 'income' && styles.activeToggleText
            ]}>Income</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.toggleOption, 
              selectedType === 'expense' && styles.activeToggle
            ]}
            onPress={() => setSelectedType('expense')}
          >
            <Text style={[
              styles.toggleLabel, 
              selectedType === 'expense' && styles.activeToggleText
            ]}>Expenses</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chart Card */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>Total expenses</Text>
          <Text style={styles.chartAmount}>
            {formattedAmounts.chartTotal}
          </Text>
        </View>
        
        {renderChart()}
      </View>

      {/* Dynamic Breakdown */}
      <View style={styles.breakdownSection}>
        <Text style={styles.breakdownTitle}>
          {selectedType === 'income' ? 'Income' : 'Expenses'} Breakdown
        </Text>
        
        {getCurrentData().categories.length > 0 ? getCurrentData().categories.map((category, index) => (
          <View key={index} style={styles.categoryItem}>
            <View style={styles.categoryLeft}>
              <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
              <View style={styles.categoryInfo}>
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={styles.categoryDetail}>{category.detail}</Text>
              </View>
              <Text style={styles.categoryPercentage}>{category.percentage}%</Text>
            </View>
            <Text style={styles.categoryAmount}>
              {formattedAmounts.categories[category.name] || '₵0.00'}
            </Text>
          </View>
        )) : (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>
              No {selectedType} data available
            </Text>
            <Text style={styles.noDataSubtext}>
              {selectedType === 'income' ? 'Add some income transactions to see the breakdown' : 'Add some expense transactions to see the breakdown'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginBottom: 20,
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  downloadButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadIcon: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 24,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: '#8B5CF6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8B5CF6',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  toggleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 20,
    padding: 4,
    width: 200,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 16,
  },
  activeToggle: {
    backgroundColor: '#8B5CF6',
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8B5CF6',
  },
  activeToggleText: {
    color: '#FFFFFF',
  },
  chartCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  chartHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  chartAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  chartContainer: {
    height: 180,
    position: 'relative',
  },
  chartArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    paddingTop: 40,
  },
  chartBar: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 24,
    minHeight: 20,
    marginBottom: 8,
  },
  barGradient: {
    flex: 1,
    width: '100%',
    borderRadius: 12,
  },
  barLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  highlightPoint: {
    position: 'absolute',
    top: 20,
    right: 60,
    alignItems: 'center',
  },
  highlightDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B5CF6',
    marginBottom: 4,
  },
  highlightAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8B5CF6',
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  breakdownSection: {
    marginBottom: 20,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8B5CF6',
    marginBottom: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  categoryDetail: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  categoryPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginRight: 16,
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  noDataContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  noDataText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    textAlign: 'center',
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  periodInfo: {
    alignItems: 'center',
    marginTop: 12,
  },
  periodText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  selectedBar: {
    transform: [{ scale: 1.05 }],
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  selectedBarLabel: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  valueTooltip: {
    position: 'absolute',
    top: -35,
    left: '50%',
    transform: [{ translateX: -25 }],
    backgroundColor: '#1F2937',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  tooltipText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});