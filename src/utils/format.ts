export function formatAmount(amount: number): string {
  return `¥${amount.toFixed(2)}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.getTime() === today.getTime()) return '今天';
  if (d.getTime() === yesterday.getTime()) return '昨天';

  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${month}月${day}日 ${weekdays[d.getDay()]}`;
}

export function getToday(): string {
  const d = new Date();
  return dateToStr(d);
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getCurrentMonth(): number {
  return new Date().getMonth() + 1;
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function getMonthStart(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

export function getMonthEnd(year: number, month: number): string {
  const d = new Date(year, month, 0); // Last day of the month
  return `${year}-${String(month).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getMonthLabel(year: number, month: number): string {
  return `${year}年${month}月`;
}

export function formatLifespan(years: number): string {
  const y = Math.floor(years);
  const m = Math.round((years - y) * 12);
  if (y === 0 && m === 0) return '';
  if (y === 0) return `${m} 个月`;
  if (m === 0) return `${y} 年`;
  return `${y} 年 ${m} 个月`;
}
