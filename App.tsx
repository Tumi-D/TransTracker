import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { databaseService } from './src/database/schema';
import { smsListenerService } from './src/services/smsListener';
import { AppProvider } from './src/context/AppContext';
import { AppNavigator } from './src/components/AppNavigator';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      await databaseService.init();
      
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
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeContainer}>
          <View style={styles.centerContainer}>
            <ExpoLinearGradient
              colors={['#EF4444', '#DC2626']}
              style={styles.errorGradient}
            >
              <Text style={styles.errorTitle}>Initialization Error</Text>
              <Text style={styles.errorText}>{initError}</Text>
            </ExpoLinearGradient>
          </View>
          <StatusBar style="light" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!isInitialized) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeContainer}>
          <View style={styles.centerContainer}>
            <ExpoLinearGradient
              colors={['#8B5CF6', '#A855F7']}
              style={styles.loadingGradient}
            >
              <Text style={styles.loadingTitle}>Budget Tracker</Text>
              <Text style={styles.loadingText}>Setting up your financial dashboard...</Text>
              <View style={styles.loadingDot} />
            </ExpoLinearGradient>
          </View>
          <StatusBar style="light" />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AppProvider>
        <AppNavigator />
        <StatusBar style="light" />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingGradient: {
    paddingHorizontal: 40,
    paddingVertical: 60,
    borderRadius: 24,
    alignItems: 'center',
    margin: 20,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 20,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    opacity: 0.6,
  },
  errorGradient: {
    paddingHorizontal: 40,
    paddingVertical: 60,
    borderRadius: 24,
    alignItems: 'center',
    margin: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
});