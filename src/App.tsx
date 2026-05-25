import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DataProvider } from './hooks/useData';
import { ThemeProvider } from './hooks/useTheme';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { AddExpense } from './pages/AddExpense';
import { Stats } from './pages/Stats';
import { Analysis } from './pages/Analysis';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter basename="/expense-tracker">
      <ThemeProvider>
        <DataProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/add" element={<AddExpense />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </DataProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
