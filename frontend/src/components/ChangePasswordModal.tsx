import React, { useState } from 'react';
import { api } from '../services/api';
import { extractErrorMessage, useToast } from './ui';

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) return setError('يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل.');
    if (newPassword !== confirmPassword) return setError('كلمة المرور الجديدة وتأكيدها غير متطابقتين.');

    setSaving(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      showToast('تم تغيير كلمة المرور بنجاح.', 'success');
      onClose();
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-800">تغيير كلمة المرور</h2>

          {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">كلمة المرور الحالية</label>
            <input type="password" className="input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">كلمة المرور الجديدة</label>
            <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">تأكيد كلمة المرور الجديدة</label>
            <input type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'جارٍ الحفظ...' : 'تغيير كلمة المرور'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
}
