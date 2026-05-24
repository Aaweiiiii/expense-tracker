import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllExpenses, deleteExpense } from '../db';
import { formatAmount, formatLifespan, getToday } from '../utils/format';
import { EXPENSE_ICONS, INCOME_ICONS, type Expense } from '../types';
import { useDataRefresh } from '../hooks/useData';
import { DatePicker } from '../components/DatePicker';

export function Home() {
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const navigate = useNavigate();
  const { refreshKey } = useDataRefresh();

  useEffect(() => {
    loadExpenses();
  }, [refreshKey]);

  async function loadExpenses() {
    setLoading(true);
    const data = await getAllExpenses();
    setAllExpenses(data);
    setLoading(false);
  }

  async function handleDelete(id: number) {
    if (!confirm('确定删除这条记录吗？')) return;
    await deleteExpense(id);
    await loadExpenses();
  }

  // All dates that have at least one record, sorted descending (newest first)
  const recordedDates = useMemo(() => {
    const set = new Set<string>();
    for (const e of allExpenses) {
      set.add(e.date);
    }
    return Array.from(set).sort().reverse();
  }, [allExpenses]);

  const recordedDatesSet = useMemo(() => new Set(recordedDates), [recordedDates]);

  // Records for selected date
  const dayRecords = useMemo(() => {
    return allExpenses.filter((e) => e.date === selectedDate);
  }, [allExpenses, selectedDate]);

  const dayExpense = useMemo(() =>
    dayRecords.filter((e) => (e.type || 'expense') === 'expense').reduce((s, e) => s + e.amount, 0),
    [dayRecords]);
  const dayIncome = useMemo(() =>
    dayRecords.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0),
    [dayRecords]);

  const today = getToday();
  const isToday = selectedDate === today;

  // Day navigation
  function goPrevDay() {
    const idx = recordedDates.indexOf(selectedDate);
    if (idx >= 0 && idx < recordedDates.length - 1) {
      setSelectedDate(recordedDates[idx + 1]);
    }
  }

  function goNextDay() {
    const idx = recordedDates.indexOf(selectedDate);
    if (idx > 0) {
      setSelectedDate(recordedDates[idx - 1]);
    }
  }

  const canGoPrev = recordedDates.indexOf(selectedDate) < recordedDates.length - 1;
  const canGoNext = recordedDates.indexOf(selectedDate) > 0 && !isToday;

  // Format selected date for display
  const [, sm, sd] = selectedDate.split('-').map(Number);

  const recordItem = (expense: Expense) => {
    const isIncome = expense.type === 'income';
    const icon = isIncome
      ? (INCOME_ICONS[expense.category] || '💵')
      : (EXPENSE_ICONS[expense.category] || '📦');
    return (
      <div
        key={expense.id}
        className="flex items-center gap-3 bg-gray-900 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform"
      >
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate flex items-center gap-1.5">
            {expense.description || expense.category}
            {isIncome && (
              <span className="shrink-0 text-[10px] bg-green-600/20 text-green-400 px-1.5 py-0.5 rounded">
                收入
              </span>
            )}
            {!isIncome && expense.isBigPurchase && (
              <span className="shrink-0 text-[10px] bg-cyan-600/20 text-cyan-400 px-1.5 py-0.5 rounded">
                长期
              </span>
            )}
          </div>
          {expense.subcategory && (
            <div className="text-xs text-gray-500">{expense.subcategory}</div>
          )}
          {!isIncome && expense.isBigPurchase && (
            <div className="text-xs text-gray-600">
              预计使用 {expense.lifespanYears ? formatLifespan(expense.lifespanYears) : '未设置'}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className={`font-semibold ${isIncome ? 'text-green-400' : ''}`}>
            {isIncome ? '+' : ''}{formatAmount(expense.amount)}
          </div>
          {expense.tags && expense.tags.length > 0 && (
            <div className="text-xs text-gray-600">{expense.tags[0]}</div>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/add?edit=${expense.id}`); }}
          className="text-gray-700 hover:text-cyan-400 text-sm shrink-0"
          title="编辑"
        >
          ✎
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete(expense.id!); }}
          className="text-gray-700 hover:text-red-400 text-sm ml-0.5 shrink-0"
        >
          ✕
        </button>
      </div>
    );
  };

  return (
    <div>
      {/* Day Navigator */}
      <div className="bg-gray-900 rounded-2xl p-3 mb-4">
        <div className="flex items-center gap-1">
          <button
            onClick={goPrevDay}
            disabled={!canGoPrev}
            className={`text-xl px-1 ${canGoPrev ? 'text-gray-400 hover:text-white' : 'text-gray-700'}`}
          >
            ＜
          </button>
          <div className="flex-1">
            <DatePicker value={selectedDate} onChange={setSelectedDate} availableDates={recordedDatesSet} />
          </div>
          <button
            onClick={goNextDay}
            disabled={!canGoNext}
            className={`text-xl px-1 ${canGoNext ? 'text-gray-400 hover:text-white' : 'text-gray-700'}`}
          >
            ＞
          </button>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(today)}
              className="text-xs text-cyan-400 hover:text-cyan-300 px-1 shrink-0"
            >
              📍
            </button>
          )}
        </div>
      </div>

      {/* Daily Summary Card */}
      <div className="bg-gradient-to-br from-cyan-600 to-blue-700 rounded-2xl p-5 mb-5 shadow-lg">
        <div className="text-cyan-200 text-xs mb-1">
          {isToday ? '今天' : `${sm}月${sd}日`}
        </div>
        <div className="flex justify-between items-end">
          <div>
            <div className="text-cyan-200/80 text-xs mb-0.5">支出</div>
            <div className="text-2xl font-bold">{formatAmount(dayExpense)}</div>
          </div>
          <div className="text-right">
            <div className="text-green-200/80 text-xs mb-0.5">收入</div>
            <div className="text-2xl font-bold text-green-300">{formatAmount(dayIncome)}</div>
          </div>
        </div>
      </div>

      {/* Records List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center text-gray-500 py-10">加载中...</div>
        ) : dayRecords.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">📝</div>
            <div className="text-gray-400">
              {sm}月{sd}日暂无记录
            </div>
            <button
              onClick={() => navigate('/add')}
              className="mt-4 inline-block bg-cyan-600 text-white px-6 py-2 rounded-full text-sm font-medium"
            >
              记一笔
            </button>
          </div>
        ) : (
          dayRecords.map(recordItem)
        )}
      </div>
    </div>
  );
}
