import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import type { AcademicYear } from '../types';

interface YearContextValue {
  years: AcademicYear[];
  selectedYearId: string;
  setSelectedYearId: (id: string) => void;
  refreshYears: () => Promise<void>;
}

const YearContext = createContext<YearContextValue | null>(null);

export function YearProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearIdState] = useState<string>(() => localStorage.getItem('selectedYearId') || '');

  const refreshYears = useCallback(async () => {
    if (!user) {
      setYears([]);
      setSelectedYearIdState('');
      return;
    }

    const { data } = await api.get<AcademicYear[]>('/academic-years');
    setYears(data);

    // Keep the saved selection only when it still exists in the server data.
    const savedYear = data.find((year) => year.id === selectedYearId);
    if (savedYear) return;

    // On first login, automatically select the current requested school year.
    // Prefer 2026/2027, then an active year, then the first available year.
    const defaultYear =
      data.find((year) => year.label === '2026/2027') ||
      data.find((year) => year.isActive) ||
      data[0];

    if (defaultYear) {
      setSelectedYearIdState(defaultYear.id);
      localStorage.setItem('selectedYearId', defaultYear.id);
    } else {
      setSelectedYearIdState('');
      localStorage.removeItem('selectedYearId');
    }
  }, [user, selectedYearId]);

  useEffect(() => {
    refreshYears().catch(() => {
      // The authenticated pages can still render while the API is temporarily unavailable.
      // A subsequent login/reload or explicit refresh will retry the request.
    });
  }, [refreshYears]);

  const setSelectedYearId = (id: string) => {
    setSelectedYearIdState(id);
    localStorage.setItem('selectedYearId', id);
  };

  return (
    <YearContext.Provider value={{ years, selectedYearId, setSelectedYearId, refreshYears }}>
      {children}
    </YearContext.Provider>
  );
}

export function useYear() {
  const ctx = useContext(YearContext);
  if (!ctx) throw new Error('useYear must be used within YearProvider');
  return ctx;
}
