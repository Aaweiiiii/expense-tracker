import { Outlet, NavLink, useLocation } from 'react-router-dom';

const tabs = [
  { to: '/', icon: '📋', label: '账单' },
  { to: '/add', icon: '➕', label: '记账' },
  { to: '/stats', icon: '📊', label: '统计' },
  { to: '/analysis', icon: '💡', label: '分析' },
  { to: '/settings', icon: '⚙️', label: '设置' },
];

export function Layout() {
  const location = useLocation();
  const isAddPage = location.pathname === '/add';

  return (
    <div className="min-h-dvh bg-gray-950 text-gray-100 pb-20">
      <main className={`mx-auto max-w-lg px-4 pt-4 ${isAddPage ? '' : 'pb-4'}`}>
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur border-t border-gray-800">
        <div className="mx-auto max-w-lg flex justify-around py-2">
          {tabs.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs transition-colors ${
                  isActive ? 'text-cyan-400' : 'text-gray-500 hover:text-gray-300'
                }`
              }
            >
              <span className="text-xl">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
