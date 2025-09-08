import React from 'react';
import { 
  ScrollView,
  SafeAreaView, 
  StyleSheet,
  View,
  Text
} from 'react-native';
import { TransactionList } from '../components/TransactionList';

export const TransactionsScreen: React.FC = () => {
  const HeaderComponent = () => (
    <View style={styles.header}>
      <Text style={styles.title}>All Transactions</Text>
      <Text style={styles.subtitle}>Track your financial activity</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <TransactionList 
        ListHeaderComponent={HeaderComponent}
        contentContainerStyle={styles.scrollContent}
        showFilters={true}
      />
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
    paddingBottom: 100, // Space for bottom navigation
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
});