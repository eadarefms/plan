import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import type { AcademicYear } from '../types';

interface YearContextValue {
  years: AcademicYear[];
  selectedYearId: string;
  setSelectedYearId: (id: string) => void;
  refreshYears: () => Promise<void>;
}

const YearContext = createContext<YearContextValue | null>(null);

export function YearProvider({ children }: { children: React.ReactNode }) {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearIdState] = useState<string>(localStorage.getItem('selectedYearId') || '');

  const refreshYears = async () => {
    const { data } = await api.get<AcademicYear[]>('/academic-years');
    setYears(data);
    if (!selectedYearId && data.length) {
      const active = data.find((y) => y.label === '2026/2027') || data[0];
      setSelectedYearIdState(active.id);
      localStorage.setItem('selectedYearId', active.id);
    }
  };

  useEffect(() => { refreshYears(); }, []);

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
