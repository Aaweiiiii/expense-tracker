import { useState, useEffect, useMemo } from 'react';
import { getBigPurchases, updateExpense, addExpense, getAllExpenses, deleteExpense } from '../db';
import { formatAmount, formatLifespan, getToday } from '../utils/format';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type Expense } from '../types';
import { EXPENSE_ICONS, INCOME_ICONS, OtherIcon } from '../components/Icon';
import { useDataRefresh } from '../hooks/useData';
import { DatePicker } from '../components/DatePicker';
import { LifespanPicker } from '../components/LifespanPicker';

function calendarAdd(purchase: Date, lifespanYears: number): Date {
  const y = Math.floor(lifespanYears);
  const m = Math.round((lifespanYears - y) * 12);
  const end = new Date(purchase);
  end.setFullYear(end.getFullYear() + y);
  end.setMonth(end.getMonth() + m);
  return end;
}

function calcDailyCost(e: Expense) {
  if (!e.date) return null;
  const purchase = new Date(e.date + 'T00:00:00');
  const today = new Date();
  const isEnded = !!e.endDate;
  const endPoint = isEnded ? new Date(e.endDate! + 'T00:00:00') : today;
  const rawDays = Math.floor((endPoint.getTime() - purchase.getTime()) / 86400000);
  const actualDays = rawDays < 0 ? 0 : Math.max(1, rawDays);

  // Calendar-based lifespan: add years + months to purchase date, count actual calendar days
  let lifespanDays: number;
  const hasLifespan = e.lifespanYears && e.lifespanYears > 0;
  if (hasLifespan) {
    const lifespanEnd = calendarAdd(purchase, e.lifespanYears!);
    lifespanDays = Math.max(1, Math.floor((lifespanEnd.getTime() - purchase.getTime()) / 86400000));
  } else {
    lifespanDays = 3 * 365;
  }

  const netAmount = e.amount - (e.sellBack || 0);
  const expectedDaily = e.amount / lifespanDays;
  const actualDaily = actualDays > 0 ? netAmount / actualDays : 0;
  const usagePct = actualDays > 0 ? Math.min(100, Math.round((actualDays / lifespanDays) * 100)) : 0;

  return { actualDays, lifespanDays, expectedDaily, actualDaily, usagePct, isEnded, hasLifespan, netAmount, sellBack: e.sellBack || 0 };
}

type CostResult = NonNullable<ReturnType<typeof calcDailyCost>> & { netAmount: number; sellBack: number };
type EnrichedItem = { expense: Expense; cost: CostResult };

type MergedRecord = {
  items: EnrichedItem[];
  groupKey: string;
  description: string;
  category: string;
  totalAmount: number;
  totalSellBack: number;
  totalNetAmount: number;
  totalActualDays: number;
  count: number;
  combinedExpectedDaily: number;
  combinedActualDaily: number;
  minDate: string;
  maxEndDate: string | null;
  isEnded: boolean;
  allHaveLifespan: boolean;
  lifespanYears?: number;
};

function mergeRecords(items: EnrichedItem[]): { singles: EnrichedItem[]; groups: MergedRecord[] } {
  const groupMap = new Map<string, EnrichedItem[]>();
  const singles: EnrichedItem[] = [];

  for (const item of items) {
    const key = item.expense.groupKey;
    if (key) {
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(item);
    } else {
      singles.push(item);
    }
  }

  const groups: MergedRecord[] = [];
  for (const [groupKey, groupItems] of groupMap) {
    if (groupItems.length === 1) {
      // Only one item in group, treat as single
      singles.push(groupItems[0]);
      continue;
    }

    const totalAmount = groupItems.reduce((s, i) => s + i.expense.amount, 0);
    const totalSellBack = groupItems.reduce((s, i) => s + (i.expense.sellBack || 0), 0);
    const totalNetAmount = totalAmount - totalSellBack;
    const count = groupItems.length;
    const totalActualDays = groupItems.reduce((s, i) => s + i.cost.actualDays, 0);
    const totalLifespanDays = groupItems.reduce((s, i) => s + i.cost.lifespanDays, 0);
    const combinedExpectedDaily = totalAmount / totalLifespanDays;
    const combinedActualDaily = totalActualDays > 0 ? totalNetAmount / totalActualDays : 0;
    const dates = groupItems.map((i) => i.expense.date).sort();
    const allHaveLifespan = groupItems.every((i) => i.cost.hasLifespan);
    groups.push({
      items: groupItems,
      groupKey,
      description: groupItems[0].expense.description,
      category: groupItems[0].expense.category,
      totalAmount,
      totalSellBack,
      totalNetAmount,
      totalActualDays,
      count,
      combinedExpectedDaily,
      combinedActualDaily,
      minDate: dates[0],
      maxEndDate: groupItems.some((i) => i.cost.isEnded) ? dates[dates.length - 1] : null,
      isEnded: groupItems.every((i) => i.cost.isEnded),
      allHaveLifespan,
      lifespanYears: groupItems[0].expense.lifespanYears,
    });
  }

  return { singles, groups };
}

