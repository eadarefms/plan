import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useYear } from '../context/YearContext';
import { StatCard, EmptyState } from '../components/ui';
import type { Directorate } from '../types';

interface ProvincialDashboardData {
  directorate: Directorate;
  summary: { total: number; done: number; inProgress: number; late: number; notStarted: number; stopped: number; avgCompletionRate: number; byCoordinator: { name: string; total: number; done: number; late: number }[] };
  indicators: { indicator: string | null; target: number | null; achieved: number | null; rate: number | null }[];
  lateActions: { id: string; number: number; title: string; endDate: string | null }[];
  upcomingActions: { id: string; number: number; title: string; endDate: string | null }[];
}

const STATUS_PIE_COLORS = ['#16a34a', '#2563eb', '#dc2626', '#6b7280', '#a855f7'];

export default function ProvincialDashboardPage({ directorateIdOverride }: { directorateIdOverride?: string }) {
  const { user } = useAuth();
  const { selectedYearId } = useYear();
  const [data, setData] = useState<ProvincialDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const directorateId = directorateIdOverride || user?.directorateId || undefined;

  useEffect(() => {
    if (!selectedYearId) { setLoading(false); return; }
    setLoading(true);
    api.get('/dashboard/provincial', { params: { directorateId, academicYearId: selectedYearId } })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }, [directorateId, selectedYearId]);

  if (loading) return <EmptyState message="جارٍ التحميل..." />;
  if (!selectedYearId) return <EmptyState message="لا توجد سنة دراسية متاحة بعد. يرجى التأكد من تشغيل البيانات الأولية (npm run seed) في الخادم الخلفي." />;
  if (!data) return <EmptyState message="لا توجد بيانات." />;

  const { summary } = data;
  const pieData = [
    { name: 'منجزة', value: summary.done },
    { name: 'في طور الإنجاز', value: summary.inProgress },
    { name: 'متأخرة', value: summary.late },
    { name: 'لم تبدأ', value: summary.notStarted },
    { name: 'متوقفة', value: summary.stopped },
  ].filter((d) => d.value > 0);

  const indicatorData = data.indicators
    .filter((i) => i.indicator)
    .slice(0, 10)
    .map((i) => ({ name: i.indicator!.length > 18 ? i.indicator!.slice(0, 18) + '…' : i.indicator, المستهدف: i.target ?? 0, المنجز: i.achieved ?? 0 }));

  const coordinatorData = summary.byCoordinator.map((c) => ({ name: c.name, الإجمالي: c.total, منجزة: c.done, متأخرة: c.late }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">لوحة القيادة - تتبع خطة العمل السنوية</h1>
        <p className="text-sm text-slate-500 mt-1">مديرية {data.directorate?.name}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="إجمالي العمليات" value={summary.total} />
        <StatCard label="منجزة" value={summary.done} tone="success" />
        <StatCard label="في طور الإنجاز" value={summary.inProgress} tone="info" />
        <StatCard label="متأخرة" value={summary.late} tone="danger" />
        <StatCard label="لم تبدأ" value={summary.notStarted} tone="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-bold text-slate-700 mb-3">وضعية العمليات</h3>
          {pieData.length === 0 ? <EmptyState message="لا توجد عمليات مسجلة لهذه السنة الدراسية." /> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {pieData.map((_, idx) => <Cell key={idx} fill={STATUS_PIE_COLORS[idx % STATUS_PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 className="font-bold text-slate-700 mb-3">المؤشرات: المستهدف مقابل المنجز</h3>
          {indicatorData.length === 0 ? <EmptyState message="لا توجد مؤشرات مسجلة." /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={indicatorData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip /><Legend />
                <Bar dataKey="المستهدف" fill="#94a3b8" />
                <Bar dataKey="المنجز" fill="#328eff" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold text-slate-700 mb-3">توزيع العمليات حسب المنسق</h3>
        {coordinatorData.length === 0 ? <EmptyState message="لا يوجد منسقون بعد." /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={coordinatorData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip /><Legend />
              <Bar dataKey="الإجمالي" fill="#94a3b8" />
              <Bar dataKey="منجزة" fill="#16a34a" />
              <Bar dataKey="متأخرة" fill="#dc2626" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <h3 className="font-bold text-red-700 mb-3">⚠ العمليات المتأخرة ({data.lateActions.length})</h3>
          {data.lateActions.length === 0 ? <EmptyState message="لا توجد عمليات متأخرة." /> : (
            <ul className="space-y-2">
              {data.lateActions.map((a) => (
                <li key={a.id} className="text-sm flex justify-between border-b border-slate-100 pb-1">
                  <span>#{a.number} — {a.title}</span>
                  <span className="text-slate-400">{a.endDate?.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h3 className="font-bold text-amber-700 mb-3">⏰ عمليات ستنتهي قريبًا ({data.upcomingActions.length})</h3>
          {data.upcomingActions.length === 0 ? <EmptyState message="لا توجد عمليات قريبة من الانتهاء." /> : (
            <ul className="space-y-2">
              {data.upcomingActions.map((a) => (
                <li key={a.id} className="text-sm flex justify-between border-b border-slate-100 pb-1">
                  <span>#{a.number} — {a.title}</span>
                  <span className="text-slate-400">{a.endDate?.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
