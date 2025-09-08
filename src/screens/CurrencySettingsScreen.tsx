import React, { useState, useEffect } from 'react';
import { 
  SafeAreaView,
  ScrollView,
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator
} from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { useAppContext } from '../context/AppContext';
import { currencyService } from '../services/currencyService';
import { databaseService } from '../database/schema';

export const CurrencySettingsScreen: React.FC = () => {
  const { state, refreshData } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingRates, setIsUpdatingRates] = useState(false);

  const handleBaseCurrencyChange = async (newBaseCurrency: string) => {
    try {
      const db = await databaseService.getDatabase();
      if (!db) return;

      await db.runAsync(
        'UPDATE user_preferences SET baseCurrency = ?, updatedAt = ? WHERE id = ?',
        [newBaseCurrency, new Date().toISOString(), state.userPreferences?.id]
      );

      await refreshData();
      Alert.alert('Success', `Base currency changed to ${newBaseCurrency}`);
    } catch (error) {
      console.error('Error updating base currency:', error);
      Alert.alert('Error', 'Failed to update base currency');
    }
  };

  const handleDisplayCurrencyChange = async (newDisplayCurrency: string) => {
    try {
      const db = await databaseService.getDatabase();
      if (!db) return;

      await db.runAsync(
        'UPDATE user_preferences SET displayCurrency = ?, updatedAt = ? WHERE id = ?',
        [newDisplayCurrency, new Date().toISOString(), state.userPreferences?.id]
      );

      await refreshData();
      Alert.alert('Success', `Display currency changed to ${newDisplayCurrency}`);
    } catch (error) {
      console.error('Error updating display currency:', error);
      Alert.alert('Error', 'Failed to update display currency');
    }
  };

  const handleShowMultipleCurrenciesToggle = async (value: boolean) => {
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

  const handleAutoConvertToggle = async (value: boolean) => {
    try {
      const db = await databaseService.getDatabase();
      if (!db) return;

      await db.runAsync(
        'UPDATE user_preferences SET autoConvert = ?, updatedAt = ? WHERE id = ?',
        [value ? 1 : 0, new Date().toISOString(), state.userPreferences?.id]
      );

      await refreshData();
    } catch (error) {
      console.error('Error updating auto-convert setting:', error);
      Alert.alert('Error', 'Failed to update setting');
    }
  };

  const handleUpdateRatesFrequencyChange = async (frequency: string) => {
    try {
      const db = await databaseService.getDatabase();
      if (!db) return;

      await db.runAsync(
        'UPDATE user_preferences SET updateRatesFrequency = ?, updatedAt = ? WHERE id = ?',
        [frequency, new Date().toISOString(), state.userPreferences?.id]
      );

      await refreshData();
      Alert.alert('Success', `Update frequency changed to ${frequency}`);
    } catch (error) {
      console.error('Error updating rates frequency:', error);
      Alert.alert('Error', 'Failed to update frequency');
    }
  };

  const handleManualRateUpdate = async () => {
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
      console.error('Error updating rates manually:', error);
      Alert.alert('Error', 'Failed to update exchange rates');
    } finally {
      setIsUpdatingRates(false);
    }
  };

  const renderCurrencyOption = (currency: any, isSelected: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={currency.code}
      style={[styles.currencyOption, isSelected && styles.selectedCurrency]}
      onPress={onPress}
    >
      <View style={styles.currencyInfo}>
        <Text style={styles.currencySymbol}>{currency.symbol}</Text>
        <View style={styles.currencyDetails}>
          <Text style={styles.currencyCode}>{currency.code}</Text>
          <Text style={styles.currencyName}>{currency.name}</Text>
        </View>
      </View>
      {isSelected && (
        <View style={styles.checkmark}>
          <Text style={styles.checkmarkText}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <ExpoLinearGradient
          colors={['#8B5CF6', '#A855F7']}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Currency Settings</Text>
          <Text style={styles.headerSubtitle}>Manage your multi-currency preferences</Text>
        </ExpoLinearGradient>

        {/* Base Currency Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Base Currency</Text>
          <Text style={styles.sectionDescription}>
            Your primary currency for calculations and conversions
          </Text>
          
          <View style={styles.currencyList}>
            {state.currencies.map(currency => 
              renderCurrencyOption(
                currency, 
                currency.code === state.userPreferences?.baseCurrency,
                () => handleBaseCurrencyChange(currency.code)
              )
            )}
          </View>
        </View>

        {/* Display Currency Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display Currency</Text>
          <Text style={styles.sectionDescription}>
            Currency shown for totals and consolidated balances
          </Text>
          
          <View style={styles.currencyList}>
            {state.currencies.map(currency => 
              renderCurrencyOption(
                currency, 
                currency.code === state.userPreferences?.displayCurrency,
                () => handleDisplayCurrencyChange(currency.code)
              )
            )}
          </View>
        </View>

        {/* Multi-Currency Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Multi-Currency Options</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Show Individual Currencies</Text>
              <Text style={styles.settingDescription}>
                Display breakdown by currency on home screen
              </Text>
            </View>
            <Switch
              value={state.userPreferences?.showMultipleCurrencies || false}
              onValueChange={handleShowMultipleCurrenciesToggle}
              trackColor={{ false: '#D1D5DB', true: '#A855F7' }}
              thumbColor={state.userPreferences?.showMultipleCurrencies ? '#FFFFFF' : '#F3F4F6'}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Auto-Convert Transactions</Text>
              <Text style={styles.settingDescription}>
                Automatically convert foreign transactions to base currency
              </Text>
            </View>
            <Switch
              value={state.userPreferences?.autoConvert || false}
              onValueChange={handleAutoConvertToggle}
              trackColor={{ false: '#D1D5DB', true: '#A855F7' }}
              thumbColor={state.userPreferences?.autoConvert ? '#FFFFFF' : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Exchange Rate Updates */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exchange Rate Updates</Text>
          
          <View style={styles.frequencyOptions}>
            {['hourly', 'daily', 'weekly', 'manual'].map(freq => (
              <TouchableOpacity
                key={freq}
                style={[
                  styles.frequencyOption,
                  state.userPreferences?.updateRatesFrequency === freq && styles.selectedFrequency
                ]}
                onPress={() => handleUpdateRatesFrequencyChange(freq)}
              >
                <Text style={[
                  styles.frequencyText,
                  state.userPreferences?.updateRatesFrequency === freq && styles.selectedFrequencyText
                ]}>
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.updateButton}
            onPress={handleManualRateUpdate}
            disabled={isUpdatingRates}
          >
            {isUpdatingRates ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.updateButtonText}>Update Rates Now</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Exchange Rates Display */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Exchange Rates</Text>
          <Text style={styles.sectionDescription}>
            Rates relative to {state.userPreferences?.baseCurrency || 'GHS'}
          </Text>
          
          <View style={styles.ratesList}>
            {state.currencies
              .filter(c => c.code !== state.userPreferences?.baseCurrency)
              .map(currency => (
                <View key={currency.code} style={styles.rateItem}>
                  <View style={styles.rateInfo}>
                    <Text style={styles.rateSymbol}>{currency.symbol}</Text>
                    <Text style={styles.rateCode}>{currency.code}</Text>
                  </View>
                  <Text style={styles.rateValue}>{currency.exchangeRate.toFixed(4)}</Text>
                </View>
              ))
            }
          </View>
          
          {state.currencies.length > 0 && (
            <Text style={styles.rateUpdateTime}>
              Last updated: {new Date(state.currencies[0]?.lastUpdated).toLocaleString()}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  currencyList: {
    gap: 8,
  },
  currencyOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedCurrency: {
    backgroundColor: '#EEF2FF',
    borderColor: '#8B5CF6',
  },
  currencyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B5CF6',
    marginRight: 12,
    minWidth: 32,
    textAlign: 'center',
  },
  currencyDetails: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  currencyName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  settingDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  frequencyOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  frequencyOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedFrequency: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  frequencyText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  selectedFrequencyText: {
    color: '#FFFFFF',
  },
  updateButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ratesList: {
    gap: 12,
  },
  rateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  rateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rateSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8B5CF6',
    marginRight: 8,
    minWidth: 24,
  },
  rateCode: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  rateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  rateUpdateTime: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});

export default CurrencySettingsScreen;