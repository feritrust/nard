'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { adminApi, fa, timeAgo, type AdminUser } from '@/lib/adminApi';
import { Card, Button, Input, Badge, Spinner, ErrorBox, Empty } from '@/components/ui';

const SORTS = [
  { v: 'created_at', l: 'جدیدترین' },
  { v: 'last_seen', l: 'آخرین فعالیت' },
  { v: 'coins', l: 'بیشترین سکه' },
  { v: 'games', l: 'بیشترین بازی' },
  { v: 'xp', l: 'بالاترین سطح' }
];

export default function UsersPage() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('created_at');
  const [banned, setBanned] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ rows: AdminUser[]; total: number } | null>(null);
  const [error, setError] = useState('');

  const limit = 25;

  const load = useCallback(() => {
    setData(null); setError('');
    adminApi.users({ q: search, sort, dir: 'DESC', limit, offset: page * limit, banned })
      .then(setData).catch((e) => setError(e.message));
  }, [search, sort, page, banned]);

  useEffect(load, [load]);
  useEffect(() => { setPage(0); }, [search, sort, banned]);

  const pages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">کاربران</h1>
        {data && <span className="fa-nums text-sm text-ink-300">{fa(data.total)} کاربر</span>}
      </div>

      {/* ------------------------------------------------------ جست‌وجو */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              value={q}
              onChange={setQ}
              placeholder="نام، شماره، شناسه یا کد معرف…"
              onKeyDown={(e) => e.key === 'Enter' && setSearch(q)}
            />
          </div>
          <Button variant="gold" onClick={() => setSearch(q)}>جست‌وجو</Button>
          {search && <Button variant="ghost" onClick={() => { setQ(''); setSearch(''); }}>پاک کردن</Button>}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-300">مرتب‌سازی:</span>
          {SORTS.map((s) => (
            <Button key={s.v} size="sm" variant={sort === s.v ? 'sky' : 'ghost'} onClick={() => setSort(s.v)}>
              {s.l}
            </Button>
          ))}
          <span className="mx-1 w-px self-stretch bg-ink-500" />
          <Button size="sm" variant={banned === '1' ? 'rose' : 'ghost'} onClick={() => setBanned(banned === '1' ? '' : '1')}>
            فقط مسدودها
          </Button>
        </div>
      </Card>

      {error ? <ErrorBox message={error} onRetry={load} />
        : !data ? <Spinner />
        : data.rows.length === 0 ? <Empty text="کاربری پیدا نشد" icon="🔍" />
        : (
          <>
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-right text-sm">
                <thead className="border-b border-ink-500 bg-ink-800/60 text-xs text-ink-300">
                  <tr>
                    <th className="px-4 py-3 font-bold">کاربر</th>
                    <th className="px-4 py-3 font-bold">سکه</th>
                    <th className="px-4 py-3 font-bold">انرژی</th>
                    <th className="px-4 py-3 font-bold">سطح</th>
                    <th className="px-4 py-3 font-bold">بازی</th>
                    <th className="px-4 py-3 font-bold">آخرین فعالیت</th>
                    <th className="px-4 py-3 font-bold">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-500/60">
                  {data.rows.map((u) => (
                    <tr key={u.id} className="transition hover:bg-ink-800/40">
                      <td className="px-4 py-3">
                        <Link href={`/admin/users/${u.id}`} className="flex items-center gap-2.5 group">
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-ink-500 bg-ink-900 text-lg">
                            {u.avatar}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-bold group-hover:text-sky-400">
                              {u.name || 'بی‌نام'}
                            </span>
                            <span className="fa-nums block text-[11px] text-ink-300" dir="ltr">
                              {u.phone || (u.telegramId ? 'TG ' + u.telegramId : 'مهمان')}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="fa-nums px-4 py-3 font-bold text-gold-400">{fa(u.coins)}</td>
                      <td className="fa-nums px-4 py-3 text-energy-400">{fa(u.energy)}</td>
                      <td className="fa-nums px-4 py-3">{fa(u.level)}</td>
                      <td className="fa-nums px-4 py-3 text-ink-300">
                        {fa(u.games)}
                        {u.games > 0 && (
                          <span className="mr-1 text-[11px]">
                            ({Math.round((u.wins / u.games) * 100).toLocaleString('fa-IR')}٪)
                          </span>
                        )}
                      </td>
                      <td className="fa-nums px-4 py-3 text-[12px] text-ink-300">{timeAgo(u.lastSeen)}</td>
                      <td className="px-4 py-3">
                        {u.banned ? <Badge tone="rose">مسدود</Badge>
                          : u.isGuest ? <Badge>مهمان</Badge>
                          : <Badge tone="mint">تأییدشده</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {pages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  → قبلی
                </Button>
                <span className="fa-nums text-xs text-ink-300">
                  صفحه {fa(page + 1)} از {fa(pages)}
                </span>
                <Button size="sm" variant="ghost" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                  بعدی ←
                </Button>
              </div>
            )}
          </>
        )}
    </div>
  );
}
