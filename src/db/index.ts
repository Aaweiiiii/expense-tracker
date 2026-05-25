import Dexie, { type Table } from 'dexie';
import type { Expense } from '../types';

class ExpenseDB extends Dexie {
  expenses!: Table<Expense, number>;

  constructor() {
    super('ExpenseTrackerDB');
    this.version(3).stores({
      expenses: '++id, date, category, amount, isBigPurchase, createdAt',
    }).upgrade(async (tx) => {
      const records = await tx.table('expenses').toArray();
      for (const r of records as any[]) {
        if (r.isBigPurchase && r.purchaseDate && r.purchaseDate !== r.date) {
          await tx.table('expenses').update(r.id, { date: r.purchaseDate });
        }
      }
    });
  }
}

export const db = new ExpenseDB();

export async function addExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Promise<number> {
  return db.expenses.add({
    ...expense,
    type: expense.type || 'expense',
    createdAt: Date.now(),
  });
}

export async function updateExpense(id: number, changes: Partial<Expense>): Promise<number> {
  return db.expenses.update(id, changes);
}

export async function deleteExpense(id: number): Promise<void> {
  return db.expenses.delete(id);
}

export async function getExpensesByDateRange(start: string, end: string): Promise<Expense[]> {
  return db.expenses
    .where('date')
    .between(start, end, true, true)
    .reverse()
    .sortBy('createdAt');
}

export async function getAllExpenses(): Promise<Expense[]> {
  return db.expenses.orderBy('createdAt').reverse().toArray();
}

export async function getBigPurchases(): Promise<Expense[]> {
  return db.expenses
    .filter((e) => e.isBigPurchase === true)
    .toArray();
}

export async function getTotalByCategory(start: string, end: string): Promise<{ category: string; total: number }[]> {
  const expenses = await getExpensesByDateRange(start, end);
  const map = new Map<string, number>();
  for (const e of expenses) {
    map.set(e.category, (map.get(e.category) || 0) + e.amount);
  }
  return Array.from(map.entries()).map(([category, total]) => ({ category, total }));
}
