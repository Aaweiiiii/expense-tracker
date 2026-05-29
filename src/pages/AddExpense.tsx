import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { addExpense, updateExpense, getBigPurchases, db } from '../db';
import { getToday } from '../utils/format';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types';
import { EXPENSE_ICONS, INCOME_ICONS } from '../components/Icon';
import { useDataRefresh } from '../hooks/useData';
import { DatePicker } from '../components/DatePicker';
import { LifespanPicker } from '../components/LifespanPicker';

export function AddExpense() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editingId = searchParams.get('edit');
  const isEdit = editingId !== null;

  const { refresh } = useDataRefresh();
  const [recordType, setRecordType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(getToday());
  const [saving, setSaving] = useState(false);
  const [isBigPurchase, setIsBigPurchase] = useState(false);
  const [lifespanYears, setLifespanYears] = useState(0);
  const [lifespanMonths, setLifespanMonths] = useState(0);

  const categories = recordType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const icons = recordType === 'expense' ? EXPENSE_ICONS : INCOME_ICONS;

  // Set default category when type changes
  useEffect(() => {
    if (!isEdit) {
      setCategory(categories[0]);
    }
  }, [recordType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!editingId) return;
    db.expenses.get(parseInt(editingId)).then((expense) => {
      if (!expense) {
        alert('记录不存在');
        navigate('/');
        return;
      }
      const type = expense.type || 'expense';
      setRecordType(type);
      setAmount(String(expense.amount));
      setCategory(expense.category);
      setDescription(expense.description);
      setDate(expense.date);
      if (expense.isBigPurchase) {
        setIsBigPurchase(true);
        const y = Math.floor(expense.lifespanYears || 0);
        const m = Math.round(((expense.lifespanYears || 0) - y) * 12);
        setLifespanYears(y);
        setLifespanMonths(m);
      }
    });
  }, [editingId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0) {
      alert('请输入有效的金额');
      return;
    }
    if (recordType === 'expense' && isBigPurchase) {
      if (lifespanYears === 0 && lifespanMonths === 0) {
        alert('请填写预计使用时间（至少填一项）');
        return;
      }
    }
    setSaving(true);
    const desc = description.trim() || category;
    const groupKey = (recordType === 'expense' && isBigPurchase) ? `${category}:${desc}` : undefined;
    try {
      const data = {
        type: recordType,
        amount: num,
        category: category || categories[0],
        description: desc,
        date,
        isBigPurchase: recordType === 'expense' && isBigPurchase,
        lifespanYears: (recordType === 'expense' && isBigPurchase)
          ? (lifespanYears + lifespanMonths / 12)
          : undefined,
        groupKey,
      };

      if (isEdit) {
        const existing = await db.expenses.get(parseInt(editingId));
        await updateExpense(parseInt(editingId), {
          ...data,
          endDate: existing?.endDate,
        });
      } else {
        await addExpense(data);
      }

      if (groupKey) {
        const existing = await getBigPurchases();
        for (const r of existing) {
          if (r.category === category && r.description === desc && !r.groupKey) {
            await updateExpense(r.id!, { groupKey });
          }
        }
      }

      refresh();
      navigate('/');
    } catch {
      alert('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  const quickAmounts = recordType === 'expense'
    ? [10, 20, 50, 100, 200, 500]
    : [500, 1000, 3000, 5000, 10000, 20000];

  const isExpense = recordType === 'expense';

  return (
    <div>
      <h1 className="text-xl font-bold mb-5 animate-fade-in-up-fast">{isEdit ? '编辑记录' : '记一笔'}</h1>

      <form onSubmit={handleSubmit} className="space-y-5 stagger-fast">
        {/* Type Toggle */}
        <div className="glass-card rounded-xl p-1 flex">
          <button
            type="button"
            onClick={() => setRecordType('expense')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              isExpense ? 'bg-cyan-600 text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
            style={isExpense ? { filter: 'saturate(0.5) brightness(1.2)' } : undefined}
          >
            支出
          </button>
          <button
            type="button"
            onClick={() => setRecordType('income')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              !isExpense ? 'bg-green-600 text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
            style={!isExpense ? { filter: 'saturate(0.5) brightness(1.2)' } : undefined}
          >
            收入
          </button>
        </div>

        {/* Date */}
        <div className="glass-card rounded-xl p-4 relative z-10">
          <DatePicker value={date} onChange={setDate} />
        </div>

        {/* Amount */}
        <div>
          <label className="text-sm text-[var(--color-text-muted)] block mb-2">金额</label>
          <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-2">
            <span className={`font-bold text-xl ${isExpense ? 'text-cyan-400' : 'text-green-400'}`}>¥</span>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-transparent text-2xl font-bold outline-none placeholder-[var(--color-text-faint)]"
              required
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {quickAmounts.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setAmount(String(n))}
                className="bg-[var(--color-surface)] text-[var(--color-text-muted)] px-3 py-1 rounded-lg text-sm active:bg-[var(--color-surface-alt)] transition-all duration-200 active:scale-[0.97]"
              >
                ¥{n}
              </button>
            ))}
          </div>
        </div>

        {/* Category + Description */}
        <div className="glass-card rounded-xl p-4 space-y-4">
          <div>
            <label className="text-sm text-[var(--color-text-muted)] block mb-2">分类</label>
            <div className="grid grid-cols-5 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs transition-colors ${
                    category === cat
                      ? isExpense
                        ? 'bg-cyan-600/20 text-cyan-400 ring-1 ring-cyan-600/50'
                        : 'bg-green-600/20 text-green-400 ring-1 ring-green-600/50'
                      : 'bg-[var(--color-surface-alt)] text-[var(--color-text-muted)] hover:opacity-80'
                  }`}
                >
                  {(() => { const CI = icons[cat]; return <CI size={20} />; })()}
                  <span>{cat}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-[var(--color-text-muted)] block mb-2">描述（可选）</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isExpense ? '例如：中午牛肉面' : '例如：5月工资'}
              className="w-full bg-[var(--color-surface-alt)] rounded-xl px-4 py-3 text-sm outline-none placeholder-[var(--color-text-faint)] focus:ring-1 focus:ring-cyan-600"
            />
          </div>
        </div>

        {/* Big Purchase Toggle — expense only */}
        {isExpense && (
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">标记为资产消费</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-0.5">手机、课程、家电等长期使用的资产</div>
              </div>
              <button
                type="button"
                onClick={() => setIsBigPurchase(!isBigPurchase)}
                className={`relative w-12 h-7 rounded-full transition-colors ${
                  isBigPurchase ? 'bg-cyan-600' : 'bg-[var(--color-surface-alt)]'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-6 h-6 bg-white rounded-full transition-transform ${
                    isBigPurchase ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {isBigPurchase && (
              <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                <label className="text-sm text-[var(--color-text-muted)] block mb-3">预计使用时间</label>
                <LifespanPicker
                  years={lifespanYears}
                  months={lifespanMonths}
                  onYearsChange={setLifespanYears}
                  onMonthsChange={setLifespanMonths}
                />
                <p className="text-xs text-[var(--color-text-faint)] mt-2">例如手机填 3 年，网课填 0 年 3 月</p>
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          style={{ filter: 'saturate(0.5) brightness(1.2)' }}
          className={`w-full py-3 rounded-xl font-medium text-sm active:opacity-80 disabled:opacity-50 transition-colors ${
            isExpense ? 'bg-cyan-600 text-white' : 'bg-green-600 text-white'
          }`}
        >
          {saving ? '保存中...' : (isEdit ? '更新记录' : '保存')}
        </button>
      </form>
    </div>
  );
}
