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
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { databaseService, Category } from '../database/schema';
import { smsListenerService } from '../services/smsListener';
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

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
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

      await db.runAsync(
        'INSERT INTO transactions (id, amount, description, category, type, merchant, date, source, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, parseFloat(amount), description, category, type, merchant || '', now, 'manual', 'GHS']
      );

      resetForm();
      setModalVisible(false);
      await refreshData();
      Alert.alert('Success', 'Transaction added successfully');
    } catch (error) {
      console.error('Failed to add transaction:', error);
      Alert.alert('Error', 'Failed to add transaction');
    }
  };

  const getFilteredCategories = (type: 'income' | 'expense') => {
    return categories.filter(cat => cat.type === type);
  };

  const testSMSParsing = async () => {
    if (!testSMS.trim()) {
      Alert.alert('Error', 'Please enter an SMS message to test');
      return;
    }

    try {
      const result = await smsListenerService.testParseSMS(testSMS, testSender);
      
      if (result) {
        Alert.alert(
          'SMS Parsed Successfully',
          `Amount: ${result.amount}\nType: ${result.type}\nDescription: ${result.description}\nCategory: ${result.category}\nMerchant: ${result.merchant || 'N/A'}`
        );
      } else {
        Alert.alert('No Match', 'The SMS message could not be parsed as a financial transaction');
      }
    } catch (error) {
      console.error('SMS parsing test failed:', error);
      Alert.alert('Error', 'Failed to test SMS parsing');
    }
  };

  const processHistoricalSMS = async () => {
    setHistoryProcessing(true);
    
    try {
      const result = await smsListenerService.processHistoricalSMS();
      setProcessingStats(result);
      Alert.alert(
        'Processing Complete',
        `Processed ${result.totalProcessed} messages\nCreated ${result.transactionsCreated} transactions`
      );
      await refreshData();
    } catch (error) {
      console.error('Historical SMS processing failed:', error);
      Alert.alert('Error', 'Failed to process historical SMS messages');
    } finally {
      setHistoryProcessing(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, fabMenuOpen && styles.fabActive]}
          onPress={() => setFabMenuOpen(!fabMenuOpen)}
        >
          <Text style={styles.fabIcon}>{fabMenuOpen ? '×' : '+'}</Text>
        </TouchableOpacity>

        {fabMenuOpen && (
          <View style={styles.fabMenu}>
            <TouchableOpacity
              style={styles.fabMenuItem}
              onPress={() => {
                setModalVisible(true);
                setFabMenuOpen(false);
              }}
            >
              <Text style={styles.fabMenuText}>Add Transaction</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.fabMenuItem}
              onPress={() => {
                setTestModalVisible(true);
                setFabMenuOpen(false);
              }}
            >
              <Text style={styles.fabMenuText}>Test SMS Parser</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.fabMenuItem}
              onPress={() => {
                setHistoryModalVisible(true);
                setFabMenuOpen(false);
              }}
            >
              <Text style={styles.fabMenuText}>Process SMS History</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Add Transaction Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Transaction</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.closeButtonText}>×</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalContent}>
                {/* Transaction Type Toggle */}
                <View style={styles.typeToggle}>
                  <TouchableOpacity
                    style={[styles.typeButton, type === 'expense' && styles.typeButtonActive]}
                    onPress={() => {
                      setType('expense');
                      setCategory('');
                    }}
                  >
                    <Text style={[styles.typeButtonText, type === 'expense' && styles.typeButtonTextActive]}>
                      Expense
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeButton, type === 'income' && styles.typeButtonActive]}
                    onPress={() => {
                      setType('income');
                      setCategory('');
                    }}
                  >
                    <Text style={[styles.typeButtonText, type === 'income' && styles.typeButtonTextActive]}>
                      Income
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Amount Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Amount *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="decimal-pad"
                  />
                </View>

                {/* Description Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Description *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Transaction description"
                    value={description}
                    onChangeText={setDescription}
                  />
                </View>

                {/* Category Selection */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Category *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.categoryContainer}>
                      {getFilteredCategories(type).map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[
                            styles.categoryChip,
                            category === cat.name && styles.categoryChipActive
                          ]}
                          onPress={() => setCategory(cat.name)}
                        >
                          <Text style={[
                            styles.categoryChipText,
                            category === cat.name && styles.categoryChipTextActive
                          ]}>
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Merchant Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Merchant (Optional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Store or service name"
                    value={merchant}
                    onChangeText={setMerchant}
                  />
                </View>
              </ScrollView>

              <TouchableOpacity style={styles.addButton} onPress={addTransaction}>
                <Text style={styles.addButtonText}>Add Transaction</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Test SMS Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={testModalVisible}
        onRequestClose={() => setTestModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Test SMS Parser</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setTestModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>SMS Sender</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Bank name or shortcode"
                  value={testSender}
                  onChangeText={setTestSender}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>SMS Message</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Enter SMS message to test parsing..."
                  value={testSMS}
                  onChangeText={setTestSMS}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.addButton} onPress={testSMSParsing}>
              <Text style={styles.addButtonText}>Test Parse SMS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SMS History Processing Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={historyModalVisible}
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Process SMS History</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setHistoryModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.historyDescription}>
                This will scan your SMS history for financial transactions and automatically add them to your budget tracker.
              </Text>

              {processingStats && (
                <View style={styles.statsContainer}>
                  <Text style={styles.statsTitle}>Last Processing Results:</Text>
                  <Text style={styles.statsText}>Messages Processed: {processingStats.totalProcessed}</Text>
                  <Text style={styles.statsText}>Transactions Created: {processingStats.transactionsCreated}</Text>
                  {processingStats.lastProcessedDate && (
                    <Text style={styles.statsText}>
                      Last Processed: {new Date(processingStats.lastProcessedDate).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              )}
            </View>

            <TouchableOpacity 
              style={[styles.addButton, historyProcessing && styles.disabledButton]} 
              onPress={processHistoricalSMS}
              disabled={historyProcessing}
            >
              <Text style={styles.addButtonText}>
                {historyProcessing ? 'Processing...' : 'Process SMS History'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    zIndex: 1000,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabActive: {
    backgroundColor: '#7C3AED',
  },
  fabIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  fabMenu: {
    position: 'absolute',
    bottom: 70,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  fabMenuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fabMenuText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    maxHeight: '90%',
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
    fontSize: 20,
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
    fontSize: 20,
    color: '#6B7280',
    fontWeight: 'bold',
  },
  modalContent: {
    paddingVertical: 20,
    maxHeight: 400,
  },
  typeToggle: {
    flexDirection: 'row',
    marginBottom: 24,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 4,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#8B5CF6',
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryChipActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  addButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
  historyDescription: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  statsContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  statsText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
});