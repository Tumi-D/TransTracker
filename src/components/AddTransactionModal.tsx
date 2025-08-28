import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { databaseService, Category } from '../database/schema';
import { smsListenerService } from '../services/smsListener';
import { emailMonitorService } from '../services/emailMonitorService';
import { useAppContext } from '../context/AppContext';

export const AddTransactionModal: React.FC = () => {
  const { refreshData } = useAppContext();
  const [modalVisible, setModalVisible] = useState(false);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Form state
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [merchant, setMerchant] = useState('');
  
  // Test SMS state
  const [testSMS, setTestSMS] = useState('');
  const [testSender, setTestSender] = useState('TEST-BANK');
  
  // SMS History state
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyProcessing, setHistoryProcessing] = useState(false);
  const [processingStats, setProcessingStats] = useState<{
    totalProcessed: number;
    transactionsCreated: number;
    lastProcessedDate: string | null;
  } | null>(null);
  
  // FAB Menu state
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  
  // Gmail integration state
  const [gmailModalVisible, setGmailModalVisible] = useState(false);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [gmailStats, setGmailStats] = useState<{
    totalProcessed: number;
    transactionsCreated: number;
    lastSyncDate: string | null;
    isConnected: boolean;
  } | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      // Ensure database is initialized
      await databaseService.init();
      
      const db = await databaseService.getDatabase();
      if (!db) {
        console.error('Database not available for loading categories');
        return;
      }

      const result = await db.getAllAsync('SELECT * FROM categories ORDER BY name');
      
      if (result.length === 0) {
        console.warn('No categories found, reinitializing database...');
        await databaseService.init();
        const retryResult = await db.getAllAsync('SELECT * FROM categories ORDER BY name');
        
        if (retryResult.length === 0) {
          console.error('Still no categories found after retry');
          return;
        }
        
        const parsedCategories = retryResult.map((row: any) => ({
          ...row,
          keywords: JSON.parse(row.keywords)
        }));
        
        setCategories(parsedCategories);
        return;
      }
      
      const parsedCategories = result.map((row: any) => ({
        ...row,
        keywords: JSON.parse(row.keywords)
      }));
      
      console.log(`Loaded ${parsedCategories.length} categories (${parsedCategories.filter(c => c.type === 'income').length} income, ${parsedCategories.filter(c => c.type === 'expense').length} expense)`);
      
      setCategories(parsedCategories);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setCategory('');
    setType('expense');
    setMerchant('');
  };

  const addTransaction = async () => {
    if (!amount || !description || !category) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const db = await databaseService.getDatabase();
      if (!db) {
        Alert.alert('Error', 'Database not available');
        return;
      }

      const id = `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date().toISOString();
      const numericAmount = parseFloat(amount);
      
      console.log('Adding transaction:', {
        id, amount: numericAmount, description, category, type, merchant
      });

      await db.runAsync(
        `INSERT INTO transactions 
         (id, amount, description, category, type, source, date, merchant, isRecurring, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 'manual', ?, ?, 0, ?, ?)`,
        [id, numericAmount, description, category, type, now, merchant || null, now, now]
      );

      console.log('Transaction added successfully:', id);
      resetForm();
      setModalVisible(false);
      await refreshData();
      Alert.alert('Success', `${type === 'income' ? 'Income' : 'Expense'} transaction added successfully`);
    } catch (error) {
      console.error('Failed to add transaction:', error);
      Alert.alert('Error', `Failed to add transaction: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const testSMSParsing = async () => {
    if (!testSMS.trim()) {
      Alert.alert('Error', 'Please enter a test SMS message');
      return;
    }

    try {
      const transactionId = await smsListenerService.processTestSMS(testSMS, testSender);
      
      if (transactionId) {
        Alert.alert(
          'Success',
          'SMS parsed successfully and transaction created!',
          [{ text: 'OK', onPress: () => setTestModalVisible(false) }]
        );
        await refreshData();
      } else {
        Alert.alert('Info', 'SMS message was not recognized as a financial transaction');
      }
    } catch (error) {
      console.error('Failed to test SMS parsing:', error);
      Alert.alert('Error', 'Failed to process test SMS');
    }
  };

  const loadProcessingStats = async () => {
    try {
      const stats = await smsListenerService.getProcessingStats();
      setProcessingStats(stats);
    } catch (error) {
      console.error('Failed to load processing stats:', error);
    }
  };

  const processSMSHistory = async () => {
    try {
      setHistoryProcessing(true);
      const result = await smsListenerService.processSMSHistory();
      
      Alert.alert(
        'SMS History Processed',
        `Processed ${result.processed} messages successfully.${result.errors > 0 ? ` ${result.errors} errors occurred.` : ''}`,
        [{ 
          text: 'OK', 
          onPress: async () => {
            await refreshData();
            await loadProcessingStats();
            setHistoryModalVisible(false);
          }
        }]
      );
    } catch (error) {
      console.error('Failed to process SMS history:', error);
      Alert.alert('Error', (error instanceof Error ? error.message : String(error)) || 'Failed to process SMS history');
    } finally {
      setHistoryProcessing(false);
    }
  };

  const loadGmailStats = async () => {
    try {
      const stats = await emailMonitorService.getMonitoringStats();
      setGmailStats(stats);
    } catch (error) {
      console.error('Failed to load Gmail stats:', error);
    }
  };

  const connectGmail = async () => {
    try {
      setGmailConnecting(true);
      const success = await emailMonitorService.connectGmail();
      
      if (success) {
        Alert.alert(
          'Gmail Connected!',
          'Your email transactions will now be automatically tracked. We\'ll sync your recent financial emails.',
          [{ 
            text: 'OK', 
            onPress: async () => {
              await refreshData();
              await loadGmailStats();
              setGmailModalVisible(false);
            }
          }]
        );
      } else {
        Alert.alert('Connection Failed', 'Unable to connect to Gmail. Please try again.');
      }
    } catch (error) {
      console.error('Failed to connect Gmail:', error);
      Alert.alert('Error', (error instanceof Error ? error.message : String(error)) || 'Failed to connect Gmail');
    } finally {
      setGmailConnecting(false);
    }
  };

  const disconnectGmail = async () => {
    try {
      await emailMonitorService.disconnectGmail();
      await loadGmailStats();
      Alert.alert('Disconnected', 'Gmail has been disconnected from your budget tracker.');
    } catch (error) {
      console.error('Failed to disconnect Gmail:', error);
      Alert.alert('Error', 'Failed to disconnect Gmail');
    }
  };

  const clearDemoTransactions = async () => {
    Alert.alert(
      'Clear Demo Data',
      'This will delete all demo transactions (JANE SMITH, accounts ending 1234, etc.). Real SMS transactions will be preserved. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear Demo Data',
          style: 'destructive',
          onPress: async () => {
            try {
              const deletedCount = await databaseService.clearDemoTransactions();
              Alert.alert(
                'Demo Data Cleared',
                `Removed ${deletedCount} demo transactions. Real SMS transactions preserved.`,
                [{ 
                  text: 'OK', 
                  onPress: async () => {
                    await refreshData();
                  }
                }]
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to clear demo transactions');
              console.error('Clear demo transactions error:', error);
            }
          }
        }
      ]
    );
  };

  const removeDuplicateTransactions = async () => {
    Alert.alert(
      'Remove Duplicate Transactions',
      'This will scan for and remove duplicate transactions (same amount, type, category within 1 minute window). Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove Duplicates',
          style: 'destructive',
          onPress: async () => {
            try {
              const removedCount = await databaseService.removeDuplicateTransactions();
              Alert.alert(
                'Duplicates Removed',
                removedCount > 0 
                  ? `Removed ${removedCount} duplicate transactions.`
                  : 'No duplicate transactions found.',
                [{ 
                  text: 'OK', 
                  onPress: async () => {
                    await refreshData();
                  }
                }]
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to remove duplicate transactions');
              console.error('Remove duplicates error:', error);
            }
          }
        }
      ]
    );
  };

  const syncEmails = async () => {
    try {
      setGmailConnecting(true);
      const result = await emailMonitorService.manualSync();
      
      Alert.alert(
        'Email Sync Complete',
        `Processed ${result.processed} emails. ${result.transactionsCreated} new transactions created.${result.errors > 0 ? ` ${result.errors} errors occurred.` : ''}`,
        [{ 
          text: 'OK', 
          onPress: async () => {
            await refreshData();
            await loadGmailStats();
          }
        }]
      );
    } catch (error) {
      console.error('Failed to sync emails:', error);
      Alert.alert('Error', (error instanceof Error ? error.message : String(error)) || 'Failed to sync emails');
    } finally {
      setGmailConnecting(false);
    }
  };

  const categoryOptions = categories.filter(c => c.type === type);
  
  // Only log on significant changes to avoid spam
  useEffect(() => {
    if (categories.length > 0 && categoryOptions.length === 0) {
      console.log(`No ${type} categories found despite having ${categories.length} total categories`);
    }
  }, [type, categories, categoryOptions]);

  return (
    <>
      {/* Floating Action Button Menu */}
      <View style={styles.fabContainer}>
        {/* Sub FABs - only show when menu is open */}
        {fabMenuOpen && (
          <>
            <TouchableOpacity
              style={[styles.subFab, styles.gmailFab, { bottom: 250 }]}
              onPress={() => {
                setGmailModalVisible(true);
                loadGmailStats();
                setFabMenuOpen(false);
              }}
            >
              <Text style={styles.subFabText}>📧</Text>
            </TouchableOpacity>
            <Text style={[styles.fabLabel, { bottom: 255 }]}>Gmail Sync</Text>
            
            <TouchableOpacity
              style={[styles.subFab, styles.historyFab, { bottom: 200 }]}
              onPress={() => {
                setHistoryModalVisible(true);
                loadProcessingStats();
                setFabMenuOpen(false);
              }}
            >
              <Text style={styles.subFabText}>📋</Text>
            </TouchableOpacity>
            <Text style={[styles.fabLabel, { bottom: 205 }]}>SMS History</Text>
            
            <TouchableOpacity
              style={[styles.subFab, styles.testFab, { bottom: 150 }]}
              onPress={() => {
                setTestModalVisible(true);
                setFabMenuOpen(false);
              }}
            >
              <Text style={styles.subFabText}>📱</Text>
            </TouchableOpacity>
            <Text style={[styles.fabLabel, { bottom: 155 }]}>Test SMS</Text>
            
            <TouchableOpacity
              style={[styles.subFab, styles.clearFab, { bottom: 125 }]}
              onPress={() => {
                clearDemoTransactions();
                setFabMenuOpen(false);
              }}
            >
              <Text style={styles.subFabText}>🗑️</Text>
            </TouchableOpacity>
            <Text style={[styles.fabLabel, { bottom: 130 }]}>Clear Demo</Text>

            <TouchableOpacity
              style={[styles.subFab, styles.duplicateFab, { bottom: 75 }]}
              onPress={() => {
                removeDuplicateTransactions();
                setFabMenuOpen(false);
              }}
            >
              <Text style={styles.subFabText}>🔍</Text>
            </TouchableOpacity>
            <Text style={[styles.fabLabel, { bottom: 80 }]}>Remove Duplicates</Text>
            
            <TouchableOpacity
              style={[styles.subFab, { bottom: 25 }]}
              onPress={() => {
                setModalVisible(true);
                setFabMenuOpen(false);
              }}
            >
              <Text style={styles.subFabText}>+</Text>
            </TouchableOpacity>
            <Text style={[styles.fabLabel, { bottom: 30 }]}>Add Transaction</Text>
          </>
        )}
        
        {/* Main FAB */}
        <TouchableOpacity
          style={[styles.mainFab, fabMenuOpen && styles.mainFabRotated]}
          onPress={() => setFabMenuOpen(!fabMenuOpen)}
        >
          <Text style={styles.fabText}>{fabMenuOpen ? '×' : '⋮'}</Text>
        </TouchableOpacity>
      </View>

      {/* Add Transaction Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Transaction</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              {/* Transaction Type */}
              <Text style={styles.label}>Type</Text>
              <View style={styles.typeContainer}>
                <TouchableOpacity
                  style={[styles.typeButton, type === 'expense' && styles.typeButtonActive]}
                  onPress={() => {setType('expense'); setCategory('')}}
                >
                  <Text style={[styles.typeButtonText, type === 'expense' && styles.typeButtonTextActive]}>
                    💸 Expense
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, type === 'income' && styles.typeButtonActive]}
                  onPress={() => {setType('income'); setCategory('')}}
                >
                  <Text style={[styles.typeButtonText, type === 'income' && styles.typeButtonTextActive]}>
                    💰 Income
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Amount */}
              <Text style={styles.label}>Amount (₵) *</Text>
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                keyboardType="numeric"
              />

              {/* Description */}
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="Enter transaction description"
                multiline
              />

              {/* Category */}
              <Text style={styles.label}>Category *</Text>
              {categoryOptions.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {categoryOptions.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        category === cat.name && styles.categoryChipActive,
                        { borderColor: cat.color }
                      ]}
                      onPress={() => setCategory(cat.name)}
                    >
                      <Text style={[
                        styles.categoryChipText,
                        category === cat.name && { color: cat.color }
                      ]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.categoryEmptyState}>
                  <Text style={styles.categoryEmptyText}>
                    No categories available for {type}. Please wait while categories are being loaded...
                  </Text>
                </View>
              )}

              {/* Merchant */}
              <Text style={styles.label}>Merchant/Source</Text>
              <TextInput
                style={styles.input}
                value={merchant}
                onChangeText={setMerchant}
                placeholder="Optional"
              />

              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addButton} onPress={addTransaction}>
                  <Text style={styles.addButtonText}>Add Transaction</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Test SMS Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={testModalVisible}
        onRequestClose={() => setTestModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Test SMS Parser</Text>
              <TouchableOpacity onPress={() => setTestModalVisible(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>SMS Sender</Text>
              <TextInput
                style={styles.input}
                value={testSender}
                onChangeText={setTestSender}
                placeholder="TEST-BANK"
              />

              <Text style={styles.label}>SMS Message</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={testSMS}
                onChangeText={setTestSMS}
                placeholder="Enter a test SMS message like: 'Dear Customer, Rs. 500 has been debited from your account at AMAZON on 12-Jan-2024'"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text style={styles.helperText}>
                Try examples like:{'\n'}
                • "GHS 1500 spent at McDonald's using card ending 1234"{'\n'}
                • "Your account has been credited with GHS 5000 salary"{'\n'}
                • "Mobile payment of GHS 250 to restaurant successful"
              </Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setTestModalVisible(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addButton} onPress={testSMSParsing}>
                  <Text style={styles.addButtonText}>Test Parse</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* SMS History Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={historyModalVisible}
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>SMS History Processing</Text>
              <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Current Statistics</Text>
              {processingStats ? (
                <View style={styles.statsContainer}>
                  <Text style={styles.statText}>Total SMS Processed: {processingStats.totalProcessed}</Text>
                  <Text style={styles.statText}>Transactions Created: {processingStats.transactionsCreated}</Text>
                  <Text style={styles.statText}>
                    Last Processed: {processingStats.lastProcessedDate 
                      ? new Date(processingStats.lastProcessedDate).toLocaleDateString()
                      : 'Never'
                    }
                  </Text>
                </View>
              ) : (
                <Text style={styles.statText}>Loading statistics...</Text>
              )}

              <Text style={styles.helperText}>
                This will process SMS messages from the last 30 days and automatically create transactions for financial messages. Duplicates will be skipped.
              </Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setHistoryModalVisible(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.addButton, historyProcessing && styles.disabledButton]} 
                  onPress={processSMSHistory}
                  disabled={historyProcessing}
                >
                  <Text style={styles.addButtonText}>
                    {historyProcessing ? 'Processing...' : 'Process History'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Gmail Integration Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={gmailModalVisible}
        onRequestClose={() => setGmailModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gmail Integration</Text>
              <TouchableOpacity onPress={() => setGmailModalVisible(false)}>
                <Text style={styles.closeButton}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Email Transaction Tracking</Text>
              
              {gmailStats ? (
                <View style={styles.statsContainer}>
                  <Text style={[styles.statText, { color: gmailStats.isConnected ? '#27ae60' : '#e74c3c' }]}>
                    Status: {gmailStats.isConnected ? '✅ Connected' : '❌ Disconnected'}
                  </Text>
                  <Text style={styles.statText}>Emails Processed: {gmailStats.totalProcessed}</Text>
                  <Text style={styles.statText}>Transactions Created: {gmailStats.transactionsCreated}</Text>
                  <Text style={styles.statText}>
                    Last Sync: {gmailStats.lastSyncDate 
                      ? new Date(gmailStats.lastSyncDate).toLocaleString()
                      : 'Never'
                    }
                  </Text>
                </View>
              ) : (
                <Text style={styles.statText}>Loading Gmail status...</Text>
              )}

              <Text style={styles.helperText}>
                📧 Connect your Gmail to automatically detect financial transactions from:
                {"\n"}• Bank notifications and statements
                {"\n"}• Payment receipts (PayPal, Stripe, etc.)
                {"\n"}• Bill payments and invoices
                {"\n"}• Purchase confirmations
                {"\n"}\n🔒 We only read financial emails - your privacy is protected.
              </Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={() => setGmailModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                {gmailStats?.isConnected ? (
                  <>
                    <TouchableOpacity 
                      style={[styles.addButton, { backgroundColor: '#f39c12' }]}
                      onPress={syncEmails}
                      disabled={gmailConnecting}
                    >
                      <Text style={styles.addButtonText}>
                        {gmailConnecting ? 'Syncing...' : 'Sync Now'}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.addButton, { backgroundColor: '#e74c3c' }]}
                      onPress={disconnectGmail}
                    >
                      <Text style={styles.addButtonText}>Disconnect</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity 
                    style={[styles.addButton, gmailConnecting && styles.disabledButton]} 
                    onPress={connectGmail}
                    disabled={gmailConnecting}
                  >
                    <Text style={styles.addButtonText}>
                      {gmailConnecting ? 'Connecting...' : 'Connect Gmail'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 100, // Moved up to avoid bottom navigation
    right: 16,
    alignItems: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    marginBottom: 8,
  },
  testFab: {
    backgroundColor: '#9b59b6',
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  historyFab: {
    backgroundColor: '#e67e22',
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  gmailFab: {
    backgroundColor: '#34495e',
  },
  fabText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 16,
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
  form: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 80,
  },
  typeContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: '#3498db',
    backgroundColor: '#ebf3fd',
  },
  typeButtonText: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  typeButtonTextActive: {
    color: '#3498db',
    fontWeight: '600',
  },
  categoryScroll: {
    marginBottom: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 20,
    marginRight: 8,
    borderColor: '#bdc3c7',
  },
  categoryChipActive: {
    backgroundColor: '#f8f9fa',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bdc3c7',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  addButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#3498db',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    color: '#7f8c8d',
    lineHeight: 16,
    marginTop: 8,
    fontStyle: 'italic',
  },
  statsContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  statText: {
    fontSize: 14,
    color: '#2c3e50',
    marginBottom: 4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  mainFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  mainFabRotated: {
    backgroundColor: '#e74c3c',
  },
  subFab: {
    position: 'absolute',
    right: 4,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabLabel: {
    position: 'absolute',
    right: 60,
    backgroundColor: '#2c3e50',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '500',
  },
  subFabText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  categoryEmptyState: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryEmptyText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  clearFab: {
    backgroundColor: '#e74c3c',
  },
  duplicateFab: {
    backgroundColor: '#f39c12',
  },
});