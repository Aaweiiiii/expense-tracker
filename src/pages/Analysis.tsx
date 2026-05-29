import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBigPurchases, updateExpense } from '../db';
import { formatAmount, formatLifespan, getToday } from '../utils/format';
import type { Expense } from '../types';
import { EXPENSE_ICONS, OtherIcon } from '../components/Icon';
import { useDataRefresh } from '../hooks/useData';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

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

  const expectedDaily = e.amount / lifespanDays;
  const actualDaily = actualDays > 0 ? e.amount / actualDays : 0;
  const usagePct = actualDays > 0 ? Math.min(100, Math.round((actualDays / lifespanDays) * 100)) : 0;

  return { actualDays, lifespanDays, expectedDaily, actualDaily, usagePct, isEnded, hasLifespan };
}

type CostResult = NonNullable<ReturnType<typeof calcDailyCost>>;
type EnrichedItem = { expense: Expense; cost: CostResult };

type MergedRecord = {
  items: EnrichedItem[];
  groupKey: string;
  description: string;
  category: string;
  totalAmount: number;
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
    const count = groupItems.length;
    const totalActualDays = groupItems.reduce((s, i) => s + i.cost.actualDays, 0);
    const totalLifespanDays = groupItems.reduce((s, i) => s + i.cost.lifespanDays, 0);
    const combinedExpectedDaily = totalAmount / totalLifespanDays;
    const combinedActualDaily = totalActualDays > 0 ? totalAmount / totalActualDays : 0;
    const dates = groupItems.map((i) => i.expense.date).sort();
    const allHaveLifespan = groupItems.every((i) => i.cost.hasLifespan);
    groups.push({
      items: groupItems,
      groupKey,
      description: groupItems[0].expense.description,
      category: groupItems[0].expense.category,
      totalAmount,
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
    const entries: { name: string; value: number; fullName: string }[] = [];

    for (const g of groups) {
      let value: number;
      if (sortBy === 'daily') value = g.combinedActualDaily;
      else if (sortBy === 'amount') value = g.totalAmount;
      else value = g.totalActualDays;

      const label = `${g.description}×${g.count}`;
      entries.push({
        name: label.length > 8 ? label.slice(0, 8) + '…' : label,
        value: Math.round(value * 100) / 100,
        fullName: label,
      });
    }

    for (const { expense, cost } of singles) {
      let value: number;
      if (sortBy === 'daily') value = cost.actualDaily;
      else if (sortBy === 'amount') value = expense.amount;
      else value = cost.actualDays;

      entries.push({
        name: expense.description.length > 8 ? expense.description.slice(0, 8) + '…' : expense.description,
        value: Math.round(value * 100) / 100,
        fullName: expense.description,
      });
    }

    return entries
      .filter((e) => isFinite(e.value) && !isNaN(e.value))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [enriched, sortBy]);

  const chartTitle = {
    daily: '实际日均成本排行',
    amount: '总价排行',
    days: '使用天数排行',
  }[sortBy];

  const chartTooltip = {
    daily: '实际日均',
    amount: '总价',
    days: '使用天数',
  }[sortBy];

  function chartTooltipFormat(value: number): string {
    if (!isFinite(value)) return '—';
    if (sortBy === 'days') return `${value} 天`;
    return `¥${value.toFixed(2)}`;
  }

  async function handleEnd(expense: Expense) {
    await updateExpense(expense.id!, { endDate: getToday() });
    refresh();
  }

  async function handleEndSingle(expense: Expense) {
    if (!confirm(`确定将「${expense.description}」标记为结束使用吗？`)) return;
    await handleEnd(expense);
  }

  async function handleEndGroup(group: MergedRecord) {
    if (!confirm(`确定将「${group.description}」全部 ${group.count} 笔标记为结束吗？`)) return;
    for (const { expense } of group.items) {
      await updateExpense(expense.id!, { endDate: getToday() });
    }
    refresh();
  }

  async function handleReopenGroup(group: MergedRecord) {
    if (!confirm(`确定将「${group.description}」全部 ${group.count} 笔重新激活吗？`)) return;
    for (const { expense } of group.items) {
      await updateExpense(expense.id!, { endDate: undefined } as Partial<Expense>);
    }
    refresh();
  }

  async function handleReopen(expense: Expense) {
    if (!confirm(`确定将「${expense.description}」重新激活吗？`)) return;
    await updateExpense(expense.id!, { endDate: undefined } as Partial<Expense>);
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

      {/* Sort Controls */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-[var(--color-text-muted)] mr-1">排序：</span>
        {([
          ['daily', '实际日均'],
          ['amount', '总价'],
          ['days', '使用天数'],
        ] as [SortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              sortBy === key
                ? 'bg-cyan-600/20 text-cyan-400'
                : 'glass-card text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {chartItems.length > 0 && (
      <div className="glass-card rounded-2xl p-5 mb-5 animate-fade-in-up focus:outline-none">
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-4">{chartTitle}</h2>
        <ResponsiveContainer width="100%" height={Math.max(80, chartItems.length * 36 + 20)}>
          <BarChart
            data={chartItems}
            layout="vertical"
            margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
              width={70}
            />
            <Tooltip
              cursor={false}
              formatter={(value) => [chartTooltipFormat(value as number), chartTooltip]}
              contentStyle={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '12px',
                color: 'var(--color-text)',
                fontSize: '13px',
              }}
              labelStyle={{ color: 'var(--color-text-muted)' }}
              itemStyle={{ color: 'var(--color-text)' }}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {chartItems.map((_, i) => (
                <Cell
                  key={i}
                  fill={
                    ['#9ab9a8', '#cca8a8', '#a3bcc8', '#b8acb8', '#ccc0a4', '#a3bcb4', '#ccb4b4', '#a8bcc4'][i]
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
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
    <div className={isEnded ? 'opacity-60' : ''}>
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
        <div className="space-y-3 mt-1 ml-4">
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
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="glass-card rounded-2xl p-4 ring-1 ring-cyan-600/30">
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
            <div key={expense.id} className="bg-[var(--color-surface-alt)]/60 rounded-lg px-3 py-2.5">
              {/* First row: date + amount */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-[var(--color-text-muted)]">
                  {expense.date}
                  {cost.isEnded && expense.endDate && ` → ${expense.endDate}`}
                </span>
                <span className="text-sm font-bold text-cyan-400">{formatAmount(expense.amount)}</span>
              </div>
              {/* Second row: labeled stats */}
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
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
              {/* Action button */}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/add?edit=${expense.id}`); }}
                  className="flex-1 py-1 rounded-md text-[10px] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-cyan-400 active:bg-gray-600 transition-colors"
                >
                  ✎ 编辑
                </button>
                {!cost.isEnded && actionType === 'end' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onEndSingle(expense); }}
                    className="flex-1 py-1 rounded-md text-[10px] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-red-400 active:bg-gray-600 transition-colors"
                  >
                    结束此笔
                  </button>
                )}
                {cost.isEnded && actionType === 'reopen' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onEndSingle(expense); }}
                    className="flex-1 py-1 rounded-md text-[10px] bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-cyan-400 active:bg-gray-600 transition-colors"
                  >
                    重新激活
                  </button>
                )}
              </div>
            </div>
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
  const navigate = useNavigate();
  const isOverExpected = cost.actualDays > cost.lifespanDays;

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-medium text-sm">{expense.description}</div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {expense.date} 购入
            {cost.isEnded && expense.endDate && ` → ${expense.endDate} 结束`}
          </div>
        </div>
        <div className="text-base font-bold text-cyan-400">
          {formatAmount(expense.amount)}
        </div>
      </div>

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
      <div className="bg-[var(--color-surface-alt)]/50 rounded-xl p-3 space-y-1.5 text-sm">
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

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => navigate(`/add?edit=${expense.id}`)}
          className="flex-1 py-2 rounded-xl text-xs font-medium bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-cyan-400 active:bg-[var(--color-surface-alt)] transition-colors"
        >
          ✎ 编辑
        </button>
        <button
          onClick={() => onAction(expense)}
          className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
            actionType === 'end'
              ? 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-red-400 active:bg-[var(--color-surface-alt)]'
              : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:text-cyan-400 active:bg-[var(--color-surface-alt)]'
          }`}
        >
          {actionType === 'end' ? '结束使用' : '重新激活'}
        </button>
      </div>
    </div>
  );
}
