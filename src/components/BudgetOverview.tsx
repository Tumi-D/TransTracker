import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useAppContext } from '../context/AppContext';

export const BudgetOverview: React.FC = () => {
  const { state } = useAppContext();
  const { budgetSummary, categorySpending, isLoading } = state;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading budget overview...</Text>
      </View>
    );
  }
  
  // Show empty state if no budget data
  if (!budgetSummary || budgetSummary.activeBudgets === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Active Budgets</Text>
          <Text style={styles.emptyText}>
            Create your first budget to start tracking your spending and see insights here.
          </Text>
        </View>
      </View>
    );
  }

  const formatCurrency = (amount: number) => `₵${amount.toLocaleString()}`;
  const getProgressColor = (percentage: number) => {
    if (percentage > 100) return '#e74c3c';
    if (percentage > 80) return '#f39c12';
    return '#27ae60';
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.budgetCard]}>
          <Text style={styles.summaryAmount}>{formatCurrency(budgetSummary.totalBudget)}</Text>
          <Text style={styles.summaryLabel}>Total Budget</Text>
        </View>
        
        <View style={[styles.summaryCard, styles.spentCard]}>
          <Text style={styles.summaryAmount}>{formatCurrency(budgetSummary.totalSpent)}</Text>
          <Text style={styles.summaryLabel}>Total Spent</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.remainingCard]}>
          <Text style={styles.summaryAmount}>{formatCurrency(budgetSummary.remainingBudget)}</Text>
          <Text style={styles.summaryLabel}>Remaining</Text>
        </View>
        
        <View style={[styles.summaryCard, styles.percentageCard]}>
          <Text style={styles.summaryAmount}>{budgetSummary.percentageUsed.toFixed(1)}%</Text>
          <Text style={styles.summaryLabel}>Used</Text>
        </View>
      </View>

      {/* Budget Status */}
      {budgetSummary.exceededBudgets > 0 && (
        <View style={styles.alertCard}>
          <Text style={styles.alertText}>
            ⚠️ {budgetSummary.exceededBudgets} budget{budgetSummary.exceededBudgets > 1 ? 's' : ''} exceeded
          </Text>
        </View>
      )}

      {/* Category Breakdown */}
      <View style={styles.categorySection}>
        <Text style={styles.sectionTitle}>Category Breakdown</Text>
        
        {categorySpending.map((category, index) => (
          <TouchableOpacity key={index} style={styles.categoryCard}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryName}>{category.category}</Text>
              <Text style={[
                styles.categoryPercentage,
                { color: getProgressColor(category.percentageUsed) }
              ]}>
                {category.percentageUsed.toFixed(1)}%
              </Text>
            </View>
            
            <View style={styles.categoryAmounts}>
              <Text style={styles.categorySpent}>
                {formatCurrency(category.spent)} of {formatCurrency(category.budgeted)}
              </Text>
              <Text style={[
                styles.categoryRemaining,
                { color: category.isExceeded ? '#e74c3c' : '#27ae60' }
              ]}>
                {category.isExceeded ? 'Exceeded by ' : 'Remaining: '}
                {formatCurrency(Math.abs(category.remaining))}
              </Text>
            </View>
            
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  { 
                    width: `${Math.min(category.percentageUsed, 100)}%`,
                    backgroundColor: getProgressColor(category.percentageUsed)
                  }
                ]} 
              />
            </View>
            
            <Text style={styles.transactionCount}>
              {category.transactionCount} transaction{category.transactionCount !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        ))}
        
        {categorySpending.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No active budgets found</Text>
            <Text style={styles.emptySubtext}>Create a budget to start tracking your spending</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginBottom: 16,
  },
  loadingText: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontSize: 16,
    marginVertical: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  budgetCard: {
    backgroundColor: '#3498db',
  },
  spentCard: {
    backgroundColor: '#e74c3c',
  },
  remainingCard: {
    backgroundColor: '#27ae60',
  },
  percentageCard: {
    backgroundColor: '#f39c12',
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
  },
  alertCard: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  alertText: {
    color: '#856404',
    fontWeight: '600',
  },
  categorySection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  categoryCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  categoryPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  categoryAmounts: {
    marginBottom: 8,
  },
  categorySpent: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  categoryRemaining: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#ecf0f1',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  transactionCount: {
    fontSize: 12,
    color: '#95a5a6',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 20,
  },
});