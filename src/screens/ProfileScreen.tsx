import React, { useState, useEffect } from 'react';
import { 
  ScrollView,
  SafeAreaView, 
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal
} from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppContext } from '../context/AppContext';
import { smsListenerService } from '../services/smsListener';
import { databaseService } from '../database/schema';
import { currencyService } from '../services/currencyService';

export const ProfileScreen: React.FC = () => {
  const { state, refreshData } = useAppContext();
  const [smsMonitoring, setSmsMonitoring] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [isUpdatingRates, setIsUpdatingRates] = useState(false);
  const [showCurrencySettings, setShowCurrencySettings] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [hasPin, setHasPin] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<'set' | 'change' | 'remove'>('set');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const savedUserName = await AsyncStorage.getItem('userName');
      const savedUserEmail = await AsyncStorage.getItem('userEmail');
      const savedUserPin = await AsyncStorage.getItem('userPin');
      
      setUserName(savedUserName || 'User');
      setUserEmail(savedUserEmail || '');
      setHasPin(!!savedUserPin);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  // Get user info
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const handlePinAction = (mode: 'set' | 'change' | 'remove') => {
    setPinModalMode(mode);
    setShowPinModal(true);
  };

  const handleResetApp = () => {
    Alert.alert(
      'Reset App',
      'This will clear all your data and settings. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              // You might want to navigate to the first-time setup or reload the app
              Alert.alert('Success', 'App has been reset. Please restart the app.');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset app. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleClearDemoData = async () => {
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
                `Removed ${deletedCount} demo transactions. Real SMS transactions preserved.`
              );
              await refreshData();
            } catch (error) {
              Alert.alert('Error', 'Failed to clear demo transactions');
            }
          }
        }
      ]
    );
  };

  const handleRemoveDuplicates = async () => {
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
                  : 'No duplicate transactions found.'
              );
              await refreshData();
            } catch (error) {
              Alert.alert('Error', 'Failed to remove duplicate transactions');
            }
          }
        }
      ]
    );
  };

  const handleProcessSMSHistory = async () => {
    try {
      const result = await smsListenerService.processSMSHistory();
      Alert.alert(
        'SMS History Processed',
        `Processed ${result.processed} messages successfully.${result.errors > 0 ? ` ${result.errors} errors occurred.` : ''}`
      );
      await refreshData();
    } catch (error) {
      Alert.alert('Error', 'Failed to process SMS history');
    }
  };

  const handleUpdateExchangeRates = async () => {
    try {
      setIsUpdatingRates(true);
      const success = await currencyService.updateExchangeRates();
      
      if (success) {
        await refreshData();
        Alert.alert('Success', 'Exchange rates updated successfully');
      } else {
        Alert.alert('Error', 'Failed to update exchange rates. Please try again later.');
      }
    } catch (error) {
      console.error('Error updating rates:', error);
      Alert.alert('Error', 'Failed to update exchange rates');
    } finally {
      setIsUpdatingRates(false);
    }
  };

  const handleCurrencyChange = async (type: 'base' | 'display', newCurrency: string) => {
    try {
      const db = await databaseService.getDatabase();
      if (!db) return;

      const field = type === 'base' ? 'baseCurrency' : 'displayCurrency';
      await db.runAsync(
        `UPDATE user_preferences SET ${field} = ?, updatedAt = ? WHERE id = ?`,
        [newCurrency, new Date().toISOString(), state.userPreferences?.id]
      );

      await refreshData();
      Alert.alert('Success', `${type === 'base' ? 'Base' : 'Display'} currency changed to ${newCurrency}`);
    } catch (error) {
      console.error(`Error updating ${type} currency:`, error);
      Alert.alert('Error', `Failed to update ${type} currency`);
    }
  };

  const handleToggleMultipleCurrencies = async (value: boolean) => {
    try {
      const db = await databaseService.getDatabase();
      if (!db) return;

      await db.runAsync(
        'UPDATE user_preferences SET showMultipleCurrencies = ?, updatedAt = ? WHERE id = ?',
        [value ? 1 : 0, new Date().toISOString(), state.userPreferences?.id]
      );

      await refreshData();
    } catch (error) {
      console.error('Error updating multi-currency setting:', error);
      Alert.alert('Error', 'Failed to update setting');
    }
  };



  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Header */}
        <ExpoLinearGradient
          colors={['#8B5CF6', '#A855F7']}
          style={styles.profileHeader}
        >
          <View style={styles.profileInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userInitials}</Text>
            </View>
            <Text style={styles.profileName}>{userName}</Text>
            {userEmail && <Text style={styles.profileEmail}>{userEmail}</Text>}
            
            <TouchableOpacity style={styles.signOutButton} onPress={handleResetApp}>
              <Text style={styles.signOutButtonText}>Reset App</Text>
            </TouchableOpacity>
          </View>
        </ExpoLinearGradient>

        {/* Security Settings */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Security</Text>
          
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => handlePinAction(hasPin ? 'change' : 'set')}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>
                {hasPin ? 'Change PIN' : 'Set PIN'}
              </Text>
              <Text style={styles.settingDescription}>
                {hasPin ? 'Update your 4-digit PIN' : 'Set a 4-digit PIN for security'}
              </Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>

          {hasPin && (
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => handlePinAction('remove')}
            >
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: '#EF4444' }]}>Remove PIN</Text>
                <Text style={styles.settingDescription}>Disable PIN protection</Text>
              </View>
              <Text style={styles.actionChevron}>›</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Currency Settings */}
        <View style={styles.settingsSection}>
          <TouchableOpacity 
            style={styles.sectionHeader}
            onPress={() => setShowCurrencySettings(!showCurrencySettings)}
          >
            <Text style={styles.sectionTitle}>Currency Settings</Text>
            <Text style={[styles.sectionChevron, showCurrencySettings && styles.sectionChevronOpen]}>›</Text>
          </TouchableOpacity>
          
          {showCurrencySettings && (
            <>
              {/* Base Currency Selection */}
              <View style={styles.currencySection}>
                <Text style={styles.currencyTitle}>Base Currency</Text>
                <Text style={styles.currencyDescription}>Primary currency for calculations</Text>
                
                <View style={styles.currencyOptions}>
                  {state.currencies.slice(0, 6).map(currency => (
                    <TouchableOpacity
                      key={currency.code}
                      style={[
                        styles.currencyOption,
                        currency.code === state.userPreferences?.baseCurrency && styles.selectedCurrencyOption
                      ]}
                      onPress={() => handleCurrencyChange('base', currency.code)}
                    >
                      <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                      <Text style={[
                        styles.currencyCode,
                        currency.code === state.userPreferences?.baseCurrency && styles.selectedCurrencyText
                      ]}>
                        {currency.code}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Display Currency Selection */}
              <View style={styles.currencySection}>
                <Text style={styles.currencyTitle}>Display Currency</Text>
                <Text style={styles.currencyDescription}>Currency for totals and balances</Text>
                
                <View style={styles.currencyOptions}>
                  {state.currencies.slice(0, 6).map(currency => (
                    <TouchableOpacity
                      key={currency.code}
                      style={[
                        styles.currencyOption,
                        currency.code === state.userPreferences?.displayCurrency && styles.selectedCurrencyOption
                      ]}
                      onPress={() => handleCurrencyChange('display', currency.code)}
                    >
                      <Text style={styles.currencySymbol}>{currency.symbol}</Text>
                      <Text style={[
                        styles.currencyCode,
                        currency.code === state.userPreferences?.displayCurrency && styles.selectedCurrencyText
                      ]}>
                        {currency.code}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Multi-Currency Toggle */}
              <View style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Show Multiple Currencies</Text>
                  <Text style={styles.settingDescription}>Display breakdown by currency</Text>
                </View>
                <Switch
                  value={state.userPreferences?.showMultipleCurrencies || false}
                  onValueChange={handleToggleMultipleCurrencies}
                  trackColor={{ false: '#E5E7EB', true: '#8B5CF6' }}
                  thumbColor={state.userPreferences?.showMultipleCurrencies ? '#FFFFFF' : '#F3F4F6'}
                />
              </View>

              {/* Exchange Rates */}
              <View style={styles.ratesSection}>
                <View style={styles.ratesHeader}>
                  <Text style={styles.currencyTitle}>Exchange Rates</Text>
                  <TouchableOpacity 
                    style={styles.updateRatesButton}
                    onPress={handleUpdateExchangeRates}
                    disabled={isUpdatingRates}
                  >
                    <Text style={styles.updateRatesText}>
                      {isUpdatingRates ? 'Updating...' : 'Update'}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.ratesList}>
                  {state.currencies
                    .filter(c => c.code !== state.userPreferences?.baseCurrency)
                    .slice(0, 3)
                    .map(currency => (
                      <View key={currency.code} style={styles.rateItem}>
                        <Text style={styles.rateSymbol}>{currency.symbol}</Text>
                        <Text style={styles.rateCode}>{currency.code}</Text>
                        <Text style={styles.rateValue}>{currency.exchangeRate.toFixed(2)}</Text>
                      </View>
                    ))
                  }
                </View>
                
                {state.currencies.length > 0 && (
                  <Text style={styles.rateUpdateTime}>
                    Updated: {new Date(state.currencies[0]?.lastUpdated).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </>
          )}
        </View>

        {/* App Settings */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>App Settings</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>SMS Monitoring</Text>
              <Text style={styles.settingDescription}>Automatically track SMS transactions</Text>
            </View>
            <Switch
              value={smsMonitoring}
              onValueChange={setSmsMonitoring}
              trackColor={{ false: '#E5E7EB', true: '#8B5CF6' }}
              thumbColor={smsMonitoring ? '#FFFFFF' : '#F3F4F6'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Notifications</Text>
              <Text style={styles.settingDescription}>Get alerts for new transactions</Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: '#E5E7EB', true: '#8B5CF6' }}
              thumbColor={notifications ? '#FFFFFF' : '#F3F4F6'}
            />
          </View>
        </View>


        {/* Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <TouchableOpacity style={styles.actionButton} onPress={handleProcessSMSHistory}>
            <View style={[styles.actionIcon, { backgroundColor: '#F59E0B' }]}>
              <Text style={styles.actionIconText}>📋</Text>
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionLabel}>Process SMS History</Text>
              <Text style={styles.actionDescription}>Scan SMS from last 3 months</Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleClearDemoData}>
            <View style={[styles.actionIcon, { backgroundColor: '#EF4444' }]}>
              <Text style={styles.actionIconText}>🗑️</Text>
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionLabel}>Clear Demo Data</Text>
              <Text style={styles.actionDescription}>Remove test transactions</Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleRemoveDuplicates}>
            <View style={[styles.actionIcon, { backgroundColor: '#06B6D4' }]}>
              <Text style={styles.actionIconText}>🔍</Text>
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.actionLabel}>Remove Duplicates</Text>
              <Text style={styles.actionDescription}>Clean duplicate transactions</Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.infoSection}>
          <Text style={styles.appVersion}>Budget Tracker v1.0.0</Text>
          <Text style={styles.appDescription}>
            Automatically track your finances through SMS and email monitoring
          </Text>
        </View>
      </ScrollView>
      
      <PinModal
        visible={showPinModal}
        mode={pinModalMode}
        onClose={() => setShowPinModal(false)}
        onSuccess={() => {
          setShowPinModal(false);
          loadUserData();
        }}
      />
    </SafeAreaView>
  );
};

const PinModal: React.FC<{
  visible: boolean;
  mode: 'set' | 'change' | 'remove';
  onClose: () => void;
  onSuccess: () => void;
}> = ({ visible, mode, onClose, onSuccess }) => {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const handleClose = () => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    onClose();
  };

  const handleSubmit = async () => {
    if (mode === 'remove') {
      const savedPin = await AsyncStorage.getItem('userPin');
      if (currentPin !== savedPin) {
        Alert.alert('Error', 'Current PIN is incorrect');
        return;
      }
      await AsyncStorage.removeItem('userPin');
      Alert.alert('Success', 'PIN has been removed');
      onSuccess();
      return;
    }

    if (mode === 'change') {
      const savedPin = await AsyncStorage.getItem('userPin');
      if (currentPin !== savedPin) {
        Alert.alert('Error', 'Current PIN is incorrect');
        return;
      }
    }

    if (newPin.length !== 4) {
      Alert.alert('Error', 'PIN must be exactly 4 digits');
      return;
    }

    if (newPin !== confirmPin) {
      Alert.alert('Error', 'PINs do not match');
      return;
    }

    try {
      await AsyncStorage.setItem('userPin', newPin);
      Alert.alert('Success', mode === 'set' ? 'PIN has been set' : 'PIN has been changed');
      onSuccess();
    } catch (error) {
      Alert.alert('Error', 'Failed to save PIN');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.pinModalContainer}>
        <View style={styles.pinModalHeader}>
          <TouchableOpacity onPress={handleClose}>
            <Text style={styles.pinModalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.pinModalTitle}>
            {mode === 'set' ? 'Set PIN' : mode === 'change' ? 'Change PIN' : 'Remove PIN'}
          </Text>
          <View style={styles.pinModalSpacing} />
        </View>

        <View style={styles.pinModalContent}>
          {(mode === 'change' || mode === 'remove') && (
            <View style={styles.pinInputSection}>
              <Text style={styles.pinInputLabel}>Current PIN</Text>
              <TextInput
                style={styles.pinInput}
                value={currentPin}
                onChangeText={(text) => setCurrentPin(text.replace(/\D/g, '').slice(0, 4))}
                keyboardType="numeric"
                secureTextEntry
                maxLength={4}
                placeholder="Enter current PIN"
              />
            </View>
          )}

          {mode !== 'remove' && (
            <>
              <View style={styles.pinInputSection}>
                <Text style={styles.pinInputLabel}>New PIN</Text>
                <TextInput
                  style={styles.pinInput}
                  value={newPin}
                  onChangeText={(text) => setNewPin(text.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={4}
                  placeholder="Enter new PIN"
                />
              </View>

              <View style={styles.pinInputSection}>
                <Text style={styles.pinInputLabel}>Confirm PIN</Text>
                <TextInput
                  style={styles.pinInput}
                  value={confirmPin}
                  onChangeText={(text) => setConfirmPin(text.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={4}
                  placeholder="Confirm new PIN"
                />
              </View>
            </>
          )}

          <TouchableOpacity style={styles.pinSubmitButton} onPress={handleSubmit}>
            <Text style={styles.pinSubmitText}>
              {mode === 'set' ? 'Set PIN' : mode === 'change' ? 'Change PIN' : 'Remove PIN'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Space for bottom navigation
  },
  profileHeader: {
    paddingVertical: 32,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 24,
  },
  profileInfo: {
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 16,
  },
  signOutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  signOutButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  settingsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  settingItem: {
    flexDirection: 'row',
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
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  actionsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
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
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionIconText: {
    fontSize: 18,
  },
  actionInfo: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  actionChevron: {
    fontSize: 18,
    color: '#9CA3AF',
    fontWeight: 'bold',
  },
  infoSection: {
    paddingHorizontal: 20,
    alignItems: 'center',
    paddingVertical: 24,
  },
  appVersion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  appDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionChevron: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: 'bold',
    transform: [{ rotate: '0deg' }],
  },
  sectionChevronOpen: {
    transform: [{ rotate: '90deg' }],
  },
  currencySection: {
    marginBottom: 20,
  },
  currencyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  currencyDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  currencyOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  currencyOption: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedCurrencyOption: {
    backgroundColor: '#EEF2FF',
    borderColor: '#8B5CF6',
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8B5CF6',
    marginBottom: 4,
  },
  currencyCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  selectedCurrencyText: {
    color: '#8B5CF6',
  },
  ratesSection: {
    marginTop: 16,
  },
  ratesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  updateRatesButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  updateRatesText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ratesList: {
    gap: 8,
  },
  rateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 8,
  },
  rateSymbol: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#8B5CF6',
    marginRight: 8,
    minWidth: 20,
  },
  rateCode: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1F2937',
    flex: 1,
  },
  rateValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  rateUpdateTime: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  pinModalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  pinModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  pinModalCancel: {
    fontSize: 16,
    color: '#8B5CF6',
  },
  pinModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  pinModalSpacing: {
    width: 50,
  },
  pinModalContent: {
    padding: 20,
  },
  pinInputSection: {
    marginBottom: 24,
  },
  pinInputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  pinInput: {
    height: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 8,
  },
  pinSubmitButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  pinSubmitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});