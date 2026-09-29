'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, faDateTime, ACTION_LABEL, type AdminLog } from '@/lib/adminApi';
import { Card, Badge, Spinner, ErrorBox, Empty } from '@/components/ui';

export default function LogPage() {
  const [rows, setRows] = useState<AdminLog[] | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    adminApi.log(150).then((d) => setRows(d.rows)).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!rows) return <Spinner />;

  const tone = (a: string) =>
    a === 'login_failed' ? 'rose'
      : a === 'adjust' || a === 'settings' ? 'gold'
      : a === 'ban' ? 'rose'
      : a === 'claim_approve' ? 'mint'
      : 'default';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">گزارش فعالیت</h1>
        <p className="mt-1 text-xs text-ink-300">هر کاری که ادمین‌ها انجام داده‌اند — برای پیگیری و حسابرسی</p>
      </div>

      {rows.length === 0 ? <Empty text="فعالیتی ثبت نشده" icon="📜" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-right text-sm">
            <thead className="border-b border-ink-500 bg-ink-800/60 text-xs text-ink-300">
              <tr>
                <th className="px-4 py-3 font-bold">ادمین</th>
                <th className="px-4 py-3 font-bold">عملیات</th>
                <th className="px-4 py-3 font-bold">هدف</th>
                <th className="px-4 py-3 font-bold">جزئیات</th>
                <th className="px-4 py-3 font-bold">IP</th>
                <th className="px-4 py-3 font-bold">زمان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-500/60">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-ink-800/40">
                  <td className="px-4 py-2.5 font-bold">{r.username || '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={tone(r.action) as any}>{ACTION_LABEL[r.action] || r.action}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-[11.5px]">
                    {r.target
                      ? r.target.startsWith('u_')
                        ? <Link href={`/admin/users/${r.target}`} className="text-sky-400 hover:underline" dir="ltr">{r.target.slice(0, 12)}…</Link>
                        : <span dir="ltr">{r.target}</span>
                      : <span className="text-ink-300">—</span>}
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-2.5 text-[11.5px] text-ink-300">{r.detail || '—'}</td>
                  <td className="px-4 py-2.5 text-[11px] text-ink-300" dir="ltr">{r.ip || '—'}</td>
                  <td className="fa-nums px-4 py-2.5 text-[11.5px] text-ink-300">{faDateTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
