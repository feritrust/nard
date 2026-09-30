'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import {
  adminApi, fa, faDateTime, timeAgo, TX_LABEL, type UserDetail
} from '@/lib/adminApi';
import { Card, Button, Input, Badge, Spinner, ErrorBox, Modal, Toast, Stat } from '@/components/ui';

export default function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<UserDetail | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'err' } | null>(null);
  const [tab, setTab] = useState<'tx' | 'games' | 'claims'>('tx');

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [coins, setCoins] = useState('');
  const [energy, setEnergy] = useState('');
  const [reason, setReason] = useState('');

  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError('');
    adminApi.user(id).then(setD).catch((e) => setError(e.message));
  };
  useEffect(load, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const doAdjust = async () => {
    const c = parseInt(coins.replace(/[^\d-]/g, '') || '0', 10);
    const e = parseInt(energy.replace(/[^\d-]/g, '') || '0', 10);
    if (!c && !e) { setToast({ message: 'مقدار را وارد کنید', tone: 'err' }); return; }
    if (!reason.trim()) { setToast({ message: 'دلیل را بنویسید', tone: 'err' }); return; }
    setBusy(true);
    try {
      await adminApi.adjust(id, c, e, reason.trim());
      setToast({ message: 'موجودی اصلاح شد', tone: 'ok' });
      setAdjustOpen(false); setCoins(''); setEnergy(''); setReason('');
      load();
    } catch (err) {
      setToast({ message: (err as Error).message, tone: 'err' });
    }
    setBusy(false);
  };

  const doBan = async () => {
    if (!d) return;
    const next = !d.user.banned;
    if (next && !banReason.trim()) { setToast({ message: 'دلیل مسدودسازی را بنویسید', tone: 'err' }); return; }
    setBusy(true);
    try {
      await adminApi.ban(id, next, banReason.trim());
      setToast({ message: next ? 'کاربر مسدود شد' : 'مسدودی برداشته شد', tone: 'ok' });
      setBanOpen(false); setBanReason('');
      load();
    } catch (err) {
      setToast({ message: (err as Error).message, tone: 'err' });
    }
    setBusy(false);
  };

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!d) return <Spinner />;

  const u = d.user;
  const winRate = u.games ? Math.round((u.wins / u.games) * 100) : 0;

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      <Link href="/admin/users" className="inline-block text-xs text-ink-300 transition hover:text-ink-100">
        → بازگشت به کاربران
      </Link>

      {/* ----------------------------------------------------- سربرگ */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start gap-5">
          <div className="grid size-16 shrink-0 place-items-center rounded-2xl border-2 border-ink-500 bg-ink-900 text-3xl">
            {u.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black">{u.name || 'بی‌نام'}</h1>
              {u.banned ? <Badge tone="rose">مسدود</Badge>
                : u.isGuest ? <Badge>مهمان</Badge>
                : <Badge tone="mint">تأییدشده</Badge>}
            </div>
            <dl className="fa-nums mt-3 grid gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex gap-2"><dt className="text-ink-300">شناسه:</dt><dd className="truncate font-mono text-[11px]" dir="ltr">{u.id}</dd></div>
              {u.username && <div className="flex gap-2"><dt className="text-ink-300">نام کاربری:</dt><dd dir="ltr">{u.username}</dd></div>}
              <div className="flex gap-2"><dt className="text-ink-300">بالانس:</dt><dd className="font-bold text-mint-400" dir="ltr">{u.balanceUsdt} USDT</dd></div>
              {u.telegramId && <div className="flex gap-2"><dt className="text-ink-300">تلگرام:</dt><dd dir="ltr">{u.telegramId}</dd></div>}
              <div className="flex gap-2"><dt className="text-ink-300">کد معرف:</dt><dd dir="ltr">{u.referralCode}</dd></div>
              {u.referredBy && <div className="flex gap-2"><dt className="text-ink-300">معرف او:</dt><dd dir="ltr">{u.referredBy}</dd></div>}
              <div className="flex gap-2"><dt className="text-ink-300">دعوت‌شده‌ها:</dt><dd>{fa(u.invitedCount)}</dd></div>
              <div className="flex gap-2"><dt className="text-ink-300">عضویت:</dt><dd>{faDateTime(u.createdAt)}</dd></div>
              <div className="flex gap-2"><dt className="text-ink-300">آخرین فعالیت:</dt><dd>{timeAgo(u.lastSeen)}</dd></div>
              {u.lastIp && <div className="flex gap-2"><dt className="text-ink-300">IP:</dt><dd dir="ltr">{u.lastIp}</dd></div>}
            </dl>
            {u.banned && u.banReason && (
              <p className="mt-3 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-400">
                دلیل مسدودی: {u.banReason}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="gold" size="sm" onClick={() => setAdjustOpen(true)}>اصلاح موجودی</Button>
            <Button variant={u.banned ? 'mint' : 'rose'} size="sm" onClick={() => setBanOpen(true)}>
              {u.banned ? 'رفع مسدودی' : 'مسدود کردن'}
            </Button>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------- آمار */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon="🪙" label="سکه" value={fa(u.coins)} tone="gold" />
        <Stat icon="⚡" label="انرژی" value={fa(u.energy)} tone="sky" />
        <Stat icon="🏅" label="سطح" value={fa(u.level)} sub={`${fa(d.level.xp)} از ${fa(d.level.need)} امتیاز`} tone="violet" />
        <Stat icon="🎲" label="بازی" value={fa(u.games)} sub={`${fa(u.wins)} برد • ${fa(winRate)}٪`} tone="mint" />
      </div>

      {/* ---------------------------------------- حساب‌های هم‌آی‌پی */}
      {d.sameIp.length > 0 && (
        <Card className="border-rose-400/40 p-5">
          <h2 className="text-sm font-extrabold text-rose-400">
            ⚠️ {fa(d.sameIp.length)} حساب دیگر با همین IP
          </h2>
          <p className="mt-1 text-[11.5px] text-ink-300">
            می‌تواند خانواده یا اینترنت مشترک باشد — ولی ارزش بررسی دارد.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {d.sameIp.map((o) => (
              <Link
                key={o.id}
                href={`/admin/users/${o.id}`}
                className="fa-nums rounded-lg border border-ink-500 bg-ink-900 px-3 py-1.5 text-xs transition hover:border-rose-400/50"
              >
                {o.name || 'بی‌نام'} <span className="text-gold-400">{fa(o.coins)}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* -------------------------------------------------------- تب‌ها */}
      <div className="flex gap-2">
        {[
          { v: 'tx', l: `تراکنش‌ها (${fa(d.transactions.length)})` },
          { v: 'games', l: `بازی‌ها (${fa(d.games.length)})` },
          { v: 'claims', l: `درخواست‌ها (${fa(d.claims.length)})` }
        ].map((t) => (
          <Button key={t.v} size="sm" variant={tab === t.v ? 'gold' : 'ghost'} onClick={() => setTab(t.v as any)}>
            {t.l}
          </Button>
        ))}
      </div>

      <Card className="overflow-x-auto">
        {tab === 'tx' && (
          <table className="w-full min-w-[620px] text-right text-sm">
            <thead className="border-b border-ink-500 bg-ink-800/60 text-xs text-ink-300">
              <tr>
                <th className="px-4 py-3 font-bold">نوع</th>
                <th className="px-4 py-3 font-bold">توضیح</th>
                <th className="px-4 py-3 font-bold">سکه</th>
                <th className="px-4 py-3 font-bold">انرژی</th>
                <th className="px-4 py-3 font-bold">موجودی بعد</th>
                <th className="px-4 py-3 font-bold">زمان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-500/60">
              {d.transactions.map((t) => (
                <tr key={t.id} className="hover:bg-ink-800/40">
                  <td className="px-4 py-2.5"><Badge>{TX_LABEL[t.type] || t.type}</Badge></td>
                  <td className="max-w-[240px] truncate px-4 py-2.5 text-[12px] text-ink-300">{t.note}</td>
                  <td className={`fa-nums px-4 py-2.5 font-bold ${t.coins > 0 ? 'text-mint-300' : t.coins < 0 ? 'text-rose-400' : 'text-ink-300'}`}>
                    {t.coins ? (t.coins > 0 ? '+' : '−') + fa(Math.abs(t.coins)) : '—'}
                  </td>
                  <td className={`fa-nums px-4 py-2.5 ${t.energy > 0 ? 'text-energy-400' : t.energy < 0 ? 'text-rose-400' : 'text-ink-300'}`}>
                    {t.energy ? (t.energy > 0 ? '+' : '−') + fa(Math.abs(t.energy)) : '—'}
                  </td>
                  <td className="fa-nums px-4 py-2.5 text-[12px] text-ink-300">{fa(t.coins_after)}</td>
                  <td className="fa-nums px-4 py-2.5 text-[11.5px] text-ink-300">{timeAgo(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'games' && (
          <table className="w-full min-w-[560px] text-right text-sm">
            <thead className="border-b border-ink-500 bg-ink-800/60 text-xs text-ink-300">
              <tr>
                <th className="px-4 py-3 font-bold">اتاق</th>
                <th className="px-4 py-3 font-bold">ورودی</th>
                <th className="px-4 py-3 font-bold">نتیجه</th>
                <th className="px-4 py-3 font-bold">حریف</th>
                <th className="px-4 py-3 font-bold">زمان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-500/60">
              {d.games.map((g) => {
                const won = g.winner_id === u.id;
                const oppId = g.p1_id === u.id ? g.p2_id : g.p1_id;
                return (
                  <tr key={g.id} className="hover:bg-ink-800/40">
                    <td className="px-4 py-2.5 text-[12px]">{g.room_id}</td>
                    <td className="fa-nums px-4 py-2.5">{fa(g.entry)}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={won ? 'mint' : 'rose'}>
                        {won ? 'برد' : 'باخت'}{g.result >= 2 ? (g.result === 3 ? ' (توله‌مارس)' : ' (مارس)') : ''}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-[12px]">
                      {g.vs_bot ? <span className="text-ink-300">ربات</span>
                        : oppId ? <Link href={`/admin/users/${oppId}`} className="text-sky-400 hover:underline">
                            {g.p1_id === u.id ? g.p2_name : g.p1_name}
                          </Link>
                        : '—'}
                    </td>
                    <td className="fa-nums px-4 py-2.5 text-[11.5px] text-ink-300">{timeAgo(g.ended_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === 'claims' && (
          <table className="w-full min-w-[520px] text-right text-sm">
            <thead className="border-b border-ink-500 bg-ink-800/60 text-xs text-ink-300">
              <tr>
                <th className="px-4 py-3 font-bold">نوع</th>
                <th className="px-4 py-3 font-bold">مقدار</th>
                <th className="px-4 py-3 font-bold">وضعیت</th>
                <th className="px-4 py-3 font-bold">زمان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-500/60">
              {d.claims.map((c) => (
                <tr key={c.id} className="hover:bg-ink-800/40">
                  <td className="px-4 py-2.5">
                    <Badge tone={c.kind === 'sell' ? 'sky' : 'violet'}>{c.kind === 'sell' ? 'فروش' : 'جایزه'}</Badge>
                  </td>
                  <td className="fa-nums px-4 py-2.5 text-[12px]">
                    {c.kind === 'sell' ? `${fa(c.amount)} سکه → ${fa(c.toman)} ت` : c.prize_name}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={c.status === 'pending' ? 'gold' : c.status === 'approved' ? 'mint' : 'rose'}>
                      {c.status === 'pending' ? 'در انتظار' : c.status === 'approved' ? 'تأیید' : 'رد'}
                    </Badge>
                  </td>
                  <td className="fa-nums px-4 py-2.5 text-[11.5px] text-ink-300">{timeAgo(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {((tab === 'tx' && !d.transactions.length) ||
          (tab === 'games' && !d.games.length) ||
          (tab === 'claims' && !d.claims.length)) && (
          <p className="py-12 text-center text-sm text-ink-300">موردی ثبت نشده</p>
        )}
      </Card>

      {/* --------------------------------------------- اصلاح موجودی */}
      <Modal open={adjustOpen} onClose={() => setAdjustOpen(false)} title="اصلاح دستی موجودی">
        <p className="text-[12.5px] leading-7 text-ink-300">
          عدد مثبت اضافه و عدد منفی کم می‌کند. این کار در تراکنش‌های کاربر و گزارش فعالیت ادمین ثبت می‌شود.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-xs text-ink-300">سکه (مثلاً ۵۰۰۰ یا ‎-۵۰۰۰‎)</label>
            <Input value={coins} onChange={setCoins} ltr placeholder="0" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-ink-300">انرژی</label>
            <Input value={energy} onChange={setEnergy} ltr placeholder="0" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-ink-300">دلیل <span className="text-rose-400">(اجباری)</span></label>
            <Input value={reason} onChange={setReason} placeholder="مثلاً: جبران باگ در بازی ۱۲۳" />
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" onClick={() => setAdjustOpen(false)} className="flex-1">انصراف</Button>
          <Button variant="gold" onClick={doAdjust} disabled={busy} className="flex-1">
            {busy ? 'صبر کنید…' : 'اعمال'}
          </Button>
        </div>
      </Modal>

      {/* ------------------------------------------------- مسدودسازی */}
      <Modal open={banOpen} onClose={() => setBanOpen(false)} title={u.banned ? 'رفع مسدودی' : 'مسدود کردن کاربر'}>
        {u.banned ? (
          <p className="text-sm leading-7 text-ink-300">
            با رفع مسدودی، کاربر دوباره می‌تواند وارد شود و بازی کند.
          </p>
        ) : (
          <>
            <p className="text-sm leading-7 text-ink-300">
              کاربر مسدود نمی‌تواند وارد شود، بازی کند یا درخواست بدهد. سکه‌هایش دست‌نخورده می‌ماند.
            </p>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs text-ink-300">دلیل <span className="text-rose-400">(اجباری)</span></label>
              <Input value={banReason} onChange={setBanReason} placeholder="مثلاً: تبانی با حساب دیگر" />
            </div>
          </>
        )}
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" onClick={() => setBanOpen(false)} className="flex-1">انصراف</Button>
          <Button variant={u.banned ? 'mint' : 'rose'} onClick={doBan} disabled={busy} className="flex-1">
            {busy ? 'صبر کنید…' : u.banned ? 'رفع مسدودی' : 'مسدود کن'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
