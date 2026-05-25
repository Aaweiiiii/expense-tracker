import { useState, useRef, useEffect, useMemo } from 'react';

function daysInMonth(year: number, month: number): number {
  if ([1, 3, 5, 7, 8, 10, 12].includes(month)) return 31;
  if ([4, 6, 9, 11].includes(month)) return 30;
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return isLeap ? 29 : 28;
}

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  availableDates?: Set<string>;
}

type ActiveCol = 'year' | 'month' | 'day' | null;

export function DatePicker({ value, onChange, availableDates }: DatePickerProps) {
  const [active, setActive] = useState<ActiveCol>(null);
  const [y, m, d] = value.split('-').map(Number);
  const currentYear = new Date().getFullYear();

  const years = useMemo(() => {
    if (!availableDates) {
      const list: number[] = [];
      for (let i = currentYear + 25; i >= currentYear - 25; i--) list.push(i);
      return list;
    }
    const set = new Set<number>();
    for (const date of availableDates) set.add(parseInt(date.split('-')[0]));
    return Array.from(set).sort().reverse();
  }, [currentYear, availableDates]);

  const months = useMemo(() => {
    if (!availableDates) {
      const list: number[] = [];
      for (let i = 1; i <= 12; i++) list.push(i);
      return list;
    }
    const set = new Set<number>();
    for (const date of availableDates) {
      const [dy, dm] = date.split('-').map(Number);
      if (dy === y) set.add(dm);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [availableDates, y]);

  const maxDay = daysInMonth(y, m);
  const days = useMemo(() => {
    if (!availableDates) {
      const list: number[] = [];
      for (let i = 1; i <= maxDay; i++) list.push(i);
      return list;
    }
    const set = new Set<number>();
    const prefix = `${y}-${String(m).padStart(2, '0')}-`;
    for (const date of availableDates) {
      if (date.startsWith(prefix)) set.add(parseInt(date.split('-')[2]));
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [availableDates, y, m, maxDay]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActive(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [active]);

  function handleYear(ny: number) {
    let nm = m;
    let nd = d;
    if (availableDates) {
      const availMonths = new Set<number>();
      for (const date of availableDates) {
        const [dy, dm] = date.split('-').map(Number);
        if (dy === ny) availMonths.add(dm);
      }
      if (availMonths.size > 0) {
        nm = Math.min(...availMonths);
        const prefix2 = `${ny}-${String(nm).padStart(2, '0')}-`;
        const availDays = new Set<number>();
        for (const date of availableDates) {
          if (date.startsWith(prefix2)) availDays.add(parseInt(date.split('-')[2]));
        }
        if (availDays.size > 0) nd = Math.min(...availDays);
        else nd = 1;
      }
    }
    const maxD = daysInMonth(ny, nm);
    nd = Math.min(nd, maxD);
    onChange(`${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`);
    setActive(null);
  }

  function handleMonth(nm: number) {
    let nd = Math.min(d, daysInMonth(y, nm));
    if (availableDates) {
      const prefix = `${y}-${String(nm).padStart(2, '0')}-`;
      const availDays = new Set<number>();
      for (const date of availableDates) {
        if (date.startsWith(prefix)) availDays.add(parseInt(date.split('-')[2]));
      }
      if (availDays.size > 0) nd = Math.min(...availDays);
      else nd = 1;
    }
    onChange(`${y}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`);
    setActive(null);
  }

  function handleDay(nd: number) {
    onChange(`${y}-${String(m).padStart(2, '0')}-${String(nd).padStart(2, '0')}`);
    setActive(null);
  }

  const colBtn = 'w-full py-3 rounded-xl text-center transition-colors select-none';
  const colActive = 'bg-cyan-600/20 ring-1 ring-cyan-600/50';
  const colInactive = 'bg-[var(--color-surface)] hover:bg-[var(--color-surface-alt)]';
  const optionBtn = 'w-full py-2 text-sm rounded-lg transition-colors text-center';

  function Dropdown({ items, selected, onSelect, unit }: {
    items: number[];
    selected: number;
    onSelect: (v: number) => void;
    unit: string;
  }) {
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!listRef.current) return;
      const btn = listRef.current.querySelector(`[data-value="${selected}"]`) as HTMLElement;
      if (btn) {
        btn.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-[var(--color-surface-alt)] rounded-xl shadow-lg overflow-hidden">
        <div ref={listRef} className="overflow-y-auto scrollbar-hide" style={{ maxHeight: '200px' }}>
          <div className="py-12" />
          {items.map((v) => (
            <button
              key={v}
              type="button"
              data-value={v}
              onClick={() => onSelect(v)}
              className={`${optionBtn} ${v === selected ? 'text-cyan-400 bg-cyan-600/10 font-medium' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-alt)]/50'}`}
            >
              {v}{unit}
            </button>
          ))}
          <div className="py-12" />
        </div>
        {/* Fade edges */}
        <div
          className="absolute top-0 left-0 right-0 h-8 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to bottom, var(--color-surface-alt), transparent)' }}
        />
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 z-10"
          style={{ background: 'linear-gradient(to top, var(--color-surface-alt), transparent)' }} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex gap-3">
      {/* Year */}
      <div className="flex-1 flex flex-col items-center gap-1 relative">
        <span className="text-xs text-[var(--color-text-muted)]">年</span>
        <button
          type="button"
          onClick={() => setActive(active === 'year' ? null : 'year')}
          className={`${colBtn} ${active === 'year' ? colActive : colInactive}`}
        >
          <span className="text-xl font-bold text-[var(--color-text)]">{y}</span>
        </button>
        {active === 'year' && (
          <Dropdown items={years} selected={y} onSelect={handleYear} unit="年" />
        )}
      </div>

      {/* Month */}
      <div className="flex-1 flex flex-col items-center gap-1 relative">
        <span className="text-xs text-[var(--color-text-muted)]">月</span>
        <button
          type="button"
          onClick={() => setActive(active === 'month' ? null : 'month')}
          className={`${colBtn} ${active === 'month' ? colActive : colInactive}`}
        >
          <span className="text-xl font-bold text-[var(--color-text)]">{m}</span>
        </button>
        {active === 'month' && (
          <Dropdown
            items={months.length > 0 ? months : Array.from({ length: 12 }, (_, i) => i + 1)}
            selected={m}
            onSelect={handleMonth}
            unit="月"
          />
        )}
      </div>

      {/* Day */}
      <div className="flex-1 flex flex-col items-center gap-1 relative">
        <span className="text-xs text-[var(--color-text-muted)]">日</span>
        <button
          type="button"
          onClick={() => setActive(active === 'day' ? null : 'day')}
          className={`${colBtn} ${active === 'day' ? colActive : colInactive}`}
        >
          <span className="text-xl font-bold text-[var(--color-text)]">{d}</span>
        </button>
        {active === 'day' && (
          <Dropdown
            items={days.length > 0 ? days : Array.from({ length: maxDay }, (_, i) => i + 1)}
            selected={d}
            onSelect={handleDay}
            unit="日"
          />
        )}
      </div>
    </div>
  );
}
