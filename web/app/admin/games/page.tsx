'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, fa, timeAgo, type Game } from '@/lib/adminApi';
import { Card, Badge, Spinner, ErrorBox, Empty } from '@/components/ui';

const REASON: Record<string, string> = {
  normal: 'عادی', resign: 'تسلیم', timeout: 'اتمام وقت',
  disconnect: 'قطع اتصال', left: 'ترک بازی', aborted: 'لغو شده'
};

export default function GamesPage() {
  const [rows, setRows] = useState<Game[] | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    adminApi.games(80).then((d) => setRows(d.rows)).catch((e) => setError(e.message));
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!rows) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">بازی‌های اخیر</h1>
        <p className="mt-1 text-xs text-ink-300">هر ۲۰ ثانیه تازه می‌شود</p>
      </div>

      {rows.length === 0 ? <Empty text="هنوز بازی‌ای انجام نشده" icon="🎲" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-right text-sm">
            <thead className="border-b border-ink-500 bg-ink-800/60 text-xs text-ink-300">
              <tr>
                <th className="px-4 py-3 font-bold">اتاق</th>
                <th className="px-4 py-3 font-bold">بازیکن‌ها</th>
                <th className="px-4 py-3 font-bold">ورودی</th>
                <th className="px-4 py-3 font-bold">جایزه</th>
                <th className="px-4 py-3 font-bold">فی</th>
                <th className="px-4 py-3 font-bold">پایان</th>
                <th className="px-4 py-3 font-bold">زمان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-500/60">
              {rows.map((g) => (
                <tr key={g.id} className="hover:bg-ink-800/40">
                  <td className="px-4 py-2.5 text-[12px]">{g.room_id}</td>
                  <td className="px-4 py-2.5 text-[12px]">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {g.p1_id
                        ? <Link href={`/admin/users/${g.p1_id}`}
                            className={g.winner_id === g.p1_id ? 'font-bold text-mint-300 hover:underline' : 'text-ink-300 hover:underline'}>
                            {g.p1_name || '—'}
                          </Link>
                        : <span className="text-ink-300">ربات</span>}
                      <span className="text-ink-300">در برابر</span>
                      {g.p2_id
                        ? <Link href={`/admin/users/${g.p2_id}`}
                            className={g.winner_id === g.p2_id ? 'font-bold text-mint-300 hover:underline' : 'text-ink-300 hover:underline'}>
                            {g.p2_name || '—'}
                          </Link>
                        : <span className="text-ink-300">ربات</span>}
                      {!!g.vs_bot && <Badge>ربات</Badge>}
                      {g.result >= 2 && <Badge tone="violet">{g.result === 3 ? 'توله‌مارس' : 'مارس'}</Badge>}
                    </span>
                  </td>
                  <td className="fa-nums px-4 py-2.5">{fa(g.entry)}</td>
                  <td className="fa-nums px-4 py-2.5 font-bold text-gold-400">{fa(g.prize)}</td>
                  <td className="fa-nums px-4 py-2.5 text-ink-300">{g.rake ? fa(g.rake) : '—'}</td>
                  <td className="px-4 py-2.5 text-[11.5px] text-ink-300">{REASON[g.end_reason] || g.end_reason || '—'}</td>
                  <td className="fa-nums px-4 py-2.5 text-[11.5px] text-ink-300">{timeAgo(g.ended_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
