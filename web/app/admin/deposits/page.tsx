'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, fa, faUsdt, usdt, toMicro, faDateTime, timeAgo, type Deposit } from '@/lib/adminApi';
import { Card, Button, Badge, Spinner, ErrorBox, Empty, Modal, Input, Toast } from '@/components/ui';

const STATUS: Record<string, { label: string; tone: 'gold' | 'mint' | 'rose' | 'default' }> = {
  pending: { label: 'در انتظار', tone: 'gold' },
  approved: { label: 'تأیید شده', tone: 'mint' },
  rejected: { label: 'رد شده', tone: 'rose' }
};

/** نشانی بررسی تراکنش روی بلاک‌اکسپلورر هر شبکه */
function explorer(network: string, txid: string) {
  if (network === 'BEP20') return `https://bscscan.com/tx/0x${txid.replace(/^0x/, '')}`;
  return `https://tronscan.org/#/transaction/${txid}`;
}

export default function DepositsPage() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<Deposit[] | null>(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState<Deposit | null>(null);
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [credited, setCredited] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'err' } | null>(null);

  const load = () => {
    setRows(null); setError('');
    adminApi.deposits(status).then((d) => setRows(d.rows)).catch((e) => setError(e.message));
  };
  useEffect(load, [status]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const openDialog = (d: Deposit, a: 'approve' | 'reject') => {
    setActive(d); setAction(a); setNote('');
    setCredited(usdt(d.amount));       // پیش‌فرض: همان مبلغی که کاربر گفته
  };

  const confirm = async () => {
    if (!active) return;
    if (action === 'reject' && !note.trim()) {
      setToast({ message: 'دلیل رد را بنویسید', tone: 'err' }); return;
    }
    const micro = toMicro(credited);
    if (action === 'approve' && micro <= 0) {
      setToast({ message: 'مبلغ درست نیست', tone: 'err' }); return;
    }

    setBusy(true);
    try {
      await adminApi.resolveDeposit(active.id, action, {
        credited: action === 'approve' ? micro : undefined,
        note: note.trim()
      });
      setToast({
        message: action === 'approve' ? `${faUsdt(micro)} تتر به حساب کاربر اضافه شد` : 'واریز رد شد',
        tone: 'ok'
      });
      setActive(null);
      load();
    } catch (e: any) {
      setToast({ message: e.message, tone: 'err' });
    } finally {
      setBusy(false);
    }
  };

  const pendingTotal = (rows || [])
    .filter((r) => r.status === 'pending')
    .reduce((n, r) => n + r.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black">واریزهای تتر</h1>
          <p className="mt-1 text-xs text-ink-300">
            قبل از تأیید، شناسه‌ی تراکنش را روی بلاک‌اکسپلورر ببینید و مطمئن شوید
            مبلغ و آدرس مقصد درست است.
          </p>
        </div>
        <div className="flex gap-2">
          {['pending', 'approved', 'rejected', 'all'].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={status === s ? 'gold' : 'ghost'}
              onClick={() => setStatus(s)}
            >
              {s === 'all' ? 'همه' : STATUS[s].label}
            </Button>
          ))}
        </div>
      </div>

      {status === 'pending' && pendingTotal > 0 && (
        <Card>
          <div className="fa-nums text-sm">
            <span className="text-ink-300">در انتظار تأیید: </span>
            <b className="text-gold-400">{faUsdt(pendingTotal)} تتر</b>
            <span className="text-ink-300"> در </span>
            <b>{fa((rows || []).length)}</b>
            <span className="text-ink-300"> درخواست</span>
          </div>
        </Card>
      )}

      {error && <ErrorBox message={error} onRetry={load} />}
      {!rows && !error && <Spinner />}
      {rows && rows.length === 0 && <Empty icon="💵" text="واریزی در این وضعیت نیست" />}

      {rows && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((d) => (
            <Card key={d.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="fa-nums text-lg font-black text-mint-400" dir="ltr">
                      {faUsdt(d.status === 'approved' ? d.credited : d.amount)} USDT
                    </span>
                    <Badge tone={STATUS[d.status].tone}>{STATUS[d.status].label}</Badge>
                    <Badge>{d.network}</Badge>
                    {d.status === 'approved' && d.credited !== d.amount && (
                      <Badge tone="gold">اصلاح‌شده از {faUsdt(d.amount)}</Badge>
                    )}
                  </div>

                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-2">
                    <div className="flex gap-2">
                      <dt className="text-ink-300">کاربر:</dt>
                      <dd className="truncate">
                        <Link href={`/admin/users/${d.user_id}`} className="hover:text-sky-400">
                          {d.name || 'بی‌نام'}
                          {d.username && <span className="text-ink-300" dir="ltr"> ({d.username})</span>}
                        </Link>
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-ink-300">کد:</dt>
                      <dd className="font-mono text-[11px]" dir="ltr">{d.id}</dd>
                    </div>
                    <div className="flex gap-2 sm:col-span-2">
                      <dt className="shrink-0 text-ink-300">TXID:</dt>
                      <dd className="min-w-0 break-all font-mono text-[11px]" dir="ltr">
                        <a
                          href={explorer(d.network, d.txid)}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-sky-400 underline-offset-2 hover:underline"
                        >
                          {d.txid}
                        </a>
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-ink-300">ثبت:</dt>
                      <dd className="fa-nums">{faDateTime(d.created_at)} ({timeAgo(d.created_at)})</dd>
                    </div>
                    {d.handled_at && (
                      <div className="flex gap-2">
                        <dt className="text-ink-300">رسیدگی:</dt>
                        <dd className="fa-nums">{faDateTime(d.handled_at)} — {d.handled_by}</dd>
                      </div>
                    )}
                  </dl>

                  {d.admin_note && (
                    <p className="mt-2 rounded-lg border border-ink-500 bg-ink-900 px-3 py-2 text-xs text-ink-200">
                      {d.admin_note}
                    </p>
                  )}
                </div>

                {d.status === 'pending' && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="mint" onClick={() => openDialog(d, 'approve')}>تأیید</Button>
                    <Button size="sm" variant="rose" onClick={() => openDialog(d, 'reject')}>رد</Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {active && (
        <Modal
          open
          title={action === 'approve' ? 'تأیید واریز' : 'رد واریز'}
          onClose={() => setActive(null)}
        >
          <p className="text-sm text-ink-200">
            کاربر <b>{active.name || active.username || active.user_id}</b> ادعا کرده{' '}
            <b className="fa-nums text-mint-400">{faUsdt(active.amount)} تتر</b> روی{' '}
            <b>{active.network}</b> واریز کرده است.
          </p>

          {action === 'approve' ? (
            <>
              <div className="mt-3 rounded-lg border border-gold-400/30 bg-gold-400/10 px-3 py-2 text-xs leading-6 text-gold-400">
                ⚠️ اول تراکنش را روی بلاک‌اکسپلورر ببینید. اگر مبلغ واقعی فرق دارد،
                همان مبلغ واقعی را اینجا بنویسید — همین عدد به حساب کاربر می‌نشیند.
              </div>
              <Input
                label="مبلغ واقعی (تتر)"
                value={credited}
                onChange={setCredited}
                ltr
                placeholder="10.00"
              />
            </>
          ) : (
            <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs leading-6 text-rose-400">
              هیچ پولی به حساب کاربر اضافه نمی‌شود. دلیل برای خود کاربر نمایش داده می‌شود.
            </div>
          )}

          <Input
            label={action === 'reject' ? 'دلیل رد (الزامی)' : 'یادداشت (اختیاری)'}
            value={note}
            onChange={setNote}
            placeholder={action === 'reject' ? 'مثلاً: تراکنشی با این شناسه پیدا نشد' : ''}
          />

          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={() => setActive(null)}>انصراف</Button>
            <Button
              variant={action === 'approve' ? 'mint' : 'rose'}
              onClick={confirm}
              disabled={busy}
            >
              {busy ? 'در حال ثبت…' : action === 'approve' ? `تأیید و واریز ${faUsdt(toMicro(credited))} تتر` : 'رد کردن'}
            </Button>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
