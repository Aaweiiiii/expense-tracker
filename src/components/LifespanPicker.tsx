import { useState, useRef, useEffect, useMemo } from 'react';

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
    onYearsChange(ny);
    setActive(null);
  }

  function handleMonth(nm: number) {
    onMonthsChange(nm);
    setActive(null);
  }

  const colBtn = 'w-full py-3 rounded-xl text-center transition-colors select-none';
  const colActive = 'bg-cyan-600/20 ring-1 ring-cyan-600/50';
  const colInactive = 'bg-gray-800 hover:bg-gray-700';
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
      if (selected === 0) {
        listRef.current.scrollTop = 0;
        return;
      }
      const btn = listRef.current.querySelector(`[data-value="${selected}"]`) as HTMLElement;
      if (btn) {
        btn.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <div className="absolute left-0 right-0 bottom-full mb-1 z-20 bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div ref={listRef} className="overflow-y-auto scrollbar-hide" style={{ maxHeight: '200px' }}>
          <div className="py-1" />
          {items.map((v) => (
            <button
              key={v}
              type="button"
              data-value={v}
              onClick={() => onSelect(v)}
              className={`${optionBtn} ${v === selected ? 'text-cyan-400 bg-cyan-600/10 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}
            >
              {v}{unit}
            </button>
          ))}
          <div className="py-12" />
        </div>
        <div className="absolute top-0 left-0 right-0 h-8 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to bottom, #1f2937, transparent)' }} />
        <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none z-10"
          style={{ background: 'linear-gradient(to top, #1f2937, transparent)' }} />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex gap-3">
      {/* Year */}
      <div className="flex-1 flex flex-col items-center gap-1 relative">
        <span className="text-xs text-gray-500">年</span>
        <button
          type="button"
          onClick={() => setActive(active === 'year' ? null : 'year')}
          className={`${colBtn} ${active === 'year' ? colActive : colInactive}`}
        >
          <span className="text-xl font-bold text-white">{years}</span>
        </button>
        {active === 'year' && (
          <Dropdown items={yearOptions} selected={years} onSelect={handleYear} unit="年" />
        )}
      </div>

      {/* Month */}
      <div className="flex-1 flex flex-col items-center gap-1 relative">
        <span className="text-xs text-gray-500">月</span>
        <button
          type="button"
          onClick={() => setActive(active === 'month' ? null : 'month')}
          className={`${colBtn} ${active === 'month' ? colActive : colInactive}`}
        >
          <span className="text-xl font-bold text-white">{months}</span>
        </button>
        {active === 'month' && (
          <Dropdown items={monthOptions} selected={months} onSelect={handleMonth} unit="月" />
        )}
      </div>
    </div>
  );
}
