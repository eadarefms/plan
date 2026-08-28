import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../services/api';
import { useYear } from '../context/YearContext';
import { StatCard, EmptyState } from '../components/ui';
import ProvincialDashboardPage from './ProvincialDashboardPage';

interface DirectorateStat {
  directorateId: string; directorateName: string;
  total: number; done: number; inProgress: number; late: number; notStarted: number; stopped: number; avgCompletionRate: number;
}

export default function RegionalDashboardPage() {
  const { selectedYearId } = useYear();
  const [globalSummary, setGlobalSummary] = useState<any>(null);
  const [byDirectorate, setByDirectorate] = useState<DirectorateStat[]>([]);
  const [drillDown, setDrillDown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedYearId) { setLoading(false); return; }
    setLoading(true);
    api.get('/dashboard/regional', { params: { academicYearId: selectedYearId } })
      .then((res) => { setGlobalSummary(res.data.globalSummary); setByDirectorate(res.data.byDirectorate); })
      .finally(() => setLoading(false));
  }, [selectedYearId]);

  if (drillDown) {
    const dir = byDirectorate.find((d) => d.directorateId === drillDown);
    return (
      <div className="space-y-4">
        <button onClick={() => setDrillDown(null)} className="btn btn-secondary">→ العودة إلى لوحة القيادة الجهوية</button>
        <ProvincialDashboardPage directorateIdOverride={drillDown} />
      </div>
    );
  }

  if (loading) return <EmptyState message="جارٍ التحميل..." />;
  if (!selectedYearId) return <EmptyState message="لا توجد سنة دراسية متاحة بعد. يرجى التأكد من تشغيل البيانات الأولية (npm run seed) في الخادم الخلفي." />;
  if (!globalSummary) return <EmptyState message="لا توجد بيانات." />;

  const chartData = byDirectorate.map((d) => ({
    name: d.directorateName, الإجمالي: d.total, منجزة: d.done, ['قيد الإنجاز']: d.inProgress, متأخرة: d.late, ['لم تبدأ']: d.notStarted,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">لوحة القيادة الجهوية</h1>
        <p className="text-sm text-slate-500 mt-1">جميع المديريات الإقليمية الثمانية</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <StatCard label="إجمالي العمليات" value={globalSummary.total} />
        <StatCard label="منجزة" value={globalSummary.done} tone="success" />
        <StatCard label="قيد الإنجاز" value={globalSummary.inProgress} tone="info" />
        <StatCard label="متأخرة" value={globalSummary.late} tone="danger" />
        <StatCard label="لم تبدأ" value={globalSummary.notStarted} tone="warning" />
        <StatCard label="متوسط نسبة الإنجاز" value={`${globalSummary.avgCompletionRate}%`} tone="info" />
      </div>

      <div className="card">
        <h3 className="font-bold text-slate-700 mb-3">مقارنة المديريات الثمانية</h3>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip /><Legend />
            <Bar dataKey="منجزة" stackId="a" fill="#16a34a" />
            <Bar dataKey="قيد الإنجاز" stackId="a" fill="#2563eb" />
            <Bar dataKey="متأخرة" stackId="a" fill="#dc2626" />
            <Bar dataKey="لم تبدأ" stackId="a" fill="#6b7280" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3 className="font-bold text-slate-700 mb-3">التفاصيل حسب المديرية (اضغط للانتقال إلى لوحة القيادة الخاصة بها)</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 border-b border-slate-200">
              <th className="text-right py-2">المديرية</th>
              <th>الإجمالي</th><th>منجزة</th><th>قيد الإنجاز</th><th>متأخرة</th><th>لم تبدأ</th><th>نسبة الإنجاز</th>
            </tr>
          </thead>
          <tbody>
            {byDirectorate.map((d) => (
              <tr key={d.directorateId} className="border-b border-slate-100 hover:bg-brand-50 cursor-pointer" onClick={() => setDrillDown(d.directorateId)}>
                <td className="py-2 font-medium text-brand-700">{d.directorateName}</td>
                <td className="text-center">{d.total}</td>
                <td className="text-center text-green-600">{d.done}</td>
                <td className="text-center text-blue-600">{d.inProgress}</td>
                <td className="text-center text-red-600">{d.late}</td>
                <td className="text-center text-slate-500">{d.notStarted}</td>
                <td className="text-center">{d.avgCompletionRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
