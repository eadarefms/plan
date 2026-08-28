import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useYear } from '../context/YearContext';
import { EmptyState, extractErrorMessage, useToast } from '../components/ui';
import ActionFormModal from '../components/ActionFormModal';
import type { ActionItem, Directorate } from '../types';

const STATUS_OPTIONS = [
  { value: '', label: 'كل الوضعيات' },
  { value: 'NOT_STARTED', label: 'لم تبدأ' },
  { value: 'IN_PROGRESS', label: 'في طور الإنجاز' },
  { value: 'DONE', label: 'منجزة' },
  { value: 'LATE', label: 'متأخرة' },
  { value: 'STOPPED', label: 'متوقفة' },
];

// نفس القائمة بدون خيار "كل الوضعيات" — تُستعمل في القائمة المنسدلة داخل الجدول أثناء التتبع
const STATUS_SELECT_OPTIONS = STATUS_OPTIONS.filter((s) => s.value !== '');

export default function ActionsPage() {
  const { user } = useAuth();
  const { selectedYearId } = useYear();
  const { showToast } = useToast();

  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [directorateFilter, setDirectorateFilter] = useState(user?.role === 'PROVINCIAL' ? user.directorateId! : '');

  const [items, setItems] = useState<ActionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState<ActionItem | null>(null);

  useEffect(() => {
    if (user?.role !== 'PROVINCIAL') {
      api.get('/directorates').then((res) => {
        setDirectorates(res.data);
        if (!directorateFilter && res.data.length) setDirectorateFilter(res.data[0].id);
      });
    }
  }, []);

  const load = useCallback(() => {
    if (!selectedYearId || !directorateFilter) { setLoading(false); return; }
    setLoading(true);
    api.get('/actions', {
      params: {
        academicYearId: selectedYearId,
        directorateId: directorateFilter,
        status: statusFilter || undefined,
        search: search || undefined,
        page, pageSize: 15, sortBy, sortDir,
      },
    }).then((res) => {
      setItems(res.data.items);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    }).finally(() => setLoading(false));
  }, [selectedYearId, directorateFilter, statusFilter, search, page, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const handleDelete = async (item: ActionItem) => {
    if (!confirm(`هل أنت متأكد من حذف العملية رقم ${item.number}؟`)) return;
    try {
      await api.delete(`/actions/${item.id}`);
      showToast('تم حذف العملية بنجاح.', 'success');
      load();
    } catch (err: any) {
      showToast(extractErrorMessage(err), 'error');
    }
  };

  const handleDuplicate = async (item: ActionItem) => {
    try {
      await api.post(`/actions/${item.id}/duplicate`);
      showToast('تم نسخ العملية بنجاح.', 'success');
      load();
    } catch (err: any) {
      showToast(extractErrorMessage(err), 'error');
    }
  };

  const handleToggleComplete = async (item: ActionItem) => {
    try {
      await api.put(`/actions/${item.id}`, { isCompleted: !item.isCompleted });
      load();
    } catch (err: any) {
      showToast(extractErrorMessage(err), 'error');
    }
  };

  const handleUpdateAchievedValue = async (item: ActionItem, rawValue: string) => {
    const value = rawValue.trim() === '' ? null : Number(rawValue);
    if (value !== null && (Number.isNaN(value) || value < 0)) {
      showToast('القيمة المنجزة لا يجب أن تكون سالبة.', 'error');
      load(); // إعادة القيمة السابقة في الحقل
      return;
    }
    if (value === item.achievedValue) return; // لا تغيير فعلي
    try {
      await api.put(`/actions/${item.id}`, { achievedValue: value });
      load();
    } catch (err: any) {
      showToast(extractErrorMessage(err), 'error');
      load();
    }
  };

  // تغيير وضعية العملية مباشرة من الجدول أثناء التتبع (وليس من النموذج)
  // نُزامن isCompleted مع الاختيار: "منجزة" تُفعِّل تم الإنجاز، وأي وضعية أخرى تُلغيه إذا كان مفعّلاً،
  // لأن منطق العملية المتأخرة يتجاوز الوضعية المخزَّنة طالما isCompleted = false وتاريخ النهاية قد مضى.
  const handleUpdateStatus = async (item: ActionItem, newStatus: string) => {
    const payload: any = { status: newStatus };
    if (newStatus === 'DONE') payload.isCompleted = true;
    else if (item.isCompleted) payload.isCompleted = false;
    try {
      await api.put(`/actions/${item.id}`, payload);
      load();
    } catch (err: any) {
      showToast(extractErrorMessage(err), 'error');
    }
  };

  const handleExport = (format: 'excel' | 'csv') => {
    const params = new URLSearchParams({
      academicYearId: selectedYearId,
      directorateId: directorateFilter,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(search ? { search } : {}),
    });
    const token = localStorage.getItem('token') || '';
    const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
    fetch(`${apiBase}/export/${format}?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export.${format === 'excel' ? 'xlsx' : 'csv'}`;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const sortIcon = (col: string) => (sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : '');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-800">خطة العمل / العمليات</h1>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => handleExport('excel')}>تصدير إلى Excel</button>
          <button className="btn btn-secondary" onClick={() => handleExport('csv')}>تصدير إلى CSV</button>
          <button className="btn btn-primary" onClick={() => { setEditingAction(null); setModalOpen(true); }}>+ إضافة عملية</button>
        </div>
      </div>

      <div className="card flex flex-wrap gap-3 items-end">
        {user?.role !== 'PROVINCIAL' && (
          <div>
            <label className="block text-xs text-slate-500 mb-1">المديرية</label>
            <select className="input !w-48" value={directorateFilter} onChange={(e) => { setDirectorateFilter(e.target.value); setPage(1); }}>
              {directorates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs text-slate-500 mb-1">الوضعية</label>
          <select className="input !w-44" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-slate-500 mb-1">البحث (رقم العملية، الوصف، المؤشر، المنسق)</label>
          <input className="input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="ابحث هنا..." />
        </div>
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <EmptyState message="جارٍ التحميل..." />
        ) : items.length === 0 ? (
          <EmptyState message="لا توجد عمليات مسجلة لهذه السنة الدراسية." />
        ) : (
          <>
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-right py-2 cursor-pointer" onClick={() => handleSort('number')}>رقم {sortIcon('number')}</th>
                  <th className="text-right cursor-pointer" onClick={() => handleSort('title')}>العملية {sortIcon('title')}</th>
                  <th className="text-right">المنسق</th>
                  <th className="text-right">البداية</th>
                  <th className="text-right">النهاية</th>
                  <th className="text-right">المؤشر</th>
                  <th>القيمة المنجزة</th>
                  <th>نسبة الإنجاز</th>
                  <th>الوضعية</th>
                  <th>تم الإنجاز</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 font-medium">{item.number}</td>
                    <td className="max-w-xs truncate" title={item.title}>{item.title}</td>
                    <td>{item.coordinatorName || '—'}</td>
                    <td className="text-xs text-slate-500">{item.startDate?.slice(0, 10) || '—'}</td>
                    <td className="text-xs text-slate-500">{item.endDate?.slice(0, 10) || '—'}</td>
                    <td className="max-w-[140px] truncate" title={item.indicator || ''}>{item.indicator || '—'}</td>
                    <td className="text-center">
                      <input
                        key={`${item.id}-${item.updatedAt}`}
                        type="number" step="any" min="0"
                        className="input !w-24 !py-1 text-center"
                        defaultValue={item.achievedValue ?? ''}
                        placeholder={item.isPercentage ? '% —' : '—'}
                        onBlur={(e) => handleUpdateAchievedValue(item, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      />
                    </td>
                    <td className="text-center">{item.completionRate !== null ? `${item.completionRate}%` : '—'}</td>
                    <td className="text-center">
                      <select
                        className="input !w-36 !py-1 text-xs"
                        value={item.status}
                        onChange={(e) => handleUpdateStatus(item, e.target.value)}
                      >
                        {STATUS_SELECT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="text-center">
                      <input type="checkbox" checked={item.isCompleted} onChange={() => handleToggleComplete(item)} />
                    </td>
                    <td>
                      <div className="flex gap-1 justify-center">
                        <button className="text-brand-600 text-xs hover:underline" onClick={() => { setEditingAction(item); setModalOpen(true); }}>تعديل</button>
                        <button className="text-slate-500 text-xs hover:underline" onClick={() => handleDuplicate(item)}>نسخ</button>
                        <button className="text-red-600 text-xs hover:underline" onClick={() => handleDelete(item)}>حذف</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between pt-4 text-sm text-slate-500">
              <span>الإجمالي: {total} عملية</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn btn-secondary !px-3 !py-1 disabled:opacity-40">السابق</button>
                <span className="px-2">صفحة {page} من {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn btn-secondary !px-3 !py-1 disabled:opacity-40">التالي</button>
              </div>
            </div>
          </>
        )}
      </div>

      {modalOpen && directorateFilter && (
        <ActionFormModal
          action={editingAction}
          directorateId={directorateFilter}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}
