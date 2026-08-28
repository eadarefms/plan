import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useYear } from '../context/YearContext';
import { extractErrorMessage, useToast } from './ui';
import type { ActionItem } from '../types';

export default function ActionFormModal({
  action, directorateId, onClose, onSaved,
}: { action: ActionItem | null; directorateId: string; onClose: () => void; onSaved: () => void }) {
  const { selectedYearId } = useYear();
  const { showToast } = useToast();
  const isCreate = !action; // وضع "إعداد خطة العمل" مقابل وضع "التتبع" (تعديل عملية موجودة)
  const [coordinatorSuggestions, setCoordinatorSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: action?.title ?? '',
    coordinatorName: action?.coordinatorName ?? '',
    startDate: action?.startDate?.slice(0, 10) ?? '',
    endDate: action?.endDate?.slice(0, 10) ?? '',
    indicator: action?.indicator ?? '',
    currentValue: action?.currentValue ?? '',
    targetValue: action?.targetValue ?? '',
    achievedValue: action?.achievedValue ?? '',
    isPercentage: action?.isPercentage ?? true,
    isCompleted: action?.isCompleted ?? false,
  });

  useEffect(() => {
    api.get('/coordinator-suggestions', { params: { directorateId } }).then((res) => setCoordinatorSuggestions(res.data));
  }, [directorateId]);

  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('العملية مطلوبة.');

    // رقم العملية أوتوماتيكي بالكامل: لا يُرسَل عند الإنشاء (يحسبه الخادم)، ولا يُعدَّل بعد ذلك أبدًا.
    // وضعية العملية تُدار حصريًا من جدول العمليات أثناء التتبع، وليس من هذا النموذج.
    const payload: any = {
      directorateId,
      academicYearId: selectedYearId,
      title: form.title.trim(),
      coordinatorName: form.coordinatorName.trim() || null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      indicator: form.indicator || null,
      currentValue: form.currentValue === '' ? null : Number(form.currentValue),
      targetValue: form.targetValue === '' ? null : Number(form.targetValue),
      achievedValue: form.achievedValue === '' ? null : Number(form.achievedValue),
      isPercentage: form.isPercentage,
      isCompleted: form.isCompleted,
    };

    setSaving(true);
    try {
      if (action) {
        await api.put(`/actions/${action.id}`, payload);
        showToast('تم حفظ العملية بنجاح.', 'success');
      } else {
        await api.post('/actions', payload);
        showToast('تم حفظ العملية بنجاح.', 'success');
      }
      onSaved();
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const valueSuffix = form.isPercentage ? '%' : '';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">{action ? 'تعديل عملية' : 'إضافة عملية جديدة'}</h2>
            {!isCreate && <span className="text-sm text-slate-400">رقم العملية: <b className="text-slate-600">{action!.number}</b></span>}
          </div>
          {isCreate && <p className="text-xs text-slate-400 -mt-2">سيُحدَّد رقم العملية تلقائيًا بناءً على عدد العمليات المُبلورة سابقًا في هذه الخطة.</p>}

          {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">منسق العملية</label>
            <input
              type="text" className="input" list="coordinator-suggestions"
              value={form.coordinatorName} onChange={(e) => set('coordinatorName', e.target.value)}
              placeholder="اسم منسق العملية"
            />
            <datalist id="coordinator-suggestions">
              {coordinatorSuggestions.map((name) => <option key={name} value={name} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">العملية *</label>
            <textarea className="input" rows={2} value={form.title} onChange={(e) => set('title', e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">بداية الإنجاز</label>
              <input type="date" className="input" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">نهاية الإنجاز</label>
              <input type="date" className="input" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">المؤشر</label>
            <input type="text" className="input" value={form.indicator} onChange={(e) => set('indicator', e.target.value)} />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">نوع القيم (الحالية / المستهدفة / المنجزة)</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={form.isPercentage} onChange={() => set('isPercentage', true)} /> نسبة مئوية (%)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" checked={!form.isPercentage} onChange={() => set('isPercentage', false)} /> عدد (رقم مطلق)
              </label>
            </div>
          </div>

          <div className={`grid ${isCreate ? 'grid-cols-2' : 'grid-cols-3'} gap-4`}>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">القيمة الحالية {valueSuffix && `(${valueSuffix})`}</label>
              <input type="number" step="any" className="input" value={form.currentValue} onChange={(e) => set('currentValue', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">القيمة المستهدفة {valueSuffix && `(${valueSuffix})`}</label>
              <input type="number" step="any" className="input" value={form.targetValue} onChange={(e) => set('targetValue', e.target.value)} />
            </div>
            {!isCreate && (
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">القيمة المنجزة {valueSuffix && `(${valueSuffix})`}</label>
                <input type="number" step="any" min="0" className="input" value={form.achievedValue} onChange={(e) => set('achievedValue', e.target.value)} />
              </div>
            )}
          </div>

          {isCreate ? (
            <p className="text-xs text-slate-400 -mt-2">
              ملاحظة: تُملأ "القيمة المنجزة" وتُحدَّد "وضعية العملية" لاحقًا أثناء تتبع تنفيذ العملية مباشرة من جدول العمليات، وليس عند إعداد الخطة.
            </p>
          ) : (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isCompleted}
                onChange={(e) => set('isCompleted', e.target.checked)}
              />
              <span className="text-sm font-medium text-slate-700">تم الإنجاز</span>
            </label>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? 'جارٍ الحفظ...' : 'حفظ'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">إلغاء</button>
          </div>
        </form>
      </div>
    </div>
  );
}
