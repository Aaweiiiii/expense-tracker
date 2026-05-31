import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { BillsIcon, AddIcon, StatsIcon, AnalysisIcon, SettingsIcon } from './Icon';
import type { ComponentType } from 'react';

interface IconProps { size?: number; className?: string; }
type TabIcon = ComponentType<IconProps>;

const tabs: { to: string; Icon: TabIcon; label: string }[] = [
  { to: '/', Icon: BillsIcon, label: '账单' },
  { to: '/add', Icon: AddIcon, label: '记账' },
  { to: '/stats', Icon: StatsIcon, label: '统计' },
  { to: '/analysis', Icon: AnalysisIcon, label: '资产分析' },
  { to: '/settings', Icon: SettingsIcon, label: '设置' },
];

export function Layout() {
  const location = useLocation();
  const isAddPage = location.pathname === '/add';

  return (
    <div className="min-h-dvh text-[var(--color-text)] pb-20">
      <main className={`mx-auto max-w-lg px-4 pt-4 ${isAddPage ? '' : 'pb-4'}`}>
        <Outlet />
      </main>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-surface)]/95 backdrop-blur border-t border-[var(--color-border)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto max-w-lg flex justify-around py-2">
          {tabs.map(({ to, Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs transition-all duration-200 ${
                  isActive ? 'text-cyan-400 scale-105' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`
              }
            >
              <Icon size={22} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
