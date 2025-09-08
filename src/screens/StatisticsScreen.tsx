import React from 'react';
import { 
  SafeAreaView, 
  StyleSheet,
  ScrollView
} from 'react-native';
import { BudgetOverview } from '../components/BudgetOverview';

export const StatisticsScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <BudgetOverview />
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100, // Space for bottom navigation
  },
});