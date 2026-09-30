'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, fa, faUsdt, faDateTime, timeAgo, type Withdrawal } from '@/lib/adminApi';
import { Card, Button, Badge, Spinner, ErrorBox, Empty, Modal, Input, Toast } from '@/components/ui';

const STATUS: Record<string, { label: string; tone: 'gold' | 'mint' | 'rose' | 'default' }> = {
  pending: { label: 'در انتظار', tone: 'gold' },
  paid: { label: 'پرداخت شد', tone: 'mint' },
  rejected: { label: 'رد شده', tone: 'rose' }
};

function explorerAddr(network: string, addr: string) {
  if (network === 'BEP20') return `https://bscscan.com/address/${addr}`;
  return `https://tronscan.org/#/address/${addr}`;
}

export default function WithdrawalsPage() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState<Withdrawal[] | null>(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState<Withdrawal | null>(null);
  const [action, setAction] = useState<'paid' | 'reject'>('paid');
  const [txid, setTxid] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'err' } | null>(null);

  const load = () => {
    setRows(null); setError('');
    adminApi.withdrawals(status).then((d) => setRows(d.rows)).catch((e) => setError(e.message));
  };
  useEffect(load, [status]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(''), 1600);
    } catch {
      setToast({ message: 'کپی نشد — دستی انتخاب کنید', tone: 'err' });
    }
  };

  const openDialog = (w: Withdrawal, a: 'paid' | 'reject') => {
    setActive(w); setAction(a); setNote(''); setTxid('');
  };

  const confirm = async () => {
    if (!active) return;
    if (action === 'reject' && !note.trim()) {
      setToast({ message: 'دلیل رد را بنویسید', tone: 'err' }); return;
    }
    if (action === 'paid' && txid.trim().length < 32) {
      setToast({ message: 'شناسه تراکنش پرداخت را وارد کنید', tone: 'err' }); return;
    }

    setBusy(true);
    try {
      await adminApi.resolveWithdraw(active.id, action, { txid: txid.trim(), note: note.trim() });
      setToast({
        message: action === 'paid' ? 'به‌عنوان پرداخت‌شده ثبت شد' : 'رد شد و پول به بالانس کاربر برگشت',
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
    .reduce((n, r) => n + r.payout, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black">برداشت‌های تتر</h1>
          <p className="mt-1 text-xs text-ink-300">
            مبلغ هنگام ثبت درخواست از بالانس کاربر کسر شده است. «رد کردن» آن را برمی‌گرداند.
          </p>
        </div>
        <div className="flex gap-2">
          {['pending', 'paid', 'rejected', 'all'].map((s) => (
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
            <span className="text-ink-300">باید پرداخت شود: </span>
            <b className="text-sky-400">{faUsdt(pendingTotal)} تتر</b>
            <span className="text-ink-300"> در </span>
            <b>{fa((rows || []).length)}</b>
            <span className="text-ink-300"> درخواست</span>
          </div>
        </Card>
      )}

      {error && <ErrorBox message={error} onRetry={load} />}
      {!rows && !error && <Spinner />}
      {rows && rows.length === 0 && <Empty icon="📤" text="برداشتی در این وضعیت نیست" />}

      {rows && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map((w) => (
            <Card key={w.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="fa-nums text-lg font-black text-sky-400" dir="ltr">
                      {faUsdt(w.payout)} USDT
                    </span>
                    <Badge tone={STATUS[w.status].tone}>{STATUS[w.status].label}</Badge>
                    <Badge>{w.network}</Badge>
                  </div>

                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-2">
                    <div className="flex gap-2">
                      <dt className="text-ink-300">کاربر:</dt>
                      <dd className="truncate">
                        <Link href={`/admin/users/${w.user_id}`} className="hover:text-sky-400">
                          {w.name || 'بی‌نام'}
                          {w.username && <span className="text-ink-300" dir="ltr"> ({w.username})</span>}
                        </Link>
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-ink-300">کد:</dt>
                      <dd className="font-mono text-[11px]" dir="ltr">{w.id}</dd>
                    </div>
                    <div className="fa-nums flex gap-2">
                      <dt className="text-ink-300">کسرشده:</dt>
                      <dd dir="ltr">{faUsdt(w.amount)} (کارمزد {faUsdt(w.fee)})</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-ink-300">ثبت:</dt>
                      <dd className="fa-nums">{timeAgo(w.created_at)}</dd>
                    </div>
                    <div className="flex gap-2 sm:col-span-2">
                      <dt className="shrink-0 text-ink-300">آدرس:</dt>
                      <dd className="flex min-w-0 items-center gap-2">
                        <a
                          href={explorerAddr(w.network, w.address)}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="min-w-0 break-all font-mono text-[11px] text-sky-400 underline-offset-2 hover:underline"
                          dir="ltr"
                        >
                          {w.address}
                        </a>
                        <button
                          onClick={() => copy(w.address)}
                          className="shrink-0 rounded-md border border-ink-500 px-2 py-0.5 text-[10px] text-ink-300 transition hover:border-gold-400/50 hover:text-gold-400"
                        >
                          {copied === w.address ? '✓ کپی شد' : 'کپی'}
                        </button>
                      </dd>
                    </div>
                    {w.txid && (
                      <div className="flex gap-2 sm:col-span-2">
                        <dt className="shrink-0 text-ink-300">TXID پرداخت:</dt>
                        <dd className="min-w-0 break-all font-mono text-[11px]" dir="ltr">{w.txid}</dd>
                      </div>
                    )}
                    {w.handled_at && (
                      <div className="flex gap-2">
                        <dt className="text-ink-300">رسیدگی:</dt>
                        <dd className="fa-nums">{faDateTime(w.handled_at)} — {w.handled_by}</dd>
                      </div>
                    )}
                  </dl>

                  {w.admin_note && (
                    <p className="mt-2 rounded-lg border border-ink-500 bg-ink-900 px-3 py-2 text-xs text-ink-200">
                      {w.admin_note}
                    </p>
                  )}
                </div>

                {w.status === 'pending' && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="mint" onClick={() => openDialog(w, 'paid')}>پرداخت شد</Button>
                    <Button size="sm" variant="rose" onClick={() => openDialog(w, 'reject')}>رد</Button>
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
          title={action === 'paid' ? 'ثبت پرداخت' : 'رد درخواست برداشت'}
          onClose={() => setActive(null)}
        >
          {action === 'paid' ? (
            <>
              <p className="text-sm text-ink-200">
                آیا <b className="fa-nums text-sky-400">{faUsdt(active.payout)} تتر</b> را روی{' '}
                <b>{active.network}</b> به این آدرس فرستادید؟
              </p>
              <p className="mt-2 break-all rounded-lg border border-ink-500 bg-ink-900 px-3 py-2 font-mono text-[11px]" dir="ltr">
                {active.address}
              </p>
              <div className="mt-3 rounded-lg border border-gold-400/30 bg-gold-400/10 px-3 py-2 text-xs leading-6 text-gold-400">
                این کار پولی جابه‌جا نمی‌کند — فقط ثبت می‌کند که شما پرداخت را انجام داده‌اید.
                مبلغ از قبل از بالانس کاربر کسر شده است.
              </div>
              <Input label="شناسه تراکنش پرداخت (TXID)" value={txid} onChange={setTxid} ltr />
            </>
          ) : (
            <>
              <p className="text-sm text-ink-200">
                <b className="fa-nums">{faUsdt(active.amount)} تتر</b> به بالانس کاربر برمی‌گردد.
              </p>
              <div className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs leading-6 text-rose-400">
                فقط وقتی رد کنید که پول را <b>نفرستاده‌اید</b>. اگر فرستاده‌اید و رد کنید،
                کاربر هم تتر را دارد هم بالانس را.
              </div>
            </>
          )}

          <Input
            label={action === 'reject' ? 'دلیل رد (الزامی)' : 'یادداشت (اختیاری)'}
            value={note}
            onChange={setNote}
            placeholder={action === 'reject' ? 'مثلاً: آدرس نامعتبر بود' : ''}
          />

          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={() => setActive(null)}>انصراف</Button>
            <Button variant={action === 'paid' ? 'mint' : 'rose'} onClick={confirm} disabled={busy}>
              {busy ? 'در حال ثبت…' : action === 'paid' ? 'بله، پرداخت شد' : 'رد و برگشت پول'}
            </Button>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
