import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { extractErrorMessage } from '../components/ui';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('رابط الاستعادة غير صالح.');
      return;
    }
    if (password.length < 6) {
      setError('يجب أن تتكون كلمة المرور الجديدة من 6 أحرف على الأقل.');
      return;
    }
    if (password !== confirm) {
      setError('تأكيد كلمة المرور غير مطابق.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setSuccess(true);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'تعذر إعادة تعيين كلمة المرور.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-brand-800">نظام تتبع خطط العمل</h1>
          <p className="text-sm text-slate-500 mt-1">الأكاديمية الجهوية للتربية والتكوين - مراكش آسفي</p>
        </div>
        <div className="card space-y-4">
          <h2 className="text-lg font-bold text-slate-800">إعادة تعيين كلمة المرور</h2>

          {success ? (
            <div className="space-y-4">
              <div className="bg-green-50 text-green-700 text-sm rounded-lg px-3 py-3">
                تم تغيير كلمة المرور بنجاح، يمكنك الآن تسجيل الدخول.
              </div>
              <Link to="/login" className="btn btn-primary w-full block text-center">تسجيل الدخول</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">كلمة المرور الجديدة</label>
                <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">تأكيد كلمة المرور</label>
                <input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={6} required />
              </div>
              <button type="submit" disabled={loading || !token} className="btn btn-primary w-full">
                {loading ? 'جارٍ تغيير كلمة المرور...' : 'تغيير كلمة المرور'}
              </button>
              <Link to="/login" className="block text-center text-sm text-brand-700 hover:underline">العودة إلى تسجيل الدخول</Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
