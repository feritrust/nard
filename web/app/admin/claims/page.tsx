'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, fa, faDateTime, timeAgo, type Claim } from '@/lib/adminApi';
import { Card, Button, Badge, Spinner, ErrorBox, Empty, Modal, Input, Toast } from '@/components/ui';

const STATUS: Record<string, { label: string; tone: 'gold' | 'mint' | 'rose' | 'default' }> = {
  pending: { label: 'در انتظار', tone: 'gold' },
  approved: { label: 'تأیید شده', tone: 'mint' },
  rejected: { label: 'رد شده', tone: 'rose' }
};

export default function ClaimsPage() {
  const [status, setStatus] = useState('pending');
  const [kind, setKind] = useState('');
  const [rows, setRows] = useState<Claim[] | null>(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState<Claim | null>(null);
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'err' } | null>(null);

  const load = () => {
    setRows(null); setError('');
    adminApi.claims(status, kind || undefined).then((d) => setRows(d.rows)).catch((e) => setError(e.message));
  };
  useEffect(load, [status, kind]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const openDialog = (c: Claim, a: 'approve' | 'reject') => {
    setActive(c); setAction(a); setNote('');
  };

  const confirm = async () => {
    if (!active) return;
    if (action === 'reject' && !note.trim()) { setToast({ message: 'دلیل رد را بنویسید', tone: 'err' }); return; }
    setBusy(true);
    try {
      await adminApi.resolveClaim(active.id, action, note.trim());
      setToast({
        message: action === 'approve' ? 'درخواست تأیید شد' : 'درخواست رد شد و دارایی برگشت',
        tone: 'ok'
      });
      setActive(null);
      load();
    } catch (e) {
      setToast({ message: (e as Error).message, tone: 'err' });
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      <div>
        <h1 className="text-2xl font-black">درخواست‌ها</h1>
        <p className="mt-1 text-xs leading-6 text-ink-300">
          فروش سکه و جوایز واقعی. <b className="text-ink-100">رد کردن</b> درخواست، سکه یا انرژی را به کاربر برمی‌گرداند.
        </p>
      </div>

      {/* ------------------------------------------------------ فیلترها */}
      <div className="flex flex-wrap gap-2">
        {[
          { v: 'pending', l: 'در انتظار' },
          { v: 'approved', l: 'تأیید شده' },
          { v: 'rejected', l: 'رد شده' },
          { v: 'all', l: 'همه' }
        ].map((t) => (
          <Button key={t.v} size="sm" variant={status === t.v ? 'gold' : 'ghost'} onClick={() => setStatus(t.v)}>
            {t.l}
          </Button>
        ))}
        <span className="mx-1 w-px bg-ink-500" />
        {[
          { v: '', l: 'همه‌ی انواع' },
          { v: 'sell', l: '💳 فروش سکه' },
          { v: 'prize', l: '🎁 جایزه' }
        ].map((t) => (
          <Button key={t.v} size="sm" variant={kind === t.v ? 'sky' : 'ghost'} onClick={() => setKind(t.v)}>
            {t.l}
          </Button>
        ))}
      </div>

      {error ? <ErrorBox message={error} onRetry={load} />
        : !rows ? <Spinner />
        : rows.length === 0 ? <Empty text="درخواستی در این دسته نیست" icon="✅" />
        : (
          <div className="space-y-3">
            {rows.map((c) => (
              <Card key={c.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={c.kind === 'sell' ? 'sky' : 'violet'}>
                        {c.kind === 'sell' ? '💳 فروش سکه' : '🎁 جایزه'}
                      </Badge>
                      <Badge tone={STATUS[c.status]?.tone || 'default'}>{STATUS[c.status]?.label || c.status}</Badge>
                      {!!c.user_banned && <Badge tone="rose">کاربر مسدود</Badge>}
                      <code className="text-[11px] text-ink-300" dir="ltr">{c.id}</code>
                    </div>

                    <div className="fa-nums mt-3 text-lg font-black">
                      {c.kind === 'sell'
                        ? <>{fa(c.amount)} سکه ← <span className="text-mint-300">{fa(c.toman)} تومان</span></>
                        : <span className="text-violet-400">{c.prize_name}</span>}
                    </div>

                    <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
                      <div className="flex gap-2">
                        <dt className="text-ink-300">کاربر:</dt>
                        <dd className="min-w-0 truncate">
                          <Link href={`/admin/users/${c.user_id}`} className="font-bold text-sky-400 hover:underline">
                            {c.user_name || '—'}
                          </Link>
                          <span className="fa-nums mr-2 text-ink-300">({fa(c.user_coins)} سکه)</span>
                        </dd>
                      </div>
                      {c.user_phone && (
                        <div className="flex gap-2">
                          <dt className="text-ink-300">شماره:</dt>
                          <dd className="fa-nums" dir="ltr">{c.user_phone}</dd>
                        </div>
                      )}
                      {c.dest && (
                        <div className="flex gap-2">
                          <dt className="text-ink-300">کارت/شبا:</dt>
                          <dd className="select-all font-mono text-[12px]" dir="ltr">{c.dest}</dd>
                        </div>
                      )}
                      {c.contact && (
                        <div className="flex gap-2">
                          <dt className="text-ink-300">تماس:</dt>
                          <dd className="select-all" dir="ltr">{c.contact}</dd>
                        </div>
                      )}
                      {!!c.energy && (
                        <div className="flex gap-2">
                          <dt className="text-ink-300">انرژی:</dt>
                          <dd className="fa-nums text-energy-400">{fa(c.energy)} ⚡</dd>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <dt className="text-ink-300">ثبت:</dt>
                        <dd className="fa-nums">{timeAgo(c.created_at)}</dd>
                      </div>
                    </dl>

                    {c.status !== 'pending' && (
                      <p className="fa-nums mt-3 rounded-lg bg-ink-900 px-3 py-2 text-[11.5px] text-ink-300">
                        {STATUS[c.status]?.label} توسط <b className="text-ink-100">{c.handled_by || '—'}</b>
                        {' • '}{faDateTime(c.handled_at)}
                        {c.admin_note && <> — «{c.admin_note}»</>}
                      </p>
                    )}
                  </div>

                  {c.status === 'pending' && (
                    <div className="flex shrink-0 gap-2">
                      <Button variant="mint" size="sm" onClick={() => openDialog(c, 'approve')}>✓ تأیید</Button>
                      <Button variant="rose" size="sm" onClick={() => openDialog(c, 'reject')}>✕ رد</Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

      {/* ------------------------------------------------------ تأیید */}
      <Modal open={!!active} onClose={() => setActive(null)} title={action === 'approve' ? 'تأیید درخواست' : 'رد درخواست'}>
        {active && (
          <>
            <div className="fa-nums rounded-xl bg-ink-900 p-4 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-ink-300">کاربر</span>
                <span className="font-bold">{active.user_name}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-ink-300">مورد</span>
                <span className="font-bold">
                  {active.kind === 'sell' ? `${fa(active.amount)} سکه` : active.prize_name}
                </span>
              </div>
              {active.kind === 'sell' && (
                <>
                  <div className="flex justify-between py-1">
                    <span className="text-ink-300">مبلغ واریزی</span>
                    <span className="font-bold text-mint-300">{fa(active.toman)} تومان</span>
                  </div>
                  <div className="flex justify-between gap-3 py-1">
                    <span className="shrink-0 text-ink-300">به کارت</span>
                    <span className="select-all font-mono text-[12px]" dir="ltr">{active.dest}</span>
                  </div>
                </>
              )}
            </div>

            <p className="mt-4 text-[12.5px] leading-7 text-ink-300">
              {action === 'approve'
                ? active.kind === 'sell'
                  ? 'قبل از تأیید مطمئن شوید مبلغ را واقعاً واریز کرده‌اید. سکه از قبل کسر شده است.'
                  : 'با تأیید، جایزه به‌عنوان ارسال‌شده ثبت می‌شود.'
                : active.kind === 'sell'
                  ? 'با رد کردن، سکه‌ها به کاربر برمی‌گردد.'
                  : 'با رد کردن، انرژی به کاربر برمی‌گردد.'}
            </p>

            <div className="mt-4">
              <label className="mb-1.5 block text-xs text-ink-300">
                یادداشت {action === 'reject' && <span className="text-rose-400">(اجباری)</span>}
              </label>
              <Input
                value={note}
                onChange={setNote}
                placeholder={action === 'approve' ? 'مثلاً: واریز شد — کد پیگیری ۱۲۳' : 'دلیل رد کردن'}
              />
            </div>

            <div className="mt-5 flex gap-2">
              <Button variant="ghost" onClick={() => setActive(null)} className="flex-1">انصراف</Button>
              <Button
                variant={action === 'approve' ? 'mint' : 'rose'}
                onClick={confirm}
                disabled={busy}
                className="flex-1"
              >
                {busy ? 'لطفاً صبر کنید…' : action === 'approve' ? 'تأیید نهایی' : 'رد کردن'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
