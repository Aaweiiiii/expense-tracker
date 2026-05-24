import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface DataContextType {
  refreshKey: number;
  refresh: () => void;
}

const DataContext = createContext<DataContextType>({
  refreshKey: 0,
  refresh: () => {},
});

export function DataProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  return (
    <DataContext.Provider value={{ refreshKey, refresh }}>
      {children}
    </DataContext.Provider>
  );
}

export function useDataRefresh() {
  return useContext(DataContext);
}
