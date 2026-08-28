import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useYear } from '../context/YearContext';
import ChangePasswordModal from './ChangePasswordModal';

const navItemsBase = [
  { to: '/', label: 'الرئيسية / لوحة القيادة', roles: ['ADMIN', 'REGIONAL', 'PROVINCIAL'] },
  { to: '/actions', label: 'خطة العمل / العمليات', roles: ['ADMIN', 'REGIONAL', 'PROVINCIAL'] },
  { to: '/reports', label: 'التقارير', roles: ['ADMIN', 'REGIONAL', 'PROVINCIAL'] },
  { to: '/import', label: 'استيراد البيانات', roles: ['ADMIN', 'REGIONAL', 'PROVINCIAL'] },
  { to: '/users', label: 'المستخدمون', roles: ['ADMIN'] },
  { to: '/audit-log', label: 'سجل التغييرات', roles: ['ADMIN'] },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { years, selectedYearId, setSelectedYearId } = useYear();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);

  const navItems = navItemsBase.filter((i) => user && i.roles.includes(user.role));

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 bg-white border-l border-slate-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-100">
          <h1 className="text-lg font-extrabold text-brand-700 leading-tight">نظام تتبع خطط العمل</h1>
          <p className="text-xs text-slate-400 mt-1">AREF Marrakech-Safi</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="w-full text-right px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">السنة الدراسية:</span>
            <select className="input !w-auto" value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">
              {user?.fullName} <span className="text-slate-400">·</span>{' '}
              <span className="text-brand-700 font-medium">
                {user?.role === 'REGIONAL' ? 'منسق جهوي' : user?.role === 'ADMIN' ? 'مدير النظام' : 'منسق إقليمي'}
              </span>
            </span>
            <button
              onClick={() => setShowChangePassword(true)}
              className="text-sm font-medium text-brand-700 hover:bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-200"
            >
              تغيير كلمة المرور
            </button>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="text-sm font-medium text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200"
              title="تسجيل الخروج"
            >
              تسجيل الخروج
            </button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </div>
  );
}
