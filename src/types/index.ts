export interface Expense {
  id?: number;
  cloudId?: string;
  type: 'expense' | 'income';
  amount: number;
  category: string;
  subcategory?: string;
  description: string;
  date: string; // ISO date YYYY-MM-DD
  createdAt: number; // timestamp
  isBigPurchase: boolean;
  lifespanYears?: number;
  endDate?: string;
  groupKey?: string;
  tags?: string[];
}

export type ExpenseCategory = "餐饮" | "交通" | "购物" | "娱乐" | "居住" | "医疗" | "教育" | "数码" | "服饰" | "其他";
export type IncomeCategory = "工资" | "兼职" | "理财" | "退款" | "其他收入";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "餐饮", "交通", "购物", "娱乐", "居住", "医疗", "教育", "数码", "服饰", "其他"
];

export const INCOME_CATEGORIES: IncomeCategory[] = [
  "工资", "兼职", "理财", "退款", "其他收入"
];

export type Category = ExpenseCategory;
export const CATEGORIES = EXPENSE_CATEGORIES;
