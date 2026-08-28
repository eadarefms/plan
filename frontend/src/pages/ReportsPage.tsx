import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useYear } from '../context/YearContext';
import { EmptyState } from '../components/ui';
import type { ActionItem, Directorate } from '../types';

export default function ReportsPage() {
  const { user } = useAuth();
  const { selectedYearId } = useYear();
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<'directorate' | 'status' | 'coordinator' | 'indicator'>('directorate');

  useEffect(() => {
    if (user?.role !== 'PROVINCIAL') api.get('/directorates').then((res) => setDirectorates(res.data));
  }, []);

  useEffect(() => {
    if (!selectedYearId) { setLoading(false); return; }
    setLoading(true);
    api.get('/actions', { params: { academicYearId: selectedYearId, pageSize: 1000 } })
      .then((res) => setActions(res.data.items))
      .finally(() => setLoading(false));
  }, [selectedYearId]);

  const groupKey = (a: ActionItem) => {
    if (groupBy === 'directorate') return a.directorateName || 'غير محدد';
    if (groupBy === 'status') return a.statusLabel;
    if (groupBy === 'coordinator') return a.coordinatorName || 'غير محدد';
    return a.indicator || 'غير محدد';
  };

  const groups = actions.reduce((acc: Record<string, ActionItem[]>, a) => {
    const key = groupKey(a);
    (acc[key] ||= []).push(a);
    return acc;
  }, {});

  const handleExport = (format: 'excel' | 'csv') => {
    const params = new URLSearchParams({ academicYearId: selectedYearId });
    const token = localStorage.getItem('token') || '';
    const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
    fetch(`${apiBase}/export/${format}?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `report.${format === 'excel' ? 'xlsx' : 'csv'}`; a.click();
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">التقارير</h1>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => handleExport('excel')}>تصدير التقرير إلى Excel</button>
          <button className="btn btn-secondary" onClick={() => handleExport('csv')}>تصدير إلى CSV</button>
        </div>
      </div>

      <div className="card flex gap-3 items-center">
        <span className="text-sm text-slate-500">تجميع حسب:</span>
        {([
          ['directorate', 'المديرية'], ['status', 'الوضعية'], ['coordinator', 'المنسق'], ['indicator', 'المؤشر'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setGroupBy(value)}
            className={`btn ${groupBy === value ? 'btn-primary' : 'btn-secondary'} !py-1 !px-3`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <EmptyState message="جارٍ التحميل..." />
      ) : Object.keys(groups).length === 0 ? (
        <EmptyState message="لا توجد بيانات لهذه السنة الدراسية." />
      ) : (
        <div className="space-y-4">
          {Object.entries(groups).map(([key, list]) => {
            const done = list.filter((a) => a.status === 'DONE').length;
            const late = list.filter((a) => a.status === 'LATE').length;
            return (
              <div key={key} className="card">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-slate-700">{key}</h3>
                  <div className="text-sm text-slate-500 flex gap-4">
                    <span>الإجمالي: {list.length}</span>
                    <span className="text-green-600">منجزة: {done}</span>
                    <span className="text-red-600">متأخرة: {late}</span>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="text-right py-1">رقم</th><th className="text-right">العملية</th><th className="text-right">المديرية</th><th className="text-right">الوضعية</th><th>نسبة الإنجاز</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.slice(0, 20).map((a) => (
                      <tr key={a.id} className="border-b border-slate-50">
                        <td className="py-1">{a.number}</td>
                        <td className="max-w-xs truncate">{a.title}</td>
                        <td>{a.directorateName}</td>
                        <td>{a.statusLabel}</td>
                        <td className="text-center">{a.completionRate !== null ? `${a.completionRate}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {list.length > 20 && <p className="text-xs text-slate-400 mt-2">... و{list.length - 20} عملية إضافية (استعمل التصدير لعرض الكل)</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
