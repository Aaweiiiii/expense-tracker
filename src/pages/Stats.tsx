import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getAllExpenses } from '../db';
import { getMonthStart, getMonthEnd, getMonthLabel, formatAmount, getCurrentYear, getCurrentMonth, getToday } from '../utils/format';
import { type Expense } from '../types';
import { EXPENSE_ICONS, INCOME_ICONS, OtherIcon, OtherIncomeIcon } from '../components/Icon';
import { useDataRefresh } from '../hooks/useData';
import { generateMonthlyReview, getCachedReview, setCachedReview, hasApiKey } from '../utils/ai';
import detailIcon from '../assets/068_明细.png';
import dataAnalysisIcon from '../assets/数据分析.png';

export function Stats() {
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [year, setYear] = useState(getCurrentYear());
  const [month, setMonth] = useState(getCurrentMonth());
  const { refreshKey } = useDataRefresh();
  const [aiReview, setAiReview] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const today = getToday();

  useEffect(() => {
    getAllExpenses().then(setAllExpenses);
  }, [refreshKey]);

  // Available months from data
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    for (const e of allExpenses) {
      const [y, m] = e.date.split('-');
      months.add(`${y}-${m}`);
    }
    months.add(`${getCurrentYear()}-${String(getCurrentMonth()).padStart(2, '0')}`);
    return Array.from(months).sort().reverse();
  }, [allExpenses]);

  // Filter for selected month
  const monthStart = useMemo(() => getMonthStart(year, month), [year, month]);
  const monthEnd = useMemo(() => getMonthEnd(year, month), [year, month]);

  const { monthExpenses, expenseTotal, incomeTotal, byCategory, dailyData } = useMemo(() => {
    const start = monthStart;
    const end = monthEnd;
    const filtered = allExpenses.filter((e) => e.date >= start && e.date <= end);
    const expenses = filtered.filter((e) => (e.type || 'expense') === 'expense');
    const income = filtered.filter((e) => e.type === 'income');
    const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
    const incomeTotal = income.reduce((s, e) => s + e.amount, 0);

    // Category breakdown — expenses only
    const catMap = new Map<string, number>();
    for (const e of expenses) {
      catMap.set(e.category, (catMap.get(e.category) || 0) + e.amount);
    }

    // Daily totals for trend — fill all days of the month, expenses only
    const dayMap = new Map<string, number>();
    for (const e of expenses) {
      dayMap.set(e.date, (dayMap.get(e.date) || 0) + e.amount);
    }
    const daysInMonth = parseInt(end.split('-')[2]);
    const daily = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${start.slice(0, 7)}-${String(day).padStart(2, '0')}`;
      daily.push({
        date: `${day}日`,
        total: dayMap.get(dateStr) || 0,
      });
    }

    return { monthExpenses: filtered, expenseTotal, incomeTotal, byCategory: catMap, dailyData: daily };
  }, [allExpenses, year, month]);

  const sortedCategories = useMemo(
    () => Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]),
    [byCategory]
  );
  const maxTotal = Math.max(...sortedCategories.map(([, t]) => t), 1);

  // Map full date → expenses for bar-click detail
  const dayRecordsMap = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of allExpenses) {
      if (e.date >= monthStart && e.date <= monthEnd) {
        const arr = map.get(e.date) || [];
        arr.push(e);
        map.set(e.date, arr);
      }
    }
    return map;
  }, [allExpenses, monthStart, monthEnd]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const clickStartRef = useRef({ x: 0, y: 0 });

  // AI review data + cache
  const aiData = useMemo(() => {
    const categoryBreakdown = sortedCategories.map(([cat, total]) => ({
      category: cat,
      total,
      pct: expenseTotal > 0 ? Math.round((total / expenseTotal) * 1000) / 10 : 0,
    }));
    const topDayEntry = dailyData.reduce((best, d) => d.total > best.total ? d : best, dailyData[0] || { date: '', total: 0 });
    const topItems = monthExpenses
      .filter((e) => (e.type || 'expense') === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((e) => ({ date: e.date, description: e.description || e.category, amount: e.amount, category: e.category }));
    return {
      year,
      month,
      expenseTotal,
      incomeTotal,
      recordCount: monthExpenses.length,
      categoryBreakdown,
      dailyAvg: dailyData.length > 0 ? expenseTotal / dailyData.length : 0,
      topDay: topDayEntry.total > 0 ? { date: `${month}月${topDayEntry.date}`, total: topDayEntry.total } : null,
      topItems,
    };
  }, [year, month, expenseTotal, incomeTotal, monthExpenses.length, sortedCategories, dailyData]);

  const cacheKey = `review_${year}_${String(month).padStart(2, '0')}`;

  // Load cached review when month changes
  useEffect(() => {
    const cached = getCachedReview(cacheKey);
    setAiReview(cached || '');
    setAiError('');
  }, [cacheKey]);

  async function handleGenerateReview() {
    setAiLoading(true);
    setAiError('');
    try {
      const result = await generateMonthlyReview(aiData);
      setAiReview(result);
      setCachedReview(cacheKey, result);
    } catch (e) {
      setAiError('生成失败，请检查网络后重试');
    } finally {
      setAiLoading(false);
    }
  }
  const maxDaily = Math.max(...dailyData.map((d) => d.total), 1);

  // Y-axis scale — preset steps, 4–19 non-zero ticks, niceMax strictly > max
  const yScale = useMemo(() => {
    const max = maxDaily;
    if (max <= 0) return { ticks: [0, 20, 40, 60, 80], niceMax: 80 };

    const steps = [10000, 5000, 2000, 1000, 500, 100, 50, 20]; // large to small

    for (const step of steps) {
      let n = Math.ceil(max / step);
      if (n * step <= max) n++; // ensure niceMax > max
      if (n >= 4 && n <= 19) {
        const niceMax = step * (n + 1);
        const ticks: number[] = [0];
        for (let i = step; i <= niceMax + 0.001; i += step) {
          ticks.push(i);
        }
        return { ticks, niceMax };
      }
    }

    // Fallback: use smallest step with minimum 4 ticks
    const niceMax = 20 * 4;
    return { ticks: [0, 20, 40, 60, 80], niceMax };
  }, [maxDaily]);

  function formatYTick(v: number): string {
    if (v === 0) return '0';
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return String(Math.round(v));
  }

  // Auto-scroll to today on mount/month change
  useEffect(() => {
    if (!scrollRef.current) return;
    const todayIdx = dailyData.findIndex((d) => {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(parseInt(d.date)).padStart(2, '0')}`;
      return dateStr === today;
    });
    if (todayIdx >= 0) {
      const dayWidth = 32; // 28px width + 4px gap
      const containerWidth = scrollRef.current.clientWidth;
      const scrollTo = todayIdx * dayWidth - containerWidth / 2 + 14;
      scrollRef.current.scrollLeft = Math.max(0, scrollTo);
    }
  }, [dailyData]);

  function scrollChart(dir: 'left' | 'right') {
    if (!scrollRef.current) return;
    const amount = dir === 'left' ? -280 : 280;
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  }

  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, scroll: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, scroll: scrollRef.current.scrollLeft };
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function onMouseMove(e: MouseEvent) {
      if (!scrollRef.current) return;
      const dx = e.clientX - dragStart.current.x;
      scrollRef.current.scrollLeft = dragStart.current.scroll - dx;
    }
    function onMouseUp() { setDragging(false); }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging]);

  function goPrevMonth() {
    const current = `${year}-${String(month).padStart(2, '0')}`;
    const idx = availableMonths.indexOf(current);
    if (idx >= 0 && idx < availableMonths.length - 1) {
      const [y, m] = availableMonths[idx + 1].split('-');
      setYear(parseInt(y));
      setMonth(parseInt(m));
    }
  }

  function goNextMonth() {
    const current = `${year}-${String(month).padStart(2, '0')}`;
    const idx = availableMonths.indexOf(current);
    if (idx > 0) {
      const [y, m] = availableMonths[idx - 1].split('-');
      setYear(parseInt(y));
      setMonth(parseInt(m));
    }
  }

  return (
    <div>
      {/* Month Navigator */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={goPrevMonth} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xl px-2">&lt;</button>
        <select
          value={`${year}-${String(month).padStart(2, '0')}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split('-');
            setYear(parseInt(y));
            setMonth(parseInt(m));
          }}
          className="bg-transparent text-lg font-bold text-center appearance-none cursor-pointer outline-none"
        >
          {availableMonths.map((ym) => (
            <option key={ym} value={ym} className="bg-[var(--color-surface)]">
              {(() => { const [y, m] = ym.split('-'); return getMonthLabel(parseInt(y), parseInt(m)); })()}
            </option>
          ))}
        </select>
        <button onClick={goNextMonth} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xl px-2">&gt;</button>
      </div>

      {/* Month Total */}
      <div className="glass-card rounded-2xl p-5 mb-5 animate-fade-in-up">
        <div className="flex justify-between items-end">
          <div>
            <div className="text-sm mb-1" style={{ color: 'var(--macaron-pink)' }}>本月支出</div>
            <div className="text-4xl font-bold" style={{ color: 'var(--macaron-pink)' }}>{formatAmount(expenseTotal)}</div>
          </div>
          {incomeTotal > 0 && (
            <div className="text-right">
              <div className="text-[var(--macaron-mint)] text-sm mb-1">本月收入</div>
              <div className="text-2xl font-bold text-[var(--macaron-mint)]">{formatAmount(incomeTotal)}</div>
            </div>
          )}
        </div>
        <div className="text-[var(--color-text-muted)] text-xs mt-2 flex justify-between">
          <span>共 {monthExpenses.length} 笔 · 日均支出 <span style={{ color: 'var(--macaron-pink)' }}>{formatAmount(dailyData.length > 0 ? expenseTotal / dailyData.length : 0)}</span></span>
          {incomeTotal > 0 && (
            <span className="text-[var(--color-text-muted)]">
              结余 <span className="text-[var(--macaron-mint)]">{formatAmount(incomeTotal - expenseTotal)}</span>
            </span>
          )}
        </div>
      </div>

      {monthExpenses.length === 0 ? (
        <div className="text-center text-[var(--color-text-faint)] py-10">
          {getMonthLabel(year, month)}暂无消费数据
        </div>
      ) : (
        <>
          {/* Daily Trend Bars */}
          <div className="glass-card rounded-2xl px-2 py-5 mb-4 animate-fade-in-up">
            <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-4 px-3">每日趋势</h2>
            <div className="flex items-stretch gap-0 select-none" style={{ height: '180px' }}>
              {/* Left arrow */}
              <button
                type="button"
                onClick={() => scrollChart('left')}
                className="flex items-center justify-center w-4 shrink-0 text-[var(--color-text-faint)] hover:text-[var(--color-text)] active:text-[var(--macaron-mint)] transition-colors"
              >
                <span className="text-4xl leading-none">＜</span>
              </button>
              {/* Y-axis */}
              <div className="relative shrink-0" style={{ width: '34px' }}>
                {yScale.ticks.slice().reverse().map((v) => (
                  <span
                    key={v}
                    className="absolute right-0 text-[10px] text-[var(--color-text-muted)] leading-none whitespace-nowrap"
                    style={{
                      bottom: `${Math.min(179, 18 + (v / yScale.niceMax) * 162)}px`,
                      transform: 'translateY(50%)',
                    }}
                  >
                    {formatYTick(v)}
                  </span>
                ))}
              </div>
              {/* Chart */}
              <div
                ref={scrollRef}
                className="overflow-x-auto scrollbar-hide flex-1"
                style={{ cursor: dragging ? 'grabbing' : 'grab' }}
                onMouseDown={onMouseDown}
              >
                <div className="relative h-full" style={{ minWidth: `${dailyData.length * 32}px` }}>
                  {/* Bars */}
                  <div className="flex gap-1 h-full">
                    {dailyData.map(({ date, total }) => {
                      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(parseInt(date)).padStart(2, '0')}`;
                      const isToday = dateStr === today;
                      const barH = total > 0 ? Math.max(4, (total / yScale.niceMax) * 161) : 0;
                      const barLabel = total > 0 ? String(Math.round(total)) : '';
                      const digits = barLabel.length;
                      const labelSize = digits <= 2 ? 10 : digits <= 3 ? 9 : digits <= 4 ? 8 : digits <= 5 ? 7 : 6;
                      const isActive = selectedDate === dateStr;
                      return (
                      <div key={date} className="relative" style={{ width: '28px', flexShrink: 0, height: '100%' }}
                        onMouseDown={(e) => { clickStartRef.current = { x: e.clientX, y: e.clientY }; }}
                        onMouseUp={(e) => {
                          const dx = e.clientX - clickStartRef.current.x;
                          const dy = e.clientY - clickStartRef.current.y;
                          if (Math.abs(dx) < 4 && Math.abs(dy) < 4) {
                            setSelectedDate(selectedDate === dateStr ? null : dateStr);
                          }
                        }}
                      >
                        {barH > 0 && (
                          <>
                            <div
                              className="absolute left-0 right-0 rounded-t-sm cursor-pointer"
                              style={{ bottom: '18px', height: `${barH}px`, animation: 'growUp 0.25s ease-out both', transformOrigin: 'bottom', background: isActive ? 'linear-gradient(to top, #4eb8cc, #60cee8)' : 'linear-gradient(to top, #6aaccc, #84c2e4)' }}
                            />
                            <span
                              className="absolute left-0 right-0 text-center text-[var(--color-text-muted)] whitespace-nowrap"
                              style={{ bottom: `${18 + barH + 2}px`, fontSize: `${labelSize}px` }}
                            >
                              {barLabel}
                            </span>
                          </>
                        )}
                        <span className={`absolute left-0 right-0 text-center text-[10px] whitespace-nowrap ${isToday ? 'text-[var(--macaron-mint)] font-medium' : 'text-[var(--color-text-muted)] font-semibold'} ${isActive ? 'text-cyan-400 font-medium' : ''}`} style={{ bottom: 0 }}>{date}</span>
                      </div>
                      );
                    })}
                  </div>
                  {/* Grid lines */}
                  {yScale.ticks.slice().reverse().map((v) => (
                    <div
                      key={v}
                      className="absolute left-0 right-0 pointer-events-none"
                      style={{
                        bottom: `${Math.min(179, 18 + (v / yScale.niceMax) * 162)}px`,
                        height: '1px',
                        backgroundImage: `repeating-linear-gradient(to right, var(--chart-grid) 0px, var(--chart-grid) 4px, transparent 4px, transparent 8px)`,
                      }}
                    />
                  ))}
                </div>
              </div>
              {/* Right spacer — balances Y-axis width for centering */}
              <div className="shrink-0" style={{ width: '34px' }} />
              {/* Right arrow */}
              <button
                type="button"
                onClick={() => scrollChart('right')}
                className="flex items-center justify-center w-4 shrink-0 text-[var(--color-text-faint)] hover:text-[var(--color-text)] active:text-[var(--macaron-mint)] transition-colors"
              >
                <span className="text-4xl leading-none">＞</span>
              </button>
            </div>

            {/* Selected Day Detail — inside chart card */}
            {selectedDate && dayRecordsMap.has(selectedDate) && (() => {
              const records = dayRecordsMap.get(selectedDate)!;
              const expRecords = records.filter(e => (e.type || 'expense') === 'expense').sort((a, b) => b.amount - a.amount);
              const incRecords = records.filter(e => e.type === 'income').sort((a, b) => b.amount - a.amount);
              const [, sm2, sd2] = selectedDate.split('-').map(Number);
              return (
                <div className="mt-4 pt-4 border-t border-[var(--color-border)] animate-fade-in-up">
                  <div className="flex items-center justify-between mb-3 px-3">
                    <h3 className="text-sm font-medium text-[var(--color-text)]">{sm2}月{sd2}日 消费明细</h3>
                    <button onClick={() => setSelectedDate(null)} className="text-[var(--color-text)] font-bold hover:text-[var(--color-text-faint)] text-lg leading-none">&times;</button>
                  </div>
                  <div className="space-y-2 px-3">
                    {expRecords.map((e) => {
                      const IconComp = EXPENSE_ICONS[e.category] || OtherIcon;
                      return (
                        <div key={e.id} className="flex items-center gap-3 bg-[var(--color-surface-alt)]/60 rounded-xl px-4 py-2.5">
                          <IconComp size={22} className="shrink-0 text-[var(--color-text)]" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate text-[var(--color-text)] font-medium">{e.description || e.category}</div>
                            <div className="text-xs text-[var(--color-text-muted)]">{e.category}</div>
                          </div>
                          <div className="text-sm font-semibold text-[var(--color-text)]">{formatAmount(e.amount)}</div>
                        </div>
                      );
                    })}
                    {incRecords.map((e) => {
                      const IconComp = INCOME_ICONS[e.category] || OtherIncomeIcon;
                      return (
                        <div key={e.id} className="flex items-center gap-3 bg-[var(--color-surface-alt)]/60 rounded-xl px-4 py-2.5">
                          <IconComp size={22} className="shrink-0 text-[var(--color-text)]" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate text-[var(--color-text)] font-medium">{e.description || e.category}</div>
                            <div className="text-xs text-[var(--color-text-muted)]">
                              <span className="text-green-400">{e.category}</span>
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-green-400">+{formatAmount(e.amount)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Category Breakdown */}
          <div className="glass-card rounded-2xl p-5 mb-4 animate-fade-in-up">
            <h2 className="text-sm font-medium text-[var(--color-text-muted)] mb-4">分类排行</h2>
            <div className="space-y-3">
              {sortedCategories.map(([cat, total]) => (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="inline-flex items-center gap-1.5 text-[var(--color-icon)]">{(() => { const CI = EXPENSE_ICONS[cat] || OtherIcon; return <CI size={18} />; })()} {cat}</span>
                    <span className="text-[var(--color-text-muted)]">
                      {formatAmount(total)} · {((total / expenseTotal) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(total / maxTotal) * 100}%`, background: '#6aaccc' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Monthly Review */}
          {expenseTotal > 0 && (
            <div className="glass-card rounded-2xl p-5 animate-fade-in-up">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
                  <span className="inline-block shrink-0" style={{ width: 16, height: 16, backgroundColor: 'currentColor', maskImage: `url(${detailIcon})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskImage: `url(${detailIcon})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center' }} />
                  月度复盘</h2>
                {aiReview && hasApiKey() && (
                  <button
                    onClick={handleGenerateReview}
                    disabled={aiLoading}
                    className="text-xs text-[var(--color-text-faint)] hover:text-[var(--macaron-mint)] transition-colors inline-flex items-center gap-1"
                  >
                    {aiLoading ? (
                      <span className="ai-spinner shrink-0" style={{ width: 14, height: 14, borderWidth: '1.5px' }} />
                    ) : (
                      <span className="inline-block shrink-0" style={{ width: 14, height: 14, backgroundColor: 'currentColor', maskImage: `url(${dataAnalysisIcon})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskImage: `url(${dataAnalysisIcon})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center' }} />
                    )}
                    再次复盘
                  </button>
                )}
              </div>

              {aiReview ? (
                <p className="text-sm text-[var(--color-text)] leading-relaxed whitespace-pre-line">{aiReview}</p>
              ) : aiLoading ? (
                <div className="flex items-center gap-3 text-sm text-[var(--color-text-muted)] py-4">
                  <span className="ai-spinner" />
                  正在帮你盘点这个月...
                </div>
              ) : aiError ? (
                <div>
                  <p className="text-sm text-red-400 mb-3">{aiError}</p>
                  <button
                    onClick={handleGenerateReview}
                    className="text-sm text-[var(--macaron-mint)] hover:text-[var(--macaron-pink)]"
                  >
                    重试
                  </button>
                </div>
              ) : !hasApiKey() ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  请先在「设置」页配置 DeepSeek API Key，<br />
                  注册地址：platform.deepseek.com
                </p>
              ) : (
                <button
                  onClick={handleGenerateReview}
                  className="w-full py-3 rounded-xl text-sm font-medium transition-colors inline-flex items-center justify-center gap-1.5"
                  style={{ background: 'rgba(126, 203, 161, 0.15)', color: 'var(--macaron-mint)' }}
                >
                  <span className="inline-block shrink-0" style={{ width: 16, height: 16, backgroundColor: 'currentColor', maskImage: `url(${dataAnalysisIcon})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskImage: `url(${dataAnalysisIcon})`, WebkitMaskSize: 'contain', WebkitMaskRepeat: 'no-repeat', WebkitMaskPosition: 'center' }} />
                  生成本月复盘
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
