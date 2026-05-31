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

export async function getAllExpenses(): Promise<Expense[]> {
  return db.expenses.orderBy('createdAt').reverse().toArray();
}

export async function getBigPurchases(): Promise<Expense[]> {
  return db.expenses
    .filter((e) => e.isBigPurchase === true)
    .toArray();
}
