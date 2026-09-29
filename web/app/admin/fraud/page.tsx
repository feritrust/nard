'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, fa, timeAgo, FRAUD_LABEL, type FraudFlag } from '@/lib/adminApi';
import { Card, Button, Badge, Spinner, ErrorBox, Empty, Toast } from '@/components/ui';

export default function FraudPage() {
  const [resolved, setResolved] = useState(false);
  const [rows, setRows] = useState<FraudFlag[] | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'err' } | null>(null);

  const load = () => {
    setRows(null); setError('');
    adminApi.fraud(resolved).then((d) => setRows(d.rows)).catch((e) => setError(e.message));
  };
  useEffect(load, [resolved]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const resolve = async (id: number) => {
    try {
      await adminApi.resolveFraud(id);
      setToast({ message: 'بسته شد', tone: 'ok' });
      load();
    } catch (e) {
      setToast({ message: (e as Error).message, tone: 'err' });
    }
  };

  const tone = (s: number) => (s >= 7 ? 'rose' : s >= 4 ? 'gold' : 'default') as 'rose' | 'gold' | 'default';

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      <div>
        <h1 className="text-2xl font-black">موارد مشکوک</h1>
        <p className="mt-1 text-xs leading-6 text-ink-300">
          سیستم خودکار این‌ها را علامت زده است. هر مورد لزوماً تقلب نیست — قبل از مسدود کردن بررسی کنید.
        </p>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant={!resolved ? 'gold' : 'ghost'} onClick={() => setResolved(false)}>باز</Button>
        <Button size="sm" variant={resolved ? 'gold' : 'ghost'} onClick={() => setResolved(true)}>بسته‌شده</Button>
      </div>

      {error ? <ErrorBox message={error} onRetry={load} />
        : !rows ? <Spinner />
        : rows.length === 0 ? <Empty text={resolved ? 'مورد بسته‌شده‌ای نیست' : 'هیچ مورد مشکوکی نیست 👌'} icon="🛡️" />
        : (
          <div className="space-y-3">
            {rows.map((f) => (
              <Card key={f.id} className={`p-5 ${f.score >= 7 ? 'border-rose-400/40' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={tone(f.score)}>{FRAUD_LABEL[f.kind] || f.kind}</Badge>
                      <span className="fa-nums text-[11px] text-ink-300">شدت {fa(f.score)} از ۱۰</span>
                      <span className="fa-nums text-[11px] text-ink-300">• {timeAgo(f.created_at)}</span>
                    </div>
                    <p className="fa-nums mt-2.5 text-sm leading-7">{f.detail}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {f.user_id && (
                        <Link href={`/admin/users/${f.user_id}`}
                          className="rounded-lg border border-ink-500 bg-ink-900 px-3 py-1.5 text-xs transition hover:border-sky-400/50">
                          👤 {f.user_name || f.user_id.slice(0, 10)}
                        </Link>
                      )}
                      {f.other_id && (
                        <Link href={`/admin/users/${f.other_id}`}
                          className="rounded-lg border border-ink-500 bg-ink-900 px-3 py-1.5 text-xs transition hover:border-sky-400/50">
                          👤 {f.other_name || f.other_id.slice(0, 10)}
                        </Link>
                      )}
                    </div>
                  </div>
                  {!f.resolved && (
                    <Button size="sm" variant="ghost" onClick={() => resolve(f.id)}>بررسی شد</Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
