import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { extractErrorMessage } from '../components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'تعذر إرسال طلب استعادة كلمة المرور.'));
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
          <h2 className="text-lg font-bold text-slate-800">نسيت كلمة المرور؟</h2>

          {sent ? (
            <div className="space-y-4">
              <div className="bg-green-50 text-green-700 text-sm rounded-lg px-3 py-3">
                إذا كان البريد الإلكتروني مسجلاً في النظام، فسيتم إرسال رابط استعادة كلمة المرور إليه.
                <br />يرجى التحقق من صندوق البريد والرسائل غير المرغوب فيها.
              </div>
              <Link to="/login" className="btn btn-primary w-full block text-center">العودة إلى تسجيل الدخول</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
              <p className="text-sm text-slate-500">أدخل بريدك الإلكتروني وسنرسل لك رابطًا آمنًا لإعادة تعيين كلمة المرور.</p>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">البريد الإلكتروني</label>
                <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>
              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? 'جارٍ الإرسال...' : 'إرسال رابط الاستعادة'}
              </button>
              <Link to="/login" className="block text-center text-sm text-brand-700 hover:underline">العودة إلى تسجيل الدخول</Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
