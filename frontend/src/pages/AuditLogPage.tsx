import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { EmptyState } from '../components/ui';

interface AuditLogRow {
  id: string; userName: string; entityType: string; entityId: string; actionType: string;
  before: any; after: any; createdAt: string;
}

const ACTION_LABELS: Record<string, string> = { CREATE: 'إنشاء', UPDATE: 'تعديل', DELETE: 'حذف' };

function diffFields(before: any, after: any): string[] {
  if (!before || !after) return [];
  const changes: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (['updatedAt', 'createdAt'].includes(key)) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes.push(`${key}: ${before[key] ?? '—'} ← ${after[key] ?? '—'}`);
    }
  }
  return changes;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/audit-logs').then((res) => setLogs(res.data.items)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">سجل التغييرات</h1>
      <div className="card">
        {loading ? <EmptyState message="جارٍ التحميل..." /> : logs.length === 0 ? <EmptyState message="لا توجد تغييرات مسجلة بعد." /> : (
          <ul className="space-y-3">
            {logs.map((log) => (
              <li key={log.id} className="border-b border-slate-100 pb-3 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span><b>{log.userName}</b> قام بعملية <b>{ACTION_LABELS[log.actionType] || log.actionType}</b> على {log.entityType}</span>
                  <span className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString('ar-MA')}</span>
                </div>
                {log.actionType === 'UPDATE' && (
                  <ul className="text-xs text-slate-500 mt-1 list-disc pr-5">
                    {diffFields(log.before, log.after).map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
