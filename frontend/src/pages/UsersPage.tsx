import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { EmptyState, extractErrorMessage, useToast } from '../components/ui';
import type { Directorate, Role } from '../types';

interface UserRow { id: string; email: string; fullName: string; role: Role; directorateId: string | null; directorateName?: string; isActive: boolean; }

const ROLE_LABELS: Record<Role, string> = { ADMIN: 'مدير النظام', REGIONAL: 'منسق جهوي', PROVINCIAL: 'منسق إقليمي' };

export default function UsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', fullName: '', role: 'PROVINCIAL' as Role, directorateId: '' });
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/admin/users'), api.get('/directorates')])
      .then(([u, d]) => { setUsers(u.data); setDirectorates(d.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/users', form);
      showToast('تم إنشاء المستخدم بنجاح.', 'success');
      setShowForm(false);
      setForm({ email: '', password: '', fullName: '', role: 'PROVINCIAL', directorateId: '' });
      load();
    } catch (err: any) {
      setError(extractErrorMessage(err));
    }
  };

  const handleToggleActive = async (u: UserRow) => {
    try {
      await api.put(`/admin/users/${u.id}`, { fullName: u.fullName, role: u.role, directorateId: u.directorateId, isActive: !u.isActive });
      load();
    } catch (err: any) {
      showToast(extractErrorMessage(err), 'error');
    }
  };

  const handleDelete = async (u: UserRow) => {
    if (!confirm(`هل تريد حذف المستخدم ${u.fullName}؟`)) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      showToast('تم حذف المستخدم بنجاح.', 'success');
      load();
    } catch (err: any) {
      showToast(extractErrorMessage(err), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">إدارة المستخدمين</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>+ إضافة مستخدم</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="البريد الإلكتروني" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            <input className="input" placeholder="كلمة المرور" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
            <input className="input" placeholder="الاسم الكامل" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} required />
            <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>
              <option value="PROVINCIAL">منسق إقليمي</option>
              <option value="REGIONAL">منسق جهوي</option>
              <option value="ADMIN">مدير النظام</option>
            </select>
            {form.role === 'PROVINCIAL' && (
              <select className="input" value={form.directorateId} onChange={(e) => setForm((f) => ({ ...f, directorateId: e.target.value }))} required>
                <option value="">— اختر المديرية —</option>
                {directorates.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
          </div>
          <button type="submit" className="btn btn-primary">حفظ المستخدم</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        {loading ? <EmptyState message="جارٍ التحميل..." /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-200">
                <th className="text-right py-2">الاسم</th><th className="text-right">البريد الإلكتروني</th><th className="text-right">الدور</th><th className="text-right">المديرية</th><th>نشط</th><th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="py-2">{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>{ROLE_LABELS[u.role]}</td>
                  <td>{u.directorateName || '—'}</td>
                  <td className="text-center">
                    <input type="checkbox" checked={u.isActive} onChange={() => handleToggleActive(u)} />
                  </td>
                  <td className="text-center">
                    <button className="text-red-600 text-xs hover:underline" onClick={() => handleDelete(u)}>حذف</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
