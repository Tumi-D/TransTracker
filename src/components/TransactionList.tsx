import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  RefreshControl,
  Alert,
  Modal
} from 'react-native';
import { Transaction, databaseService } from '../database/schema';
import { useAppContext } from '../context/AppContext';

export const TransactionList: React.FC = () => {
  const { state, dispatch, refreshData } = useAppContext();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    loadTransactions();
  }, []);

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
      return date.toLocaleDateString();
    }
  };

  const formatCurrency = (amount: number) => `₵${amount.toLocaleString()}`;

  const getTransactionIcon = (category: string, type: 'income' | 'expense') => {
    if (type === 'income') return '💰';
    
    const categoryIcons: { [key: string]: string } = {
      'Food & Dining': '🍽️',
      'Transportation': '🚗',
      'Shopping': '🛍️',
      'Bills & Utilities': '📄',
      'Healthcare': '🏥',
      'Entertainment': '🎬',
      'Other Expense': '💸',
    };
    
    return categoryIcons[category] || '💸';
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <TouchableOpacity 
      style={styles.transactionCard}
      onPress={() => {
        setSelectedTransaction(item);
        setDetailModalVisible(true);
      }}
      onLongPress={() => deleteTransaction(item)}
      activeOpacity={0.7}
    >
      <View style={styles.transactionMain}>
        <View style={styles.transactionIcon}>
          <Text style={styles.iconText}>
            {getTransactionIcon(item.category, item.type)}
          </Text>
        </View>
        
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionDescription} numberOfLines={1}>
            {item.description}
          </Text>
          <View style={styles.transactionMeta}>
            <Text style={styles.categoryText}>{item.category}</Text>
            {item.merchant && (
              <Text style={styles.merchantText}> • {item.merchant}</Text>
            )}
          </View>
          {item.account && (
            <Text style={styles.accountText}>{item.account}</Text>
          )}
        </View>
        
        <View style={styles.transactionAmount}>
          <Text style={[
            styles.amountText,
            { color: item.type === 'income' ? '#27ae60' : '#e74c3c' }
          ]}>
            {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
          </Text>
          <Text style={styles.dateText}>{formatDate(item.date)}</Text>
          {item.source === 'sms' && (
            <Text style={styles.sourceTag}>SMS</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📊</Text>
      <Text style={styles.emptyTitle}>No Transactions Yet</Text>
      <Text style={styles.emptyText}>
        Your transactions will appear here automatically when SMS messages are detected
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <Text style={styles.transactionCount}>
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </Text>
      </View>
      
      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmpty}
        style={styles.list}
        contentContainerStyle={transactions.length === 0 ? styles.emptyContainer : undefined}
      />
      
      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={detailModalVisible}
          onRequestClose={() => setDetailModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Transaction Details</Text>
                <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                  <Text style={styles.closeButton}>×</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.detailContent}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount:</Text>
                  <Text style={[styles.detailValue, { color: selectedTransaction.type === 'income' ? '#27ae60' : '#e74c3c' }]}>
                    {selectedTransaction.type === 'income' ? '+' : '-'}{formatCurrency(selectedTransaction.amount)}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type:</Text>
                  <Text style={styles.detailValue}>
                    {selectedTransaction.type === 'income' ? '💰 Income' : '💸 Expense'}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Category:</Text>
                  <Text style={styles.detailValue}>{selectedTransaction.category}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Description:</Text>
                  <Text style={styles.detailValue}>{selectedTransaction.description}</Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date:</Text>
                  <Text style={styles.detailValue}>{new Date(selectedTransaction.date).toLocaleDateString()}</Text>
                </View>
                
                {selectedTransaction.merchant && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Merchant:</Text>
                    <Text style={styles.detailValue}>{selectedTransaction.merchant}</Text>
                  </View>
                )}
                
                {selectedTransaction.account && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Account:</Text>
                    <Text style={styles.detailValue}>{selectedTransaction.account}</Text>
                  </View>
                )}
                
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Source:</Text>
                  <Text style={styles.detailValue}>
                    {selectedTransaction.source === 'sms' ? '📱 SMS Auto-detected' : '✋ Manual Entry'}
                  </Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => {
                    setDetailModalVisible(false);
                    deleteTransaction(selectedTransaction);
                  }}
                >
                  <Text style={styles.deleteButtonText}>🗑️ Delete Transaction</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  transactionCount: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  list: {
    flex: 1,
  },
  transactionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  transactionMain: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ecf0f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 18,
  },
  transactionDetails: {
    flex: 1,
    marginRight: 12,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  transactionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  categoryText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  merchantText: {
    fontSize: 14,
    color: '#95a5a6',
  },
  accountText: {
    fontSize: 12,
    color: '#95a5a6',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#95a5a6',
    marginBottom: 2,
  },
  sourceTag: {
    fontSize: 10,
    color: '#3498db',
    backgroundColor: '#ebf3fd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  loadingText: {
    color: '#7f8c8d',
    fontSize: 16,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 200,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  closeButton: {
    fontSize: 24,
    color: '#95a5a6',
    fontWeight: 'bold',
  },
  detailContent: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7f8c8d',
    flex: 1,
  },
  detailValue: {
    fontSize: 16,
    color: '#2c3e50',
    flex: 2,
    textAlign: 'right',
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});