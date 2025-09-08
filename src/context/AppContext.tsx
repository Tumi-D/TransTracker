import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { Transaction, Budget, Category, Currency, UserPreferences } from '../database/schema';
import { budgetService, BudgetSummary, CategorySpending } from '../services/budgetService';
import { currencyService } from '../services/currencyService';

export interface AppState {
  transactions: Transaction[];
  budgets: Budget[];
  categories: Category[];
  budgetSummary: BudgetSummary | null;
  categorySpending: CategorySpending[];
  currencies: Currency[];
  userPreferences: UserPreferences | null;
  multiCurrencyBalances: {[currency: string]: number};
  isLoading: boolean;
  error: string | null;
}

export type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'SET_BUDGETS'; payload: Budget[] }
  | { type: 'ADD_BUDGET'; payload: Budget }
  | { type: 'UPDATE_BUDGET'; payload: Budget }
  | { type: 'DELETE_BUDGET'; payload: string }
  | { type: 'SET_CATEGORIES'; payload: Category[] }
  | { type: 'SET_BUDGET_SUMMARY'; payload: BudgetSummary }
  | { type: 'SET_CATEGORY_SPENDING'; payload: CategorySpending[] }
  | { type: 'SET_CURRENCIES'; payload: Currency[] }
  | { type: 'SET_USER_PREFERENCES'; payload: UserPreferences }
  | { type: 'SET_MULTI_CURRENCY_BALANCES'; payload: {[currency: string]: number} };

const initialState: AppState = {
  transactions: [],
  budgets: [],
  categories: [],
  budgetSummary: null,
  categorySpending: [],
  currencies: [],
  userPreferences: null,
  multiCurrencyBalances: {},
  isLoading: false,
  error: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    
    case 'SET_TRANSACTIONS':
      return { ...state, transactions: action.payload };
    
    case 'ADD_TRANSACTION':
      return { ...state, transactions: [action.payload, ...state.transactions] };
    
    case 'UPDATE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.map(t => 
          t.id === action.payload.id ? action.payload : t
        )
      };
    
    case 'DELETE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.filter(t => t.id !== action.payload)
      };
    
    case 'SET_BUDGETS':
      return { ...state, budgets: action.payload };
    
    case 'ADD_BUDGET':
      return { ...state, budgets: [action.payload, ...state.budgets] };
    
    case 'UPDATE_BUDGET':
      return {
        ...state,
        budgets: state.budgets.map(b => 
          b.id === action.payload.id ? action.payload : b
        )
      };
    
    case 'DELETE_BUDGET':
      return {
        ...state,
        budgets: state.budgets.filter(b => b.id !== action.payload)
      };
    
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    
    case 'SET_BUDGET_SUMMARY':
      return { ...state, budgetSummary: action.payload };
    
    case 'SET_CATEGORY_SPENDING':
      return { ...state, categorySpending: action.payload };
    
    case 'SET_CURRENCIES':
      return { ...state, currencies: action.payload };
    
    case 'SET_USER_PREFERENCES':
      return { ...state, userPreferences: action.payload };
    
    case 'SET_MULTI_CURRENCY_BALANCES':
      return { ...state, multiCurrencyBalances: action.payload };
    
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  refreshData: () => Promise<void>;
  totalBalance: number;
  totalIncome: number;
  totalExpenses: number;
  getFormattedAmount: (amount: number, currency?: string, fromCurrency?: string) => Promise<string>;
  convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => Promise<number>;
  getConsolidatedBalance: () => Promise<number>;
  getConvertedTotals: () => Promise<{income: number, expenses: number, balance: number}>;
} | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Calculate totals from transactions (raw amounts - may be multi-currency)
  const totalIncome = state.transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalExpenses = state.transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalBalance = totalIncome - totalExpenses;

  // Get converted totals in display currency
  const getConvertedTotals = async () => {
    const displayCurrency = state.userPreferences?.displayCurrency || 'GHS';
    let convertedIncome = 0;
    let convertedExpenses = 0;

    // Convert each transaction to display currency
    for (const transaction of state.transactions) {
      const convertedAmount = await currencyService.convertAmount(
        transaction.amount, 
        transaction.currency || 'GHS', 
        displayCurrency
      );

      if (transaction.type === 'income') {
        convertedIncome += convertedAmount;
      } else {
        convertedExpenses += convertedAmount;
      }
    }

    return {
      income: convertedIncome,
      expenses: convertedExpenses,
      balance: convertedIncome - convertedExpenses
    };
  };

  const refreshData = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Load transactions first
      const { databaseService } = await import('../database/schema');
      const db = await databaseService.getDatabase();
      if (db) {
        const transactions = await db.getAllAsync('SELECT * FROM transactions ORDER BY date DESC');
        dispatch({ type: 'SET_TRANSACTIONS', payload: transactions as Transaction[] });
      }
      
      // Load budget summary, category spending, currencies, preferences, and balances in parallel
      const [summary, categorySpending, currencies, multiCurrencyBalances] = await Promise.all([
        budgetService.getBudgetSummary(),
        budgetService.getCategorySpending(),
        currencyService.getAvailableCurrencies(),
        currencyService.getMultiCurrencyBalance(),
      ]);

      dispatch({ type: 'SET_BUDGET_SUMMARY', payload: summary });
      dispatch({ type: 'SET_CATEGORY_SPENDING', payload: categorySpending });
      dispatch({ type: 'SET_CURRENCIES', payload: currencies });
      dispatch({ type: 'SET_MULTI_CURRENCY_BALANCES', payload: multiCurrencyBalances });
      
      // Load user preferences (this might create default if none exist)
      if (db) {
        const prefs = await db.getFirstAsync('SELECT * FROM user_preferences LIMIT 1');
        if (prefs) {
          dispatch({ type: 'SET_USER_PREFERENCES', payload: {
            id: (prefs as any).id,
            baseCurrency: (prefs as any).baseCurrency,
            displayCurrency: (prefs as any).displayCurrency,
            autoConvert: (prefs as any).autoConvert === 1,
            updateRatesFrequency: (prefs as any).updateRatesFrequency,
            showMultipleCurrencies: (prefs as any).showMultipleCurrencies === 1,
            createdAt: (prefs as any).createdAt,
            updatedAt: (prefs as any).updatedAt
          }});
        }
      }
      
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Helper functions for currency operations
  const getFormattedAmount = async (amount: number, currency?: string, fromCurrency?: string): Promise<string> => {
    const displayCurrency = currency || state.userPreferences?.displayCurrency || 'GHS';
    const sourceCurrency = fromCurrency || state.userPreferences?.baseCurrency || 'GHS';
    
    // Convert amount to display currency if needed
    const convertedAmount = await currencyService.convertAmount(amount, sourceCurrency, displayCurrency);
    
    return await currencyService.formatCurrency(convertedAmount, displayCurrency);
  };

  const convertAmount = async (amount: number, fromCurrency: string, toCurrency?: string): Promise<number> => {
    const targetCurrency = toCurrency || state.userPreferences?.displayCurrency || 'GHS';
    return await currencyService.convertAmount(amount, fromCurrency, targetCurrency);
  };

  const getConsolidatedBalance = async (): Promise<number> => {
    const displayCurrency = state.userPreferences?.displayCurrency || 'GHS';
    return await currencyService.getConsolidatedBalance(displayCurrency);
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <AppContext.Provider value={{ 
      state, 
      dispatch, 
      refreshData, 
      totalBalance, 
      totalIncome, 
      totalExpenses,
      getFormattedAmount,
      convertAmount,
      getConsolidatedBalance,
      getConvertedTotals
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};