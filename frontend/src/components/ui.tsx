import React, { createContext, useCallback, useContext, useState } from 'react';
import type { ActionStatus } from '../types';
import { STATUS_COLORS } from '../types';

export function StatCard({ label, value, tone = 'default' }: { label: string; value: React.ReactNode; tone?: 'default' | 'success' | 'warning' | 'danger' | 'info' }) {
  const toneClasses: Record<string, string> = {
    default: 'text-slate-800',
    success: 'text-green-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    info: 'text-brand-700',
  };
  return (
    <div className="card">
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <p className={`text-3xl font-extrabold ${toneClasses[tone]}`}>{value}</p>
    </div>
  );
}

export function StatusBadge({ status, label }: { status: ActionStatus; label: string }) {
  const color = STATUS_COLORS[status];
  return (
    <span className="badge" style={{ backgroundColor: color + '20', color }}>
      {label}
    </span>
  );
}

// ---------------- Toast notifications (رسائل النظام بالعربية) ----------------
interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }
interface ToastContextValue { showToast: (message: string, type?: Toast['type']) => void; }
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 left-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${
              t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-slate-800'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-slate-400">
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function extractErrorMessage(err: any, fallback = 'حدث خطأ أثناء معالجة الطلب.'): string {
  return err?.response?.data?.message || fallback;
}
