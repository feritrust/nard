'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { adminApi, getToken, setToken, fa } from '@/lib/adminApi';
import { Toast } from '@/components/ui';

const NAV = [
  { href: '/admin',          label: 'داشبورد',      icon: '📊' },
  { href: '/admin/claims',   label: 'درخواست‌ها',   icon: '💳', badge: 'claims' },
  { href: '/admin/users',    label: 'کاربران',      icon: '👥' },
  { href: '/admin/fraud',    label: 'تقلب',         icon: '🚨', badge: 'fraud' },
  { href: '/admin/games',    label: 'بازی‌ها',      icon: '🎲' },
  { href: '/admin/settings', label: 'تنظیمات',      icon: '⚙️' },
  { href: '/admin/log',      label: 'گزارش فعالیت', icon: '📜' }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/admin/login';

  const [admin, setAdmin] = useState<{ username: string; role: string } | null>(null);
  const [checked, setChecked] = useState(false);
  const [badges, setBadges] = useState({ claims: 0, fraud: 0 });
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'err' } | null>(null);

  const refreshBadges = useCallback(async () => {
    try {
      const d = await adminApi.stats(1);
      setBadges({ claims: d.stats.pending.claims, fraud: d.stats.pending.fraud });
    } catch {}
  }, []);

  useEffect(() => {
    if (isLogin) { setChecked(true); return; }
    if (!getToken()) { router.replace('/admin/login'); return; }
    adminApi.me()
      .then((d) => { setAdmin(d.admin); setChecked(true); refreshBadges(); })
      .catch(() => { setChecked(true); });
  }, [isLogin, router, refreshBadges]);

  // هر ۶۰ ثانیه نشان‌های کنار منو تازه می‌شوند
  useEffect(() => {
    if (isLogin || !admin) return;
    const t = setInterval(refreshBadges, 60000);
    return () => clearInterval(t);
  }, [isLogin, admin, refreshBadges]);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  if (isLogin) return <>{children}</>;

  if (!checked) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-[3px] border-ink-500 border-t-gold-400" />
      </div>
    );
  }

  const logout = async () => {
    try { await adminApi.logout(); } catch {}
    setToken(null);
    router.replace('/admin/login');
  };

  return (
    <div className="min-h-dvh lg:flex">
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      {/* ---------------------------------------- نوار بالا (موبایل) */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-ink-500 bg-ink-900/90 px-4 py-3 backdrop-blur lg:hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="grid size-9 place-items-center rounded-xl border border-ink-500 bg-ink-700 text-lg"
          aria-label="منو"
        >
          ☰
        </button>
        <span className="font-black">پنل مدیریت</span>
        {(badges.claims > 0 || badges.fraud > 0) && (
          <span className="fa-nums mr-auto rounded-full bg-rose-400 px-2 py-0.5 text-[11px] font-black text-white">
            {fa(badges.claims + badges.fraud)}
          </span>
        )}
      </header>

      {/* ------------------------------------------------ منوی کناری */}
      <aside
        className={`${open ? 'block' : 'hidden'} border-b border-ink-500 bg-ink-800 lg:sticky lg:top-0 lg:block lg:h-dvh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-l`}
      >
        <div className="flex h-full flex-col p-4">
          <Link href="/admin" className="mb-6 hidden items-center gap-2.5 px-2 font-black lg:flex">
            <span className="text-2xl">🎲</span>
            <span className="bg-gradient-to-l from-gold-400 to-gold-300 bg-clip-text text-transparent">پنل مدیریت</span>
          </Link>

          <nav className="space-y-1">
            {NAV.map((n) => {
              const active = pathname === n.href || (n.href !== '/admin' && pathname.startsWith(n.href));
              const count = n.badge === 'claims' ? badges.claims : n.badge === 'fraud' ? badges.fraud : 0;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                    active ? 'bg-gold-400/12 text-gold-400' : 'text-ink-300 hover:bg-ink-700 hover:text-ink-100'
                  }`}
                >
                  <span className="text-base">{n.icon}</span>
                  <span>{n.label}</span>
                  {count > 0 && (
                    <span className="fa-nums mr-auto rounded-full bg-rose-400 px-1.5 py-0.5 text-[10px] font-black text-white">
                      {fa(count)}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3 pt-6">
            <Link href="/" className="block px-3 text-xs text-ink-300 transition hover:text-ink-100">
              ← مشاهده‌ی سایت
            </Link>
            <div className="rounded-xl border border-ink-500 bg-ink-900 p-3">
              <div className="truncate text-xs font-bold">{admin?.username}</div>
              <div className="mt-0.5 text-[11px] text-ink-300">
                {admin?.role === 'owner' ? 'مالک' : 'ادمین'}
              </div>
              <button
                onClick={logout}
                className="mt-2.5 w-full rounded-lg border border-rose-400/40 bg-rose-400/10 py-1.5 text-[11px] font-bold text-rose-400 transition hover:bg-rose-400/20"
              >
                خروج
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ---------------------------------------------------- محتوا */}
      <main className="min-w-0 flex-1 p-4 md:p-7">{children}</main>
    </div>
  );
}