const FUN_REFS = [
  { label: '纸巾', unit: '包', price: 1, emoji: '🧻' },
  { label: '农夫山泉', unit: '瓶', price: 2, emoji: '💧' },
  { label: '茶叶蛋', unit: '个', price: 2, emoji: '🥚' },
  { label: '公交票', unit: '张', price: 2, emoji: '🚌' },
  { label: '辣条', unit: '包', price: 2, emoji: '🌶️' },
  { label: '烤肠', unit: '根', price: 3, emoji: '🌭' },
  { label: '冰可乐', unit: '瓶', price: 3, emoji: '🥤' },
  { label: '共享充电宝', unit: '小时', price: 3, emoji: '🔋' },
  { label: '巧乐兹', unit: '根', price: 5, emoji: '🍦' },
  { label: '蜜雪冰城', unit: '杯', price: 8, emoji: '🍋' },
  { label: '乐事薯片', unit: '包', price: 8, emoji: '🥔' },
  { label: '刮刮乐', unit: '张', price: 10, emoji: '🎰' },
  { label: '小笼包', unit: '笼', price: 10, emoji: '🥟' },
  { label: '瑞幸美式', unit: '杯', price: 10, emoji: '☕' },
  { label: '重庆小面', unit: '碗', price: 12, emoji: '🍜' },
  { label: '音乐会员', unit: '月', price: 15, emoji: '🎵' },
  { label: '茶颜悦色', unit: '杯', price: 20, emoji: '🍵' },
  { label: '喜茶', unit: '杯', price: 22, emoji: '🧋' },
  { label: '视频会员', unit: '月', price: 25, emoji: '📺' },
  { label: '麻辣烫', unit: '碗', price: 25, emoji: '🥘' },
  { label: '车厘子', unit: '盒', price: 28, emoji: '🍒' },
  { label: '星巴克', unit: '杯', price: 30, emoji: '☕✨' },
  { label: '麒麟西瓜', unit: '个', price: 35, emoji: '🍉' },
  { label: '吉野家', unit: '碗', price: 38, emoji: '🍚' },
  { label: '麦当劳', unit: '顿', price: 40, emoji: '🍔' },
  { label: '动物园门票', unit: '张', price: 40, emoji: '🦁' },
  { label: 'U盘', unit: '个', price: 40, emoji: '💾' },
  { label: '费列罗', unit: '盒', price: 45, emoji: '🍫' },
  { label: '回转寿司', unit: '份', price: 48, emoji: '🍣' },
  { label: '泡泡玛特', unit: '个', price: 50, emoji: '🎭' },
  { label: '跨区打车', unit: '次', price: 50, emoji: '🚕' },
  { label: '小龙虾', unit: '斤', price: 50, emoji: '🦞' },
  { label: '电影票', unit: '张', price: 50, emoji: '🎬' },
  { label: '洗剪吹', unit: '次', price: 50, emoji: '💇' },
  { label: '豪华肯德基', unit: '顿', price: 55, emoji: '🍗' },
  { label: '寿司拼盘', unit: '份', price: 65, emoji: '🍣' },
  { label: '密室逃脱', unit: '次', price: 68, emoji: '🏃' },
  { label: 'KTV小包', unit: '次', price: 80, emoji: '🎤' },
  { label: 'MAC口红', unit: '支', price: 100, emoji: '💄' },
  { label: '西贝莜面村', unit: '顿', price: 120, emoji: '🍖' },
  { label: 'ZARA香水', unit: '瓶', price: 130, emoji: '🌸' },
  { label: '双人烤肉', unit: '顿', price: 150, emoji: '🥩' },
  { label: '欢乐谷门票', unit: '张', price: 160, emoji: '🎢' },
  { label: '日料放题', unit: '顿', price: 180, emoji: '🍣' },
  { label: '生日蛋糕', unit: '个', price: 220, emoji: '🎂' },
  { label: '獭祭清酒', unit: '瓶', price: 260, emoji: '🍶' },
  { label: 'Livehouse', unit: '场', price: 280, emoji: '🎸' },
  { label: '音乐节', unit: '张', price: 280, emoji: '🎪' },
  { label: '海底捞', unit: '顿', price: 300, emoji: '🍲' },
  { label: '战斧牛排', unit: '顿', price: 320, emoji: '🍽️' },
  { label: '精油SPA', unit: '次', price: 350, emoji: '💆' },
  { label: '演唱会', unit: '张', price: 380, emoji: '🎵' },
  { label: '帝王蟹', unit: '顿', price: 420, emoji: '🦀' },
  { label: '温泉民宿', unit: '晚', price: 450, emoji: '🏨' },
];

function getFunText(daily: number): string {
  if (daily <= 0) return '尚未开始';
  const best = FUN_REFS.reduce((a, b) =>
    Math.abs(b.price - daily) < Math.abs(a.price - daily) ? b : a
  );
  const n = daily / best.price;
  if (n >= 0.8 && n <= 1.2) return `${best.emoji} ≈ 一${best.unit}${best.label}`;
  if (n < 1) return `${best.emoji} ${Math.round(1 / n)} 天 ≈ 一${best.unit}${best.label}`;
  return `${best.emoji} ${n.toFixed(1)} ${best.unit}${best.label}`;
}

type SortKey = 'daily' | 'amount' | 'days';

