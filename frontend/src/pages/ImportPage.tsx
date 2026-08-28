import React, { useState } from 'react';
import { api } from '../services/api';
import { useYear } from '../context/YearContext';
import { EmptyState, extractErrorMessage, useToast } from '../components/ui';

interface PreviewRow {
  rowNumber: number;
  sheetName: string;
  data: { number: number; title: string; coordinatorName: string | null; statusLabel: string };
  errors: string[];
}

export default function ImportPage() {
  const { selectedYearId, years } = useYear();
  const { showToast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [preview, setPreview] = useState<{ totalRows: number; validCount: number; invalidCount: number; preview: PreviewRow[] } | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const selectedYearLabel = years.find((y) => y.id === selectedYearId)?.label;

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const res = await api.get('/import/template', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'نموذج-استيراد-خطة-العمل.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast(extractErrorMessage(err, 'تعذّر تحميل النموذج.'), 'error');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setPreview(null);
    setResult(null);
    setError('');
  };

  const handlePreview = async () => {
    if (!file) return;
    setPreviewing(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/import/preview', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreview(data);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'حدث خطأ أثناء استيراد الملف.'));
    } finally {
      setPreviewing(false);
    }
  };

  const handleCommit = async () => {
    if (!file || !selectedYearId) return;
    setCommitting(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('academicYearId', selectedYearId);
      const { data } = await api.post('/import/commit', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(data);
      showToast('تم استيراد البيانات بنجاح.', 'success');
    } catch (err: any) {
      setError(extractErrorMessage(err, 'حدث خطأ أثناء استيراد الملف.'));
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-xl font-bold text-slate-800">استيراد البيانات من Excel</h1>

      <div className="card space-y-3">
        <h3 className="font-bold text-slate-700">الخطوة 1: تحميل نموذج فارغ</h3>
        <p className="text-sm text-slate-500">
          نزّل نموذج Excel فارغًا بنفس بنية الأعمدة المطلوبة (ورقة لكل مديرية متاحة لك)، ثم املأه وأعد رفعه في الخطوة الثانية أدناه.
        </p>
        <button className="btn btn-secondary" disabled={downloadingTemplate} onClick={handleDownloadTemplate}>
          {downloadingTemplate ? 'جارٍ التحميل...' : '⬇ تحميل نموذج Excel فارغ'}
        </button>
      </div>

      <div className="card space-y-4">
        <h3 className="font-bold text-slate-700">الخطوة 2: رفع الملف المعبّأ</h3>
        <p className="text-sm text-slate-500">
          الملف يجب أن يحتوي على أوراق باسم المديريات (مراكش، الصويرة، ...) بنفس بنية النموذج الأصلي.
          سيتم استيراد البيانات إلى السنة الدراسية الحالية المحددة أعلى الصفحة: <span className="font-bold text-brand-700">{selectedYearLabel}</span>
        </p>
        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="block text-sm" />
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
        <div className="flex gap-3">
          <button className="btn btn-secondary" disabled={!file || previewing} onClick={handlePreview}>
            {previewing ? 'جارٍ التحليل...' : 'معاينة الملف'}
          </button>
          {preview && preview.validCount > 0 && (
            <button className="btn btn-primary" disabled={committing} onClick={handleCommit}>
              {committing ? 'جارٍ الاستيراد...' : `تأكيد الاستيراد (${preview.validCount} صف صالح)`}
            </button>
          )}
        </div>
      </div>

      {preview && !result && (
        <div className="card space-y-3">
          <div className="flex gap-6 text-sm">
            <span>إجمالي الصفوف: <b>{preview.totalRows}</b></span>
            <span className="text-green-600">صالحة: <b>{preview.validCount}</b></span>
            <span className="text-red-600">بها أخطاء: <b>{preview.invalidCount}</b></span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-right py-1">المديرية</th><th className="text-right">الصف</th><th className="text-right">رقم العملية</th><th className="text-right">العملية</th><th className="text-right">الأخطاء</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((row, idx) => (
                  <tr key={idx} className={`border-b border-slate-100 ${row.errors.length ? 'bg-red-50' : ''}`}>
                    <td className="py-1">{row.sheetName}</td>
                    <td>{row.rowNumber}</td>
                    <td>{row.data.number}</td>
                    <td className="max-w-xs truncate">{row.data.title}</td>
                    <td className="text-red-600">{row.errors.join(' / ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result && (
        <div className="card space-y-2">
          <h3 className="font-bold text-green-700">تم استيراد البيانات بنجاح.</h3>
          <p className="text-sm">تم إنشاء <b>{result.created}</b> عملية جديدة.</p>
          {result.skippedDuplicates > 0 && <p className="text-sm text-amber-600">تم تجاوز {result.skippedDuplicates} عملية لوجود رقم عملية مكرر مسبقًا.</p>}
          {result.invalidCount > 0 && <p className="text-sm text-red-600">تم تجاهل {result.invalidCount} صف بها أخطاء (راجع المعاينة أعلاه).</p>}
        </div>
      )}
    </div>
  );
}
