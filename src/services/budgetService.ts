import { databaseService, Budget, Transaction } from '../database/schema';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  remainingBudget: number;
  percentageUsed: number;
  activeBudgets: number;
  exceededBudgets: number;
}

export interface CategorySpending {
  category: string;
  budgeted: number;
  spent: number;
  remaining: number;
  percentageUsed: number;
  isExceeded: boolean;
  transactionCount: number;
}

export interface SpendingTrend {
  date: string;
  amount: number;
  category: string;
}

export class BudgetService {
  async createBudget(budget: Omit<Budget, 'id' | 'spent' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const db = await databaseService.getDatabase();
    if (!db) throw new Error('Database not available');

    const id = `budget_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO budgets 
       (id, name, category, amount, spent, period, startDate, endDate, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
      [id, budget.name, budget.category, budget.amount, budget.period,
       budget.startDate, budget.endDate, budget.isActive ? 1 : 0, now, now]
    );

    return id;
  }

  async updateBudget(id: string, updates: Partial<Budget>): Promise<void> {
    const db = await databaseService.getDatabase();
    if (!db) throw new Error('Database not available');

    const updateFields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'createdAt') {
        updateFields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (updateFields.length === 0) return;

    updateFields.push('updatedAt = ?');
    values.push(new Date().toISOString());
    values.push(id);

    await db.runAsync(
      `UPDATE budgets SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );
  }

  async deleteBudget(id: string): Promise<void> {
    const db = await databaseService.getDatabase();
    if (!db) throw new Error('Database not available');

    await db.runAsync('DELETE FROM budgets WHERE id = ?', [id]);
  }

  async getBudgets(activeOnly: boolean = false): Promise<Budget[]> {
    const db = await databaseService.getDatabase();
    if (!db) throw new Error('Database not available');

    const query = activeOnly 
      ? 'SELECT * FROM budgets WHERE isActive = 1 ORDER BY createdAt DESC'
      : 'SELECT * FROM budgets ORDER BY createdAt DESC';

    const result = await db.getAllAsync(query);
    return result as Budget[];
  }

  async getBudgetById(id: string): Promise<Budget | null> {
    const db = await databaseService.getDatabase();
    if (!db) throw new Error('Database not available');

    const result = await db.getFirstAsync('SELECT * FROM budgets WHERE id = ?', [id]);
    return result as Budget || null;
  }

  async getCurrentBudgets(): Promise<Budget[]> {
    const db = await databaseService.getDatabase();
    if (!db) throw new Error('Database not available');

    const today = new Date().toISOString().split('T')[0];
    const result = await db.getAllAsync(
      'SELECT * FROM budgets WHERE isActive = 1 AND date(?) BETWEEN startDate AND endDate ORDER BY category',
      [today]
    );

    return result as Budget[];
  }

  async getBudgetSummary(): Promise<BudgetSummary> {
    const currentBudgets = await this.getCurrentBudgets();
    
    const totalBudget = currentBudgets.reduce((sum, budget) => sum + budget.amount, 0);
    const totalSpent = currentBudgets.reduce((sum, budget) => sum + budget.spent, 0);
    const remainingBudget = totalBudget - totalSpent;
    const percentageUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
    const exceededBudgets = currentBudgets.filter(budget => budget.spent > budget.amount).length;

    return {
      totalBudget,
      totalSpent,
      remainingBudget,
      percentageUsed,
      activeBudgets: currentBudgets.length,
      exceededBudgets
    };
  }

  async getCategorySpending(): Promise<CategorySpending[]> {
    const currentBudgets = await this.getCurrentBudgets();
    const db = await databaseService.getDatabase();
    if (!db) return [];

    const categorySpending: CategorySpending[] = [];

    for (const budget of currentBudgets) {
      // Get transaction count for this category in the budget period
      const transactionCount = await db.getFirstAsync(
        `SELECT COUNT(*) as count FROM transactions 
         WHERE category = ? AND type = 'expense' 
         AND date BETWEEN ? AND ?`,
        [budget.category, budget.startDate, budget.endDate]
      ) as any;

      const remaining = budget.amount - budget.spent;
      const percentageUsed = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0;

      categorySpending.push({
        category: budget.category,
        budgeted: budget.amount,
        spent: budget.spent,
        remaining,
        percentageUsed,
        isExceeded: budget.spent > budget.amount,
        transactionCount: transactionCount?.count || 0
      });
    }

    return categorySpending.sort((a, b) => b.percentageUsed - a.percentageUsed);
  }

  async getSpendingTrends(days: number = 30): Promise<SpendingTrend[]> {
    const db = await databaseService.getDatabase();
    if (!db) throw new Error('Database not available');

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days);

    const result = await db.getAllAsync(
      `SELECT date(date) as date, SUM(amount) as amount, category
       FROM transactions 
       WHERE type = 'expense' AND date >= ? AND date <= ?
       GROUP BY date(date), category
       ORDER BY date DESC, amount DESC`,
      [startDate.toISOString(), endDate.toISOString()]
    );

    return result as SpendingTrend[];
  }

  async getTopSpendingCategories(limit: number = 5): Promise<{category: string, amount: number, count: number}[]> {
    const db = await databaseService.getDatabase();
    if (!db) throw new Error('Database not available');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db.getAllAsync(
      `SELECT category, SUM(amount) as amount, COUNT(*) as count
       FROM transactions 
       WHERE type = 'expense' AND date >= ?
       GROUP BY category
       ORDER BY amount DESC
       LIMIT ?`,
      [thirtyDaysAgo.toISOString(), limit]
    );

    return result as {category: string, amount: number, count: number}[];
  }

  async recalculateBudgetSpent(budgetId: string): Promise<void> {
    const db = await databaseService.getDatabase();
    if (!db) throw new Error('Database not available');

    const budget = await this.getBudgetById(budgetId);
    if (!budget) return;

    // Calculate total spent for this budget's category in its period
    const result = await db.getFirstAsync(
      `SELECT SUM(amount) as total FROM transactions 
       WHERE category = ? AND type = 'expense' 
       AND date BETWEEN ? AND ?`,
      [budget.category, budget.startDate, budget.endDate]
    ) as any;

    const totalSpent = result?.total || 0;

    await this.updateBudget(budgetId, { spent: totalSpent });
  }

  async recalculateAllBudgets(): Promise<void> {
    const budgets = await this.getCurrentBudgets();
    
    for (const budget of budgets) {
      await this.recalculateBudgetSpent(budget.id);
    }
  }

  // Create preset budgets based on spending patterns
  async createPresetBudgets(): Promise<void> {
    const topCategories = await this.getTopSpendingCategories(5);
    const currentDate = new Date();
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const endOfNextMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);

    for (const categoryData of topCategories) {
      // Create budget with 120% of average monthly spending
      const suggestedAmount = Math.round(categoryData.amount * 1.2);
      
      await this.createBudget({
        name: `${categoryData.category} Budget`,
        category: categoryData.category,
        amount: suggestedAmount,
        period: 'monthly',
        startDate: nextMonth.toISOString().split('T')[0],
        endDate: endOfNextMonth.toISOString().split('T')[0],
        isActive: true
      });
    }
  }

  // Export budget data for backup/sharing
  async exportBudgetData(): Promise<string> {
    const budgets = await this.getBudgets();
    const summary = await this.getBudgetSummary();
    const categorySpending = await this.getCategorySpending();

    const exportData = {
      exportDate: new Date().toISOString(),
      summary,
      budgets,
      categorySpending,
      version: '1.0'
    };

    const jsonData = JSON.stringify(exportData, null, 2);
    
    // Store in AsyncStorage for sharing
    await AsyncStorage.setItem('budget_export', jsonData);
    
    return jsonData;
  }
}

export const budgetService = new BudgetService();