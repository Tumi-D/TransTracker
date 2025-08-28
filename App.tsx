import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Alert, SafeAreaView } from 'react-native';
import { databaseService } from './src/database/schema';
import { smsListenerService } from './src/services/smsListener';
import { BudgetOverview } from './src/components/BudgetOverview';
import { TransactionList } from './src/components/TransactionList';
import { AddTransactionModal } from './src/components/AddTransactionModal';
import { AppProvider } from './src/context/AppContext';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize database
      await databaseService.init();
      
      // Start SMS listening
      const smsStarted = await smsListenerService.startListening();
      if (!smsStarted) {
        console.warn('SMS listening could not be started');
      }

      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setInitError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  if (initError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Initialization Error</Text>
          <Text style={styles.errorText}>{initError}</Text>
        </View>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Setting up Budget Tracker...</Text>
          <Text style={styles.loadingSubtext}>Initializing database and services</Text>
        </View>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  return (
    <AppProvider>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>💰 Budget Tracker</Text>
          <BudgetOverview />
          <TransactionList />
          <AddTransactionModal />
        </View>
        <StatusBar style="auto" />
      </SafeAreaView>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#2c3e50',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 8,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e74c3c',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
  },
});
