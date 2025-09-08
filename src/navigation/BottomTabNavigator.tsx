import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View, Text } from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeScreen } from '../screens/HomeScreen';
import { StatisticsScreen } from '../screens/StatisticsScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

// Custom tab bar icons
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const getIcon = () => {
    switch (name) {
      case 'Home':
        return '🏠';
      case 'Statistics':
        return '📊';
      case 'Transactions':
        return '💳';
      case 'Profile':
        return '👤';
      default:
        return '•';
    }
  };

  if (focused) {
    return (
      <ExpoLinearGradient
        colors={['#8B5CF6', '#7C3AED']}
        style={styles.activeTabContainer}
      >
        <Text style={styles.activeTabIcon}>{getIcon()}</Text>
      </ExpoLinearGradient>
    );
  }

  return (
    <View style={styles.inactiveTabContainer}>
      <Text style={styles.inactiveTabIcon}>{getIcon()}</Text>
    </View>
  );
};

export const BottomTabNavigator = () => {
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
        tabBarLabel: ({ focused }) => (
          <Text style={[
            styles.tabLabel,
            { color: focused ? '#8B5CF6' : '#9CA3AF' }
          ]}>
            {route.name}
          </Text>
        ),
        tabBarStyle: [styles.tabBar, { paddingBottom: insets.bottom + 20, height: 80 + insets.bottom }],
        tabBarItemStyle: styles.tabBarItem,
        tabBarActiveTintColor: '#8B5CF6',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: styles.tabLabelStyle,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
        }}
      />
      <Tab.Screen 
        name="Statistics" 
        component={StatisticsScreen}
        options={{
          tabBarLabel: 'Statistics',
        }}
      />
      <Tab.Screen 
        name="Transactions" 
        component={TransactionsScreen}
        options={{
          tabBarLabel: 'Transactions',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    paddingTop: 8,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  tabBarItem: {
    paddingTop: 4,
  },
  tabLabelStyle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  activeTabContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTabIcon: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  inactiveTabContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inactiveTabIcon: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});