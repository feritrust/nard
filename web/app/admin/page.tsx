'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, fa, faUsdt, type Stats, type ChartPoint } from '@/lib/adminApi';
import { Card, Stat, BarChart, Spinner, ErrorBox, Badge } from '@/components/ui';

export default function Dashboard() {
  const [data, setData] = useState<{ stats: Stats; chart: ChartPoint[] } | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    adminApi.stats(14).then(setData).catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);   // هر ۳۰ ثانیه تازه می‌شود
    return () => clearInterval(t);
  }, []);

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <Spinner />;

  const { stats: s, chart } = data;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">داشبورد</h1>
          <p className="mt-1 text-xs text-ink-300">آمار هر ۳۰ ثانیه به‌روز می‌شود</p>
        </div>
        {s.games.live > 0 && (
          <Badge tone="mint">🎮 {fa(s.games.live)} بازی در جریان</Badge>
        )}
      </div>

      {/* ------------------------------------------ کارهای در انتظار */}
      {(s.pending.claims > 0 || s.pending.fraud > 0) && (
        <Card className="border-gold-400/40 p-5">
          <h2 className="text-sm font-extrabold text-gold-400">کارهای در انتظار شما</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {s.pending.claims > 0 && (
              <Link
                href="/admin/claims"
                className="rounded-xl border border-ink-500 bg-ink-900 px-4 py-3 text-sm transition hover:border-gold-400/50"
              >
                <div className="fa-nums font-black text-gold-400">{fa(s.pending.claims)} درخواست جایزه</div>
                <div className="fa-nums mt-1 text-[11px] text-ink-300">نیاز به رسیدگی</div>
              </Link>
            )}
            {s.pending.deposits > 0 && (
              <Link
                href="/admin/deposits"
                className="rounded-xl border border-mint-400/40 bg-mint-400/10 px-4 py-3 text-sm transition hover:bg-mint-400/20"
              >
                <div className="fa-nums font-black text-mint-400">{fa(s.pending.deposits)} واریز</div>
                <div className="fa-nums mt-1 text-[11px] text-ink-300">
                  {faUsdt(s.pending.depositsAmount)} تتر در انتظار تأیید
                </div>
              </Link>
            )}
            {s.pending.withdrawals > 0 && (
              <Link
                href="/admin/withdrawals"
                className="rounded-xl border border-sky-400/40 bg-sky-400/10 px-4 py-3 text-sm transition hover:bg-sky-400/20"
              >
                <div className="fa-nums font-black text-sky-400">{fa(s.pending.withdrawals)} برداشت</div>
                <div className="fa-nums mt-1 text-[11px] text-ink-300">
                  {faUsdt(s.pending.withdrawalsAmount)} تتر در انتظار پرداخت
                </div>
              </Link>
            )}
            {s.pending.fraud > 0 && (
              <Link
                href="/admin/fraud"
                className="rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-sm transition hover:bg-rose-400/20"
              >
                <div className="fa-nums font-black text-rose-400">{fa(s.pending.fraud)} مورد مشکوک</div>
                <div className="mt-1 text-[11px] text-ink-300">نیاز به بررسی</div>
              </Link>
            )}
          </div>
        </Card>
      )}

      {/* ----------------------------------------------------- کاربران */}
      <section>
        <h2 className="mb-3 text-sm font-extrabold text-ink-300">کاربران</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon="👥" label="کل کاربران" value={fa(s.users.total)} sub={`${fa(s.users.verified)} تأییدشده`} />
          <Stat icon="🆕" label="عضو امروز" value={fa(s.users.today)} sub={`${fa(s.users.week)} در هفته`} tone="mint" />
          <Stat icon="🟢" label="فعال ۲۴ ساعت" value={fa(s.users.active24h)} tone="sky" />
          <Stat icon="🚫" label="مسدود" value={fa(s.users.banned)} tone={s.users.banned ? 'rose' : 'default'} />
        </div>
      </section>

      {/* ------------------------------------------------------- اقتصاد */}
      <section>
        <h2 className="mb-3 text-sm font-extrabold text-ink-300">اقتصاد</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon="🪙" label="فی امروز" value={fa(s.economy.rakeToday)} sub={`${fa(s.economy.rakeWeek)} در هفته`} tone="gold" />
          <Stat icon="💰" label="فی کل" value={fa(s.economy.rakeTotal)} tone="gold" />
          <Stat icon="🌐" label="سکه در گردش" value={fa(s.economy.coinsInCirculation)} sub={`${fa(s.economy.energyInCirculation)} انرژی`} tone="violet" />
          <Stat icon="🔄" label="خرید/فروش امروز" value={fa(s.economy.coinsBoughtToday)} sub={`${fa(s.economy.coinsSoldToday)} سکه فروخته شد`} tone="sky" />
        </div>
      </section>

      {/* -------------------------------------------------------- تتر */}
      <section>
        <h2 className="mb-3 text-sm font-extrabold text-ink-300">تتر</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon="💵" label="واریز امروز" value={faUsdt(s.economy.depositedToday)} sub={`کل: ${faUsdt(s.economy.depositedTotal)}`} tone="mint" />
          <Stat icon="🎟️" label="وچرهای استفاده‌شده" value={faUsdt(s.economy.vouchersTotal)} tone="gold" />
          <Stat icon="📤" label="برداشت‌شده" value={faUsdt(s.economy.withdrawnTotal)} tone="sky" />
          <Stat
            icon="🏦"
            label="بالانس نزد کاربران"
            value={faUsdt(s.economy.balanceHeld)}
            sub="بدهی شما به کاربران"
            tone="violet"
          />
        </div>
      </section>

      {/* -------------------------------------------------------- بازی‌ها */}
      <section>
        <h2 className="mb-3 text-sm font-extrabold text-ink-300">بازی‌ها</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon="🎲" label="بازی امروز" value={fa(s.games.today)} sub={`${fa(s.games.vsBot)} با ربات`} tone="sky" />
          <Stat icon="📈" label="کل بازی‌ها" value={fa(s.games.total)} />
          <Stat icon="⚡" label="در جریان" value={fa(s.games.live)} tone="mint" />
          <Stat
            icon="🤖"
            label="سهم ربات امروز"
            value={s.games.today ? Math.round((s.games.vsBot / s.games.today) * 100).toLocaleString('fa-IR') + '٪' : '—'}
            sub="هرچه کمتر، بازیکن واقعی بیشتر"
          />
        </div>
      </section>

      {/* -------------------------------------------------------- نمودار */}
      <section className="grid gap-4 lg:grid-cols-2">
        <BarChart label="کاربران جدید — ۱۴ روز" data={chart.map((c) => ({ date: c.date, value: c.users }))} color="var(--color-mint-400)" />
        <BarChart label="بازی‌ها — ۱۴ روز" data={chart.map((c) => ({ date: c.date, value: c.games }))} color="var(--color-sky-400)" />
        <BarChart label="فی دریافتی (سکه) — ۱۴ روز" data={chart.map((c) => ({ date: c.date, value: c.rake }))} color="var(--color-gold-400)" />
        <BarChart
          label="درآمد فروش سکه — ۱۴ روز"
          data={chart.map((c) => ({ date: c.date, value: c.revenue }))}
          color="var(--color-violet-400)"
          format={(n) => n.toLocaleString('fa-IR') + ' ت'}
        />
      </section>
    </div>
  );
}
