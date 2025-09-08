import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BottomTabNavigator } from '../navigation/BottomTabNavigator';
import { FirstTimeSetupModal } from './FirstTimeSetupModal';

export const AppNavigator: React.FC = () => {
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    checkFirstTimeUser();
  }, []);

  const checkFirstTimeUser = async () => {
    try {
      const savedUserName = await AsyncStorage.getItem('userName');
      if (savedUserName) {
        setUserName(savedUserName);
        setIsFirstTime(false);
      } else {
        setIsFirstTime(true);
      }
    } catch (error) {
      console.error('Error checking first time user:', error);
      setIsFirstTime(true);
    }
  };

  const handleSetupComplete = async (userData: { name: string; pin?: string; email?: string }) => {
    try {
      await AsyncStorage.setItem('userName', userData.name);
      if (userData.pin) {
        await AsyncStorage.setItem('userPin', userData.pin);
      }
      if (userData.email) {
        await AsyncStorage.setItem('userEmail', userData.email);
      }
      setUserName(userData.name);
      setIsFirstTime(false);
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  };

  // Show loading screen while checking if first time user
  if (isFirstTime === null) {
    return (
      <View style={styles.centerContainer}>
        <ExpoLinearGradient
          colors={['#8B5CF6', '#A855F7']}
          style={styles.loadingGradient}
        >
          <Text style={styles.loadingTitle}>Budget Tracker</Text>
          <Text style={styles.loadingText}>Loading...</Text>
          <View style={styles.loadingDot} />
        </ExpoLinearGradient>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <BottomTabNavigator />
      <FirstTimeSetupModal
        visible={isFirstTime}
        onComplete={handleSetupComplete}
      />
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
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
});