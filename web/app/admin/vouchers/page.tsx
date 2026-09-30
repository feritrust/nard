'use client';

import { useEffect, useState } from 'react';
import { adminApi, fa, faUsdt, toMicro, faDateTime, timeAgo, type Voucher } from '@/lib/adminApi';
import { Card, Button, Badge, Spinner, ErrorBox, Empty, Modal, Input, Toast } from '@/components/ui';

export default function VouchersPage() {
  const [filter, setFilter] = useState<'all' | 'yes' | 'no'>('no');
  const [rows, setRows] = useState<Voucher[] | null>(null);
  const [error, setError] = useState('');
  const [making, setMaking] = useState(false);
  const [amount, setAmount] = useState('10');
  const [count, setCount] = useState('1');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ codes: string[]; amount: number } | null>(null);
  const [copied, setCopied] = useState('');
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'err' } | null>(null);

  const load = () => {
    setRows(null); setError('');
    adminApi.vouchers(filter === 'all' ? undefined : filter)
      .then((d) => setRows(d.rows))
      .catch((e) => setError(e.message));
  };
  useEffect(load, [filter]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const copy = async (text: string, label = text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(''), 1600);
    } catch {
      setToast({ message: 'کپی نشد', tone: 'err' });
    }
  };

  const create = async () => {
    const micro = toMicro(amount);
    const n = parseInt(count, 10) || 0;
    if (micro <= 0) { setToast({ message: 'مبلغ درست نیست', tone: 'err' }); return; }
    if (n < 1 || n > 200) { setToast({ message: 'تعداد بین ۱ تا ۲۰۰ باشد', tone: 'err' }); return; }

    setBusy(true);
    try {
      const r = await adminApi.createVouchers(micro, n, note.trim());
      setFresh({ codes: r.codes, amount: r.amount });
      setMaking(false);
      setNote('');
      load();
    } catch (e: any) {
      setToast({ message: e.message, tone: 'err' });
    } finally {
      setBusy(false);
    }
  };

  const unused = (rows || []).filter((v) => !v.used_at);
  const unusedValue = unused.reduce((n, v) => n + v.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black">کدهای وچر</h1>
          <p className="mt-1 text-xs text-ink-300">
            هر کد یک بار مصرف است و مبلغش مستقیم به بالانس تتری کاربر می‌نشیند.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {([['no', 'استفاده‌نشده'], ['yes', 'استفاده‌شده'], ['all', 'همه']] as const).map(([k, label]) => (
            <Button key={k} size="sm" variant={filter === k ? 'gold' : 'ghost'} onClick={() => setFilter(k)}>
              {label}
            </Button>
          ))}
          <Button size="sm" variant="mint" onClick={() => setMaking(true)}>+ ساخت کد</Button>
        </div>
      </div>

      <Card>
        <div className="fa-nums flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="text-ink-300">کدهای خرج‌نشده: </span>
            <b className="text-gold-400">{fa(unused.length)}</b>
          </div>
          <div>
            <span className="text-ink-300">ارزش روی هوا: </span>
            <b className="text-gold-400">{faUsdt(unusedValue)} تتر</b>
          </div>
        </div>
        <p className="mt-2 text-[11px] leading-6 text-ink-300">
          «ارزش روی هوا» یعنی تعهدی که هنوز کسی وصولش نکرده — هر لحظه ممکن است به بالانس کاربران تبدیل شود.
        </p>
      </Card>

      {error && <ErrorBox message={error} onRetry={load} />}
      {!rows && !error && <Spinner />}
      {rows && rows.length === 0 && <Empty icon="🎟️" text="کدی در این دسته نیست" />}

      {rows && rows.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-right text-[12.5px]">
            <thead className="border-b border-ink-500 text-ink-300">
              <tr>
                <th className="px-4 py-3 font-bold">کد</th>
                <th className="px-4 py-3 font-bold">مبلغ</th>
                <th className="px-4 py-3 font-bold">وضعیت</th>
                <th className="px-4 py-3 font-bold">ساخت</th>
                <th className="px-4 py-3 font-bold">یادداشت</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.code} className="border-b border-ink-600/60 last:border-0">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => copy(v.code)}
                      className="font-mono text-[12px] tracking-wide text-ink-100 transition hover:text-gold-400"
                      dir="ltr"
                      title="کپی"
                    >
                      {copied === v.code ? '✓ کپی شد' : v.code}
                    </button>
                  </td>
                  <td className="fa-nums px-4 py-3 font-bold text-mint-400" dir="ltr">{faUsdt(v.amount)}</td>
                  <td className="px-4 py-3">
                    {v.used_at
                      ? <Badge tone="rose">خرج شد — {v.username || v.used_by}</Badge>
                      : <Badge tone="mint">آزاد</Badge>}
                  </td>
                  <td className="fa-nums whitespace-nowrap px-4 py-3 text-ink-300">
                    {timeAgo(v.created_at)}
                    {v.created_by && <span className="block text-[10.5px]">{v.created_by}</span>}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-ink-300">{v.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* ------------------------------------------------- ساخت کد */}
      {making && (
        <Modal open title="ساخت کد وچر" onClose={() => setMaking(false)}>
          <div className="rounded-lg border border-gold-400/30 bg-gold-400/10 px-3 py-2 text-xs leading-6 text-gold-400">
            ⚠️ وچر یعنی ساختن پول از هیچ. هر کدی که می‌سازید یک تعهد واقعی است
            که باید پشتش تتر داشته باشید.
          </div>

          <Input label="مبلغ هر کد (تتر)" value={amount} onChange={setAmount} ltr placeholder="10.00" />
          <Input label="تعداد کد" value={count} onChange={setCount} ltr placeholder="1" />
          <Input label="یادداشت (برای خودتان)" value={note} onChange={setNote} placeholder="مثلاً: کمپین نوروز" />

          <div className="fa-nums mt-3 rounded-lg border border-ink-500 bg-ink-900 px-3 py-2 text-sm">
            <span className="text-ink-300">ارزش کل: </span>
            <b className="text-gold-400">
              {faUsdt(toMicro(amount) * (parseInt(count, 10) || 0))} تتر
            </b>
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={() => setMaking(false)}>انصراف</Button>
            <Button variant="mint" onClick={create} disabled={busy}>
              {busy ? 'در حال ساخت…' : 'بساز'}
            </Button>
          </div>
        </Modal>
      )}

      {/* --------------------------------------- نمایش کدهای تازه */}
      {fresh && (
        <Modal open title={`${fa(fresh.codes.length)} کد ساخته شد`} onClose={() => setFresh(null)}>
          <p className="text-sm text-ink-200">
            هر کد <b className="fa-nums text-mint-400">{faUsdt(fresh.amount)} تتر</b> ارزش دارد.
            کدها را از همین جدول هم بعداً می‌بینید.
          </p>
          <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-ink-500 bg-ink-900 p-3">
            <pre className="font-mono text-[12px] leading-7" dir="ltr">{fresh.codes.join('\n')}</pre>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="gold" onClick={() => copy(fresh.codes.join('\n'), 'all')}>
              {copied === 'all' ? '✓ کپی شد' : 'کپی همه'}
            </Button>
            <Button variant="ghost" onClick={() => setFresh(null)}>بستن</Button>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  );
}