export function Analysis() {
  const [purchases, setPurchases] = useState<Expense[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>('daily');
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const { refreshKey, refresh } = useDataRefresh();

  useEffect(() => {
    getBigPurchases().then(setPurchases);
  }, [refreshKey]);

  const enriched = useMemo(() => {
    return purchases
      .map((p) => ({ expense: p, cost: calcDailyCost(p)! }))
      .filter((e) => e.cost !== null);
  }, [purchases]);

  const active = useMemo(() => enriched.filter((e) => !e.cost.isEnded), [enriched]);
  const ended = useMemo(() => enriched.filter((e) => e.cost.isEnded), [enriched]);

  function sortItems(items: EnrichedItem[]): EnrichedItem[] {
    return [...items].sort((a, b) => {
      if (sortBy === 'daily') return b.cost.actualDaily - a.cost.actualDaily;
      if (sortBy === 'amount') return b.expense.amount - a.expense.amount;
      return b.cost.actualDays - a.cost.actualDays;
    });
  }

  function groupByCategory(items: EnrichedItem[]) {
    const map = new Map<string, EnrichedItem[]>();
    for (const item of items) {
      const cat = item.expense.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const totalA = a[1].reduce((s, i) => s + i.expense.amount, 0);
      const totalB = b[1].reduce((s, i) => s + i.expense.amount, 0);
      return totalB - totalA;
    });
  }

  const activeGroups = useMemo(() => groupByCategory(sortItems(active)), [active, sortBy]);
  const endedGroups = useMemo(() => groupByCategory(sortItems(ended)), [ended, sortBy]);

  const summary = useMemo(() => {
    const totalAmount = enriched.reduce((s, e) => s + e.expense.amount, 0);
    const totalDaily = enriched
      .filter((e) => e.cost.actualDays > 0)
      .reduce((s, e) => s + e.cost.actualDaily, 0);
    const started = enriched.filter((e) => e.cost.actualDays > 0);
    const bestValue = started.reduce(
      (best, e) => (e.cost.actualDaily < best.cost.actualDaily ? e : best),
      started[0]
    );
    return { totalAmount, totalDaily, count: enriched.length, activeCount: active.length, bestValue };
  }, [enriched, active]);

  // Chart: use mergeRecords so grouped items show as one bar
  const chartItems = useMemo(() => {
    const { singles, groups } = mergeRecords(enriched);
    const entries: { name: string; value: number }[] = [];

    for (const g of groups) {
      let value: number;
      if (sortBy === 'daily') value = g.combinedActualDaily;
      else if (sortBy === 'amount') value = g.totalAmount;
      else value = g.totalActualDays;

      entries.push({
        name: `${g.description}×${g.count}`,
        value: Math.round(value * 100) / 100,
      });
    }

    for (const { expense, cost } of singles) {
      let value: number;
      if (sortBy === 'daily') value = cost.actualDaily;
      else if (sortBy === 'amount') value = expense.amount;
      else value = cost.actualDays;

      entries.push({
        name: expense.description,
        value: Math.round(value * 100) / 100,
      });
    }

    return entries
      .filter((e) => isFinite(e.value) && !isNaN(e.value))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [enriched, sortBy]);

  // ── End-asset modal state ──
  const [endModal, setEndModal] = useState<{ expense: Expense } | { group: MergedRecord } | null>(null);

  async function handleEndSingle(expense: Expense) {
    setEndModal({ expense });
  }

  async function handleEndGroup(group: MergedRecord) {
    setEndModal({ group });
  }

  async function handleEndConfirm(sellBack: number) {
    const modal = endModal;
    if (!modal) return;

    const today = getToday();
    const isGroup = 'group' in modal;

    if (isGroup) {
      const g = (modal as { group: MergedRecord }).group;
      const totalAmt = g.totalAmount;
      for (const { expense } of g.items) {
        // Split sellback proportionally by item's share of total amount
        const share = totalAmt > 0 ? expense.amount / totalAmt : 1 / g.count;
        const itemSellBack = sellBack > 0 ? Math.round(sellBack * share * 100) / 100 : 0;
        await updateExpense(expense.id!, { endDate: today, sellBack: itemSellBack });
      }
      if (sellBack > 0) {
        await addExpense({
          type: 'income',
          amount: sellBack,
          category: '退款',
          description: `${g.description} 出售回血`,
          date: today,
          isBigPurchase: false,
        });
      }
    } else {
      const e = (modal as { expense: Expense }).expense;
      await updateExpense(e.id!, { endDate: today, sellBack });
      if (sellBack > 0) {
        await addExpense({
          type: 'income',
          amount: sellBack,
          category: '退款',
          description: `${e.description} 出售回血`,
          date: today,
          isBigPurchase: false,
        });
      }
    }
    setEndModal(null);
    refresh();
  }

  async function handleReopenGroup(group: MergedRecord) {
    const desc = `${group.description} 出售回血`;
    const allExpenses = await getAllExpenses();
    const incomeRecord = allExpenses.find(
      (e) => e.type === 'income' && e.category === '退款' && e.description === desc
    );
    const msg = incomeRecord
      ? `重新激活「${group.description}」的 ${group.count} 笔资产吗？\n\n将同时删除对应的回血收入记录（${formatAmount(incomeRecord.amount)}），实际日均将恢复为原始价格计算。`
      : `确定将「${group.description}」全部 ${group.count} 笔重新激活吗？`;
    if (!confirm(msg)) return;

    for (const { expense } of group.items) {
      await updateExpense(expense.id!, { endDate: undefined, sellBack: 0 } as Partial<Expense>);
    }
    if (incomeRecord) {
      await deleteExpense(incomeRecord.id!);
    }
    refresh();
  }

  async function handleReopen(expense: Expense) {
    const desc = `${expense.description} 出售回血`;
    const allExpenses = await getAllExpenses();
    const incomeRecord = allExpenses.find(
      (e) => e.type === 'income' && e.category === '退款' && e.description === desc
    );
    const msg = incomeRecord
      ? `重新激活「${expense.description}」吗？\n\n将同时删除对应的回血收入记录（${formatAmount(incomeRecord.amount)}），实际日均将恢复为原始价格计算。`
      : `确定将「${expense.description}」重新激活吗？`;
    if (!confirm(msg)) return;

    await updateExpense(expense.id!, { endDate: undefined, sellBack: 0 } as Partial<Expense>);
    if (incomeRecord) {
      await deleteExpense(incomeRecord.id!);
    }
    refresh();
  }

  function toggleCat(cat: string) {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  if (enriched.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-5">资产分析</h1>
        <div className="text-center py-16">
          <div className="text-5xl mb-4">💡</div>
          <div className="text-[var(--color-text-muted)]">还没有资产消费记录</div>
          <p className="text-[var(--color-text-faint)] text-xs mt-2 leading-relaxed">
            记账时打开「标记为资产消费」开关，<br />
            即可看到日均成本和趣味对比分析
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-5">资产分析</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4 stagger-children">
        <div className="glass-card rounded-2xl p-4">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">资产消费总额</div>
          <div className="text-xl font-bold">{formatAmount(summary.totalAmount)}</div>
          <div className="text-xs text-[var(--color-text-faint)] mt-1">
            {summary.activeCount} 件进行中{summary.count > summary.activeCount ? ` · ${summary.count - summary.activeCount} 件已结束` : ''}
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">实际日均合计</div>
          <div className="text-xl font-bold text-cyan-400">{formatAmount(summary.totalDaily)}</div>
          <div className="text-xs text-[var(--color-text-faint)] mt-1">
            {summary.bestValue ? `${summary.bestValue.expense.description} 日均最高` : ''}
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartItems.length > 0 && (
      <div className="glass-card rounded-2xl p-5 mb-5 animate-fade-in-up focus:outline-none">
        {/* Sort tabs */}
        <div className="flex mb-4">
          {([
            ['daily', '实际日均'],
            ['amount', '总价'],
            ['days', '使用天数'],
          ] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                sortBy === key
                  ? 'bg-cyan-600 text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {(() => {
          const maxVal = Math.max(...chartItems.map(e => e.value), 1);
          const colors = ['#9ab9a8', '#cca8a8', '#a3bcc8', '#b8acb8', '#ccc0a4', '#a3bcb4', '#ccb4b4', '#a8bcc4'];

          function labelFontSize(name: string): number {
            const len = name.length;
            if (len <= 6) return 12;
            if (len <= 10) return 10;
            if (len <= 14) return 9;
            return 8;
          }

          function valueLabel(v: number): string {
            if (sortBy === 'days') return `${Math.round(v)}天`;
            return `¥${v.toFixed(2)}`;
          }

          // Split long names into 2 lines based on visual pixel width (>72px threshold)
          function lineWidth(text: string, fs: number): number {
            let w = 0;
            for (const ch of text) {
              w += /[一-鿿　-〿＀-￯×（(）)]/.test(ch) ? fs : fs * 0.55;
            }
            return w;
          }

          const SPLIT_THRESHOLD = 72; // px — wider than this → split into 2 lines

          function splitName(name: string, fs: number): string[] {
            if (lineWidth(name, fs) <= SPLIT_THRESHOLD) return [name];
            const mid = Math.ceil(name.length / 2);
            // Try to split at a word boundary
            const candidates = [mid - 1, mid, mid + 1, mid - 2, mid + 2];
            let best = mid;
            for (const c of candidates) {
              if (c > 0 && c < name.length && /[×（(）)]/.test(name[c])) {
                best = c + 1;
                break;
              }
            }
            if (best <= 0 || best >= name.length) best = mid;
            return [name.slice(0, best), name.slice(best)];
          }

          // Compute max label width — find longest visual line across all items
          let maxLabelW = 0;
          for (const item of chartItems) {
            const fs = labelFontSize(item.name);
            const lines = splitName(item.name, fs);
            for (const line of lines) {
              const w = lineWidth(line, fs);
              if (w > maxLabelW) maxLabelW = w;
            }
          }
          const labelContainerW = Math.max(60, Math.ceil(maxLabelW + 4));
          const lang = labelContainerW;

          return (
            <div className="space-y-1 mt-1">
              {chartItems.map((item, i) => {
                const pct = (item.value / maxVal) * 100;
                const fs = labelFontSize(item.name);
                const lines = splitName(item.name, fs);
                const rowH = lines.length === 2 ? 52 : 36;
                return (
                  <div key={i} className="flex items-center gap-2" style={{ height: rowH + 'px' }}>
                    {/* Label — computed max width so all bars align, text-right */}
                    <div className="shrink-0 flex flex-col justify-center leading-tight text-right" style={{ width: lang + 'px' }}>
                      {lines.map((line, li) => (
                        <span key={li} className="text-[var(--color-text-muted)] block" style={{ fontSize: fs + 'px', lineHeight: '1.25' }}>{line}</span>
                      ))}
                    </div>
                    {/* Bar */}
                    <div className="flex-1 h-full flex items-center">
                      <div
                        className="h-7 rounded-r-md flex items-center justify-end pr-2 transition-all min-w-[4px]"
                        style={{ width: pct + '%', background: colors[i % colors.length] }}
                      >
                        {pct > 20 && (
                          <span className="text-white text-xs font-semibold whitespace-nowrap drop-shadow-sm">
                            {valueLabel(item.value)}
                          </span>
                        )}
                      </div>
                      {pct <= 20 && (
                        <span className="text-xs text-[var(--color-text-muted)] ml-2 whitespace-nowrap">
                          {valueLabel(item.value)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
      )}

      {/* Active Items */}
      {activeGroups.length > 0 && (
        <div className="mb-4 animate-fade-in-up">
          <div className="text-sm font-medium text-[var(--color-text-muted)] mb-3">进行中</div>
          <div className="space-y-3 stagger-children">
            {activeGroups.map(([cat, items]) => (
              <CategorySection
                key={cat}
                category={cat}
                items={items}
                collapsed={collapsedCats.has(cat)}
                onToggle={() => toggleCat(cat)}
                onEndSingle={handleEndSingle}
                onEndGroup={handleEndGroup}
              />
            ))}
          </div>
        </div>
      )}

      {/* Ended Items */}
      {endedGroups.length > 0 && (
        <div>
          <div className="text-sm font-medium text-[var(--color-text-muted)] mb-3">已结束</div>
          <div className="space-y-3 stagger-children">
            {endedGroups.map(([cat, items]) => (
              <CategorySection
                key={cat}
                category={cat}
                items={items}
                collapsed={collapsedCats.has(`ended-${cat}`)}
                onToggle={() => toggleCat(`ended-${cat}`)}
                onEndSingle={handleReopen}
                onEndGroup={handleReopenGroup}
                actionType="reopen"
                isEnded
              />
            ))}
          </div>
        </div>
      )}

      {/* End Asset Modal */}
      {endModal && (
        <EndAssetModal
          modal={endModal}
          onConfirm={(sellBack) => handleEndConfirm(sellBack)}
          onClose={() => setEndModal(null)}
        />
      )}
    </div>
  );
}

// ── End Asset Modal ──
function EndAssetModal({
  modal,
  onConfirm,
  onClose,
}: {
  modal: { expense: Expense } | { group: MergedRecord };
  onConfirm: (sellBack: number) => void;
  onClose: () => void;
}) {
  const [sellBack, setSellBack] = useState('');
  const [category, setCategory] = useState('退款');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const isGroup = 'group' in modal;
  const description = isGroup
    ? (modal as { group: MergedRecord }).group.description
    : (modal as { expense: Expense }).expense.description;
  const totalAmount = isGroup
    ? (modal as { group: MergedRecord }).group.totalAmount
    : (modal as { expense: Expense }).expense.amount;
  const count = isGroup
    ? (modal as { group: MergedRecord }).group.count
    : 1;
  const days = isGroup
    ? (modal as { group: MergedRecord }).group.totalActualDays
    : calcDailyCost((modal as { expense: Expense }).expense)!.actualDays;

  // Auto-fill description on mount
  useEffect(() => {
    setDesc(`${description} 出售回血`);
  }, [description]);

  const num = parseFloat(sellBack);
  const hasSellBack = !isNaN(num) && num > 0;

  async function handleConfirm() {
    setSaving(true);
    await onConfirm(hasSellBack ? num : 0);
    setSaving(false);
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-[var(--color-surface)] rounded-2xl w-[calc(100%-32px)] max-w-sm flex flex-col animate-fade-in-up"
        style={{ maxHeight: 'calc(100vh - 48px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3 shrink-0">
          <h2 className="text-lg font-bold text-[var(--color-text)]">结束使用</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-lg leading-none">&times;</button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-5 flex-1">
          {/* Asset info */}
          <div className="bg-[var(--color-surface-alt)]/60 rounded-xl p-3 mb-4">
            <div className="text-sm font-medium text-[var(--color-text)]">
              {description}
              {count > 1 && <span className="text-xs text-cyan-400 ml-1">×{count}</span>}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-1">
              购入价：{formatAmount(totalAmount)}
              {count > 1 ? `（总价）` : ''}
              {' · '}已用：{days > 0 ? `${days}天` : '尚未开始'}
            </div>
          </div>

          {/* Sell-back section */}
          <div className="mb-4">
            <label className="text-sm text-[var(--color-text-muted)] block mb-2">回血金额（选填）</label>
            <div className="flex items-center gap-2 bg-[var(--color-surface-alt)] rounded-xl px-4 py-3">
              <span className="text-green-400 font-bold text-lg">¥</span>
              <input
                type="number" step="0.01" inputMode="decimal"
                value={sellBack}
                onChange={(e) => setSellBack(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-lg font-bold text-[var(--color-text)] outline-none placeholder-[var(--color-text-faint)] no-spinner"
              />
            </div>
          </div>

          {/* Category & description — only show when sellBack > 0 */}
          {hasSellBack && (
            <div className="bg-[var(--color-surface-alt)]/40 rounded-xl p-3 mb-4 space-y-3">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] block mb-1.5">归入分类</label>
                <div className="flex flex-wrap gap-1.5">
                  {INCOME_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        category === cat
                          ? 'bg-green-600 text-white'
                          : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
                      }`}
                    >
                      {(() => { const CI = INCOME_ICONS[cat] || (() => null); return <CI size={14} />; })()}
                      <span className="ml-1">{cat}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-muted)] block mb-1.5">描述</label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full bg-[var(--color-surface-alt)] rounded-lg px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:ring-1 focus:ring-cyan-600"
                />
              </div>
            </div>
          )}
        </div>

        {/* Fixed footer — always visible */}
        <div className="flex gap-2 p-5 pt-3 shrink-0" style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] active:bg-gray-200 dark:active:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {saving ? '处理中...' : '直接结束'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || !hasSellBack}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-30 ${
              hasSellBack ? 'bg-green-600 active:bg-green-700' : 'bg-gray-500'
            }`}
          >
            {saving ? '处理中...' : hasSellBack ? `确认回血 ${formatAmount(num)}` : '确认回血'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategorySection({
  category,
  items,
  collapsed,
  onToggle,
  onEndSingle,
  onEndGroup,
  actionType = 'end',
  isEnded = false,
}: {
  category: string;
  items: EnrichedItem[];
  collapsed: boolean;
  onToggle: () => void;
  onEndSingle: (e: Expense) => void;
  onEndGroup: (g: MergedRecord) => void;
  actionType?: 'end' | 'reopen';
  isEnded?: boolean;
}) {
  const { singles, groups } = mergeRecords(items);
  const catTotal = items.reduce((s, i) => s + i.expense.amount, 0);

  return (
    <div className={`glass-card rounded-2xl p-4 ${isEnded ? 'opacity-60' : ''}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-2 hover:bg-[var(--color-surface)]/50 rounded-lg transition-colors"
      >
        <span className="text-xs text-[var(--color-text-faint)]">{collapsed ? '▶' : '▼'}</span>
        <span className="text-[var(--color-icon)]">{(() => { const CI = EXPENSE_ICONS[category] || OtherIcon; return <CI size={20} />; })()}</span>
        <span className="text-sm font-medium flex-1 text-left">{category}</span>
        <span className="text-xs text-[var(--color-text-muted)]">
          {items.length} 笔 · {formatAmount(catTotal)}
        </span>
      </button>

      {!collapsed && (
        <div className="space-y-3 mt-3">
          {groups.map((g) => (
            <MergedCard key={g.groupKey} group={g} onEndGroup={onEndGroup} onEndSingle={onEndSingle} actionType={actionType} />
          ))}
          {singles.map(({ expense, cost }) => (
            <ItemCard
              key={expense.id}
              expense={expense}
              cost={cost}
              onAction={onEndSingle}
              actionType={actionType}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MergedItemRow({
  expense,
  cost,
  onEndSingle,
  actionType,
}: {
  expense: Expense;
  cost: CostResult;
  onEndSingle: (e: Expense) => void;
  actionType: 'end' | 'reopen';
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (editing) {
    return (
      <div className="bg-[var(--color-surface-alt)]/60 rounded-lg px-3 py-2.5">
        <AssetEditForm expense={expense} onSave={() => setEditing(false)} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-surface-alt)]/60 rounded-lg px-3 py-2.5">
      {/* Collapsed row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="text-[10px] text-[var(--color-text-faint)] shrink-0">{expanded ? '▼' : '▶'}</span>
        <span className="text-xs text-[var(--color-text-muted)] flex-1">
          {expense.date}
          {cost.isEnded && expense.endDate && ` → ${expense.endDate}`}
        </span>
        <span className="text-sm font-bold text-cyan-400 shrink-0">{formatAmount(expense.amount)}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <>
          <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
            {cost.isEnded && cost.sellBack > 0 && (
              <div className="text-[10px] text-green-400 mb-2">
                回血 {formatAmount(cost.sellBack)} · 净成本 {formatAmount(cost.netAmount)}
              </div>
            )}
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] mb-2">
              <div>
                <div className="text-[var(--color-text-faint)] mb-0.5">已用</div>
                <div className="text-xs">{cost.actualDays > 0 ? `${cost.actualDays}天` : '未开始'}</div>
              </div>
              <div>
                <div className="text-[var(--color-text-faint)] mb-0.5">预计日均</div>
                <div className="text-xs text-cyan-400">{formatAmount(cost.expectedDaily)}</div>
              </div>
              <div>
                <div className="text-[var(--color-text-faint)] mb-0.5">实际日均</div>
                <div className="text-xs">{cost.actualDays > 0 ? formatAmount(cost.actualDaily) : '—'}</div>
              </div>
            </div>
          </div>
          {/* Action buttons */}
          <div className="flex gap-2 mt-0">
            <button
              onClick={() => setEditing(true)}
              className="flex-1 py-1 rounded-md text-[10px] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-cyan-400 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
            >
              ✎ 编辑
            </button>
            {!cost.isEnded && actionType === 'end' && (
              <button
                onClick={(e) => { e.stopPropagation(); onEndSingle(expense); }}
                className="flex-1 py-1 rounded-md text-[10px] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-red-400 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
              >
                结束此笔
              </button>
            )}
            {cost.isEnded && actionType === 'reopen' && (
              <button
                onClick={(e) => { e.stopPropagation(); onEndSingle(expense); }}
                className="flex-1 py-1 rounded-md text-[10px] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-cyan-400 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
              >
                重新激活
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MergedCard({
  group,
  onEndGroup,
  onEndSingle,
  actionType = 'end',
}: {
  group: MergedRecord;
  onEndGroup: (g: MergedRecord) => void;
  onEndSingle: (e: Expense) => void;
  actionType?: 'end' | 'reopen';
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[var(--color-surface-alt)]/60 rounded-xl p-4 ring-1 ring-cyan-600/30">
      {/* Header - clickable */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex justify-between items-start mb-3 text-left"
      >
        <div>
          <div className="font-medium text-sm flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-faint)]">{expanded ? '▼' : '▶'}</span>
            {group.description}
            <span className="text-xs bg-cyan-600/20 text-cyan-400 px-1.5 py-0.5 rounded">
              ×{group.count}
            </span>
          </div>
          <div className="text-xs text-[var(--color-text-muted)] ml-5">
            {group.category} · {group.minDate} 起
            {group.maxEndDate && ` → ${group.maxEndDate} 止`}
            <span className="ml-1 text-[var(--color-text-faint)]">合计 {formatAmount(group.totalAmount)}</span>
            {group.isEnded && group.totalSellBack > 0 && (
              <span className="ml-1 text-green-400">回血 {formatAmount(group.totalSellBack)}</span>
            )}
          </div>
        </div>
      </button>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-[var(--color-surface-alt)] rounded-xl p-2.5 text-center">
          <div className="text-xs text-[var(--color-text-muted)] mb-0.5">已用</div>
          <div className="text-sm font-semibold">
            {group.totalActualDays > 0 ? `${group.totalActualDays} 天` : '尚未开始'}
          </div>
        </div>
        <div className="bg-[var(--color-surface-alt)] rounded-xl p-2.5 text-center">
          <div className="text-xs text-[var(--color-text-muted)] mb-0.5">预计日均</div>
          <div className="text-sm font-semibold text-cyan-400">
            {formatAmount(group.combinedExpectedDaily)}
          </div>
        </div>
        <div className="bg-[var(--color-surface-alt)] rounded-xl p-2.5 text-center">
          <div className="text-xs text-[var(--color-text-muted)] mb-0.5">实际日均</div>
          <div className="text-sm font-semibold">
            {group.totalActualDays > 0 ? formatAmount(group.combinedActualDaily) : '—'}
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-surface-alt)]/50 rounded-xl p-3 space-y-1.5 text-sm">
        <div className="text-[var(--color-text-muted)]">
          <span className="text-[var(--color-text-muted)] text-xs">预计日均 </span>
          {getFunText(group.combinedExpectedDaily)}
        </div>
      </div>

      {!group.allHaveLifespan && (
        <div className="mt-3 bg-amber-900/20 border border-amber-800/30 rounded-xl p-2.5 text-xs text-amber-400">
          部分记录未设置使用时间，默认按 3 年估算，日均偏低。请检查并重建对应记录。
        </div>
      )}

      {/* Expanded individual items */}
      {expanded && (
        <div className="mt-3 border-t border-[var(--color-border)] pt-3 space-y-2">
          {group.items.map(({ expense, cost }) => (
            <MergedItemRow
              key={expense.id}
              expense={expense}
              cost={cost}
              onEndSingle={onEndSingle}
              actionType={actionType}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => onEndGroup(group)}
        className={`w-full mt-3 py-2 rounded-xl text-xs font-medium transition-colors ${
          actionType === 'end'
            ? 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-red-400 active:bg-[var(--color-surface-alt)]'
            : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-cyan-400 active:bg-[var(--color-surface-alt)]'
        }`}
      >
        {actionType === 'end' ? '全部结束使用' : '全部重新激活'}
      </button>
    </div>
  );
}

function AssetEditForm({
  expense,
  onSave,
  onCancel,
}: {
  expense: Expense;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { refresh } = useDataRefresh();
  const t = expense.type || 'expense';
  const [editType, setEditType] = useState<'expense' | 'income'>(t);
  const [editAmount, setEditAmount] = useState(String(expense.amount));
  const [editCategory, setEditCategory] = useState(expense.category);
  const [editDesc, setEditDesc] = useState(expense.description);
  const [editDate, setEditDate] = useState(expense.date);
  const [editIsAsset, setEditIsAsset] = useState(!!expense.isBigPurchase);
  const ly = expense.lifespanYears || 0;
  const [editLifespanY, setEditLifespanY] = useState(Math.floor(ly));
  const [editLifespanM, setEditLifespanM] = useState(Math.round((ly - Math.floor(ly)) * 12));
  const [editSaving, setEditSaving] = useState(false);

  const cats = editType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const catIcons = editType === 'expense' ? EXPENSE_ICONS : INCOME_ICONS;
  const isExpense = editType === 'expense';

  async function handleSave() {
    const num = parseFloat(editAmount);
    if (!num || num <= 0) { alert('请输入有效的金额'); return; }
    if (isExpense && editIsAsset && editLifespanY === 0 && editLifespanM === 0) {
      alert('请填写预计使用时间');
      return;
    }
    setEditSaving(true);
    try {
      const groupKey = (isExpense && editIsAsset)
        ? `${editCategory}:${editDesc.trim() || editCategory}`
        : undefined;
      await updateExpense(expense.id!, {
        type: editType,
        amount: num,
        category: editCategory,
        description: editDesc.trim() || editCategory,
        date: editDate,
        isBigPurchase: isExpense && editIsAsset,
        lifespanYears: (isExpense && editIsAsset)
          ? (editLifespanY + editLifespanM / 12)
          : undefined,
        groupKey,
      });
      refresh();
      onSave();
    } catch {
      alert('保存失败');
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Type toggle */}
      <div className="bg-[var(--color-surface-alt)] rounded-lg p-0.5 flex">
        <button
          type="button"
          onClick={() => setEditType('expense')}
          className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${isExpense ? 'bg-cyan-600 text-white' : 'text-[var(--color-text-muted)]'}`}
        >支出</button>
        <button
          type="button"
          onClick={() => setEditType('income')}
          className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors ${!isExpense ? 'bg-green-600 text-white' : 'text-[var(--color-text-muted)]'}`}
        >收入</button>
      </div>
      {/* Amount */}
      <div className="flex items-center gap-2">
        <span className={`font-bold text-lg ${isExpense ? 'text-cyan-400' : 'text-green-400'}`}>¥</span>
        <input
          type="number" step="0.01" inputMode="decimal"
          value={editAmount}
          onChange={(e) => setEditAmount(e.target.value)}
          className="flex-1 bg-[var(--color-surface-alt)] rounded-lg px-3 py-2 text-lg font-bold text-[var(--color-text)] outline-none focus:ring-1 focus:ring-cyan-600 no-spinner"
        />
      </div>
      {/* Category */}
      <div className="flex flex-wrap gap-1.5">
        {cats.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setEditCategory(cat)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors ${
              editCategory === cat
                ? 'bg-cyan-600 text-white ring-1 ring-cyan-600'
                : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)]'
            }`}
          >
            {(() => { const CI = catIcons[cat]; return <CI size={16} />; })()}
            {cat}
          </button>
        ))}
      </div>
      {/* Description */}
      <input
        type="text"
        value={editDesc}
        onChange={(e) => setEditDesc(e.target.value)}
        placeholder="描述"
        className="w-full bg-[var(--color-surface-alt)] rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-text)] outline-none focus:ring-1 focus:ring-cyan-600 placeholder-[var(--color-text-faint)]"
      />
      {/* Date */}
      <DatePicker value={editDate} onChange={setEditDate} transparent />
      {/* Asset toggle */}
      {isExpense && (
        <div className="bg-[var(--color-surface-alt)] rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-[var(--color-text)]">标记为资产消费</div>
            <button
              type="button"
              onClick={() => setEditIsAsset(!editIsAsset)}
              className={`relative w-10 h-5 rounded-full transition-colors ${editIsAsset ? 'bg-cyan-600' : 'bg-gray-400/50'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${editIsAsset ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {editIsAsset && (
            <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
              <label className="text-xs font-semibold text-[var(--color-text)] block mb-2">预计使用时间</label>
              <LifespanPicker
                years={editLifespanY}
                months={editLifespanM}
                onYearsChange={setEditLifespanY}
                onMonthsChange={setEditLifespanM}
              />
            </div>
          )}
        </div>
      )}
      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={editSaving}
          className={`flex-1 py-2 rounded-lg text-sm font-medium text-white active:opacity-80 disabled:opacity-50 ${isExpense ? 'bg-cyan-600' : 'bg-green-600'}`}
        >{editSaving ? '保存中...' : '保存'}</button>
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg text-sm font-semibold text-[var(--color-text)] bg-[var(--color-surface-alt)] active:bg-gray-200 dark:active:bg-gray-700"
        >取消</button>
      </div>
    </div>
  );
}

function ItemCard({
  expense,
  cost,
  onAction,
  actionType,
}: {
  expense: Expense;
  cost: CostResult;
  onAction: (e: Expense) => void;
  actionType: 'end' | 'reopen';
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isOverExpected = cost.actualDays > cost.lifespanDays;

  if (editing) {
    return (
      <div className="bg-[var(--color-surface-alt)]/60 rounded-xl p-4">
        <AssetEditForm expense={expense} onSave={() => setEditing(false)} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-surface-alt)]/60 rounded-xl p-4">
      {/* Collapsed row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-left"
      >
        <span className="text-xs text-[var(--color-text-faint)] shrink-0">{expanded ? '▼' : '▶'}</span>
        <span className="text-sm font-medium text-[var(--color-text)] flex-1 truncate">{expense.description}</span>
        <span className="text-sm font-bold text-cyan-400 shrink-0">{formatAmount(expense.amount)}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <>
          <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
            <div className="text-xs text-[var(--color-text-muted)] mb-3">
              {expense.date} 购入
              {cost.isEnded && expense.endDate && ` → ${expense.endDate} 结束`}
            </div>
            {cost.isEnded && cost.sellBack > 0 && (
              <div className="text-xs text-green-400 mb-3">
                回血 {formatAmount(cost.sellBack)} · 净成本 {formatAmount(cost.netAmount)}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-[var(--color-surface-alt)] rounded-xl p-2.5 text-center">
                <div className="text-xs text-[var(--color-text-muted)] mb-0.5">{cost.isEnded ? '实际使用' : '已用'}</div>
                <div className="text-sm font-semibold">
                  {cost.actualDays > 0 ? `${cost.actualDays} 天` : '尚未开始'}
                </div>
              </div>
              <div className="bg-[var(--color-surface-alt)] rounded-xl p-2.5 text-center">
                <div className="text-xs text-[var(--color-text-muted)] mb-0.5">预计日均</div>
                <div className="text-sm font-semibold text-cyan-400">
                  {formatAmount(cost.expectedDaily)}
                </div>
              </div>
              <div className="bg-[var(--color-surface-alt)] rounded-xl p-2.5 text-center">
                <div className="text-xs text-[var(--color-text-muted)] mb-0.5">实际日均</div>
                <div className="text-sm font-semibold">
                  {cost.actualDays > 0 ? formatAmount(cost.actualDaily) : '—'}
                </div>
              </div>
            </div>

            {/* Fun comparison */}
            <div className="bg-[var(--color-surface-alt)]/50 rounded-xl p-3 space-y-1.5 text-sm mb-3">
              <div className="text-[var(--color-text-muted)]">
                <span className="text-[var(--color-text-muted)] text-xs">预计 </span>
                {getFunText(cost.expectedDaily)}
              </div>
              {cost.actualDays > 0 && (
                <div className="text-[var(--color-text-muted)]">
                  <span className="text-[var(--color-text-muted)] text-xs">实际 </span>
                  {getFunText(cost.actualDaily)}
                </div>
              )}
            </div>

            {/* Lifespan Progress */}
            {!cost.hasLifespan && (
              <div className="mt-3 bg-amber-900/20 border border-amber-800/30 rounded-xl p-2.5 text-xs text-amber-400">
                未设置使用时间，默认按 3 年估算。建议删除后重新记账并填写使用时间。
              </div>
            )}
            {cost.hasLifespan && expense.lifespanYears && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1.5">
                  <span>
                    {cost.isEnded
                      ? isOverExpected
                        ? '实际使用超过预期，很划算！'
                        : `实际使用 ${cost.actualDays} 天 / 预期 ${Math.round(cost.lifespanDays)} 天`
                      : `预计使用 ${formatLifespan(expense.lifespanYears)}`}
                  </span>
                  <span className={isOverExpected ? 'text-amber-400' : cost.isEnded ? 'text-[var(--color-text-muted)]' : ''}>
                    {cost.usagePct}%
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOverExpected ? 'bg-amber-500' : cost.isEnded ? 'bg-gray-500' : 'bg-cyan-500'
                    }`}
                    style={{ width: `${Math.min(100, cost.usagePct)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setEditing(true)}
              className="flex-1 py-2 rounded-xl text-xs font-medium bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-cyan-400 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
            >
              ✎ 编辑
            </button>
            <button
              onClick={() => onAction(expense)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                actionType === 'end'
                  ? 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-red-400 active:bg-gray-200 dark:active:bg-gray-700'
                  : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-cyan-400 active:bg-gray-200 dark:active:bg-gray-700'
              }`}
            >
              {actionType === 'end' ? '结束使用' : '重新激活'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
