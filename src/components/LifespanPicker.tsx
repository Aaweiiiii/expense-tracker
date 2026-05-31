import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

interface LifespanPickerProps {
  years: number;
  months: number;
  onYearsChange: (y: number) => void;
  onMonthsChange: (m: number) => void;
}

type ActiveCol = 'year' | 'month' | null;

export function LifespanPicker({ years, months, onYearsChange, onMonthsChange }: LifespanPickerProps) {
  const [active, setActive] = useState<ActiveCol>(null);

  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let i = 0; i <= 50; i++) list.push(i);
    return list;
  }, []);

  const monthOptions = useMemo(() => {
    const list: number[] = [];
    for (let i = 0; i <= 11; i++) list.push(i);
    return list;
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const yearBtnRef = useRef<HTMLButtonElement>(null);
  const monthBtnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (!dropdownRef.current?.contains(e.target as Node)) {
          setActive(null);
        }
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [active]);

  function handleYear(ny: number) {
    onYearsChange(ny);
    setActive(null);
  }

  function handleMonth(nm: number) {
    onMonthsChange(nm);
    setActive(null);
  }

  const colBtn = 'w-full py-3 rounded-xl text-center transition-colors select-none';
  const colActive = 'bg-cyan-600/20 ring-1 ring-cyan-600/50';
  const colInactive = 'bg-[var(--color-surface-alt)] hover:bg-[var(--color-surface-alt)]';
  const optionBtn = 'w-full py-2 text-sm rounded-lg transition-colors text-center';

  function Dropdown({ triggerRef, items, selected, onSelect, unit }: {
    triggerRef: React.RefObject<HTMLButtonElement | null>;
    items: number[];
    selected: number;
    onSelect: (v: number) => void;
    unit: string;
  }) {
    const listRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ bottom: 0, left: 0, width: 0 });

    useLayoutEffect(() => {
      function update() {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left, width: rect.width });
      }
      update();
      window.addEventListener('resize', update);
      window.addEventListener('scroll', update, true);
      return () => {
        window.removeEventListener('resize', update);
        window.removeEventListener('scroll', update, true);
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      if (!listRef.current) return;
      if (selected === 0) {
        listRef.current.scrollTop = 0;
        return;
      }
      const btn = listRef.current.querySelector(`[data-value="${selected}"]`) as HTMLElement;
      if (btn) {
        btn.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return createPortal(
      <div
        ref={dropdownRef}
        className="fixed z-[9999] bg-[var(--color-surface-alt)] rounded-xl shadow-lg overflow-hidden"
        style={{ bottom: pos.bottom, left: pos.left, width: pos.width || undefined }}
      >
        <div ref={listRef} className="overflow-y-auto scrollbar-hide" style={{ maxHeight: '200px' }}>
          <div className="py-1" />
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
        <div className="absolute top-0 left-0 right-0 h-8 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to bottom, var(--color-surface-alt), transparent)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to top, var(--color-surface-alt), transparent)' }} />
      </div>,
      document.body
    );
  }

  return (
    <div ref={containerRef} className="flex gap-3">
      {/* Year */}
      <div className="flex-1 flex flex-col items-center gap-1 relative">
        <span className="text-xs text-[var(--color-text-muted)]">年</span>
        <button
          type="button"
          ref={yearBtnRef}
          onClick={() => setActive(active === 'year' ? null : 'year')}
          className={`${colBtn} ${active === 'year' ? colActive : colInactive}`}
        >
          <span className="text-xl font-bold text-[var(--color-text)]">{years}</span>
        </button>
        {active === 'year' && (
          <Dropdown triggerRef={yearBtnRef} items={yearOptions} selected={years} onSelect={handleYear} unit="年" />
        )}
      </div>

      {/* Month */}
      <div className="flex-1 flex flex-col items-center gap-1 relative">
        <span className="text-xs text-[var(--color-text-muted)]">月</span>
        <button
          type="button"
          ref={monthBtnRef}
          onClick={() => setActive(active === 'month' ? null : 'month')}
          className={`${colBtn} ${active === 'month' ? colActive : colInactive}`}
        >
          <span className="text-xl font-bold text-[var(--color-text)]">{months}</span>
        </button>
        {active === 'month' && (
          <Dropdown triggerRef={monthBtnRef} items={monthOptions} selected={months} onSelect={handleMonth} unit="月" />
        )}
      </div>
    </div>
  );
}
