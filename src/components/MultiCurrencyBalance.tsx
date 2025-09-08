import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { useAppContext } from '../context/AppContext';
import { currencyService } from '../services/currencyService';

export const MultiCurrencyBalance: React.FC = () => {
  const { state, getFormattedAmount } = useAppContext();
  const [consolidatedBalance, setConsolidatedBalance] = useState<number | null>(null);
  const [formattedBalances, setFormattedBalances] = useState<{[currency: string]: string}>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBalances();
  }, [state.multiCurrencyBalances, state.userPreferences]);

  const loadBalances = async () => {
    try {
      setIsLoading(true);
      
      // Get consolidated balance in display currency
      const consolidated = await currencyService.getConsolidatedBalance(
        state.userPreferences?.displayCurrency || 'GHS'
      );
      setConsolidatedBalance(consolidated);

      // Format each currency balance
      const formatted: {[currency: string]: string} = {};
      for (const [currency, amount] of Object.entries(state.multiCurrencyBalances)) {
        if (amount !== 0) { // Only show currencies with non-zero balances
          formatted[currency] = await getFormattedAmount(amount, currency);
        }
      }
      setFormattedBalances(formatted);
    } catch (error) {
      console.error('Error loading multi-currency balances:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#8B5CF6" />
        <Text style={styles.loadingText}>Loading balances...</Text>
      </View>
    );
  }

  const shouldShowMultipleCurrencies = state.userPreferences?.showMultipleCurrencies && 
    Object.keys(formattedBalances).length > 1;

  const displayCurrency = state.userPreferences?.displayCurrency || 'GHS';
  const currencySymbol = state.currencies.find(c => c.code === displayCurrency)?.symbol || displayCurrency;

  return (
    <View style={styles.container}>
      {/* Main Balance Card */}
      <ExpoLinearGradient
        colors={['#8B5CF6', '#A855F7', '#C084FC']}
        style={styles.mainBalanceCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.balanceHeader}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceCurrency}>in {displayCurrency}</Text>
        </View>
        
        <Text style={styles.mainBalance}>
          {currencySymbol}{consolidatedBalance?.toFixed(2) || '0.00'}
        </Text>

        {shouldShowMultipleCurrencies && (
          <TouchableOpacity style={styles.viewDetailsButton}>
            <Text style={styles.viewDetailsText}>View by Currency ↓</Text>
          </TouchableOpacity>
        )}
      </ExpoLinearGradient>

      {/* Individual Currency Balances */}
      {shouldShowMultipleCurrencies && (
        <View style={styles.currencyBreakdown}>
          <Text style={styles.breakdownTitle}>Currency Breakdown</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.currencyScroll}>
            {Object.entries(formattedBalances).map(([currency, formatted]) => {
              const currencyInfo = state.currencies.find(c => c.code === currency);
              const isPositive = state.multiCurrencyBalances[currency] >= 0;
              
              return (
                <View key={currency} style={styles.currencyCard}>
                  <View style={styles.currencyHeader}>
                    <Text style={styles.currencyCode}>{currency}</Text>
                    <Text style={styles.currencyName}>{currencyInfo?.name || currency}</Text>
                  </View>
                  
                  <Text style={[
                    styles.currencyAmount,
                    { color: isPositive ? '#10B981' : '#EF4444' }
                  ]}>
                    {formatted}
                  </Text>
                  
                  {currency !== displayCurrency && (
                    <Text style={styles.convertedAmount}>
                      ≈ {currencySymbol}
                      {(state.multiCurrencyBalances[currency] * 
                        (currencyInfo?.exchangeRate || 1)).toFixed(2)}
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Exchange Rate Update Info */}
      {state.currencies.length > 0 && (
        <View style={styles.rateInfo}>
          <Text style={styles.rateInfoText}>
            Last updated: {new Date(state.currencies[0]?.lastUpdated || Date.now()).toLocaleDateString()}
          </Text>
          <Text style={styles.rateInfoSubtext}>
            Updates {state.userPreferences?.updateRatesFrequency || 'daily'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  mainBalanceCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  balanceCurrency: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '400',
  },
  mainBalance: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  viewDetailsButton: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  viewDetailsText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  currencyBreakdown: {
    marginBottom: 16,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  currencyScroll: {
    flexDirection: 'row',
  },
  currencyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  currencyHeader: {
    marginBottom: 8,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  currencyName: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  currencyAmount: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  convertedAmount: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  rateInfo: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  rateInfoText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  rateInfoSubtext: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
});