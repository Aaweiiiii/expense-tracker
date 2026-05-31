export interface Expense {
  id?: number;
  type: 'expense' | 'income';
  amount: number;
  category: string;
  description: string;
  date: string;
  createdAt: number;
  isBigPurchase: boolean;
  lifespanYears?: number;
  endDate?: string;
  groupKey?: string;
  sellBack?: number;
}

export type ExpenseCategory = "餐饮" | "交通" | "购物" | "娱乐" | "居住" | "医疗" | "教育" | "数码" | "服饰" | "其他";
export type IncomeCategory = "工资" | "兼职" | "理财" | "退款" | "其他收入";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "餐饮", "交通", "购物", "娱乐", "居住", "医疗", "教育", "数码", "服饰", "其他"
];

export const INCOME_CATEGORIES: IncomeCategory[] = [
  "工资", "兼职", "理财", "退款", "其他收入"
];

