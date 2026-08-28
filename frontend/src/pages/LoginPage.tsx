import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { extractErrorMessage } from '../components/ui';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(extractErrorMessage(err, 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-extrabold text-brand-800">نظام تتبع خطط العمل</h1>
          <p className="text-sm text-slate-500 mt-1">الأكاديمية الجهوية للتربية والتكوين - مراكش آسفي</p>
        </div>
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="text-lg font-bold text-slate-800">تسجيل الدخول</h2>

          {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">البريد الإلكتروني</label>
            <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">كلمة المرور</label>
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? 'جارٍ تسجيل الدخول...' : 'تسجيل الدخول'}
          </button>

          <p className="text-xs text-slate-400 text-center pt-2">
            حسابات تجريبية: admin@aref-ms.ma · regional@example.com · marrakech@example.com (كلمة المرور: Passer@2026)
          </p>
        </form>
      </div>
    </div>
  );
}
