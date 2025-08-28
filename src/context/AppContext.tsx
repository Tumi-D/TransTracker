import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { Transaction, Budget, Category } from '../database/schema';
import { budgetService, BudgetSummary, CategorySpending } from '../services/budgetService';

export interface AppState {
  transactions: Transaction[];
  budgets: Budget[];
  categories: Category[];
  budgetSummary: BudgetSummary | null;
  categorySpending: CategorySpending[];
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
  | { type: 'SET_CATEGORY_SPENDING'; payload: CategorySpending[] };

const initialState: AppState = {
  transactions: [],
  budgets: [],
  categories: [],
  budgetSummary: null,
  categorySpending: [],
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
    
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  refreshData: () => Promise<void>;
} | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const refreshData = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Load budget summary and category spending in parallel
      const [summary, categorySpending] = await Promise.all([
        budgetService.getBudgetSummary(),
        budgetService.getCategorySpending(),
      ]);

      dispatch({ type: 'SET_BUDGET_SUMMARY', payload: summary });
      dispatch({ type: 'SET_CATEGORY_SPENDING', payload: categorySpending });
      
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch, refreshData }}>
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