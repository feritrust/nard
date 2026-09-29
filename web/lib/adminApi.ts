'use client';

/**
 * adminApi.ts — ارتباط پنل با سرور بازی
 *
 * پنل هیچ‌وقت مستقیم به دیتابیس وصل نمی‌شود؛ همه‌چیز از API سرور می‌آید.
 * برای همین می‌توانید پنل را هرجا (حتی Vercel) هاست کنید.
 */

import { api } from './site';

const TOKEN_KEY = 'nard_admin_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(t: string | null) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T = any>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(api.base + path, {
      method: opts.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store'
    });
  } catch {
    throw new ApiError('به سرور بازی وصل نشدیم. مطمئن شوید سرور در حال اجراست.', 0);
  }

  let data: any = {};
  try { data = await res.json(); } catch {}

  if (res.status === 401) {
    setToken(null);
    if (typeof window !== 'undefined' && !location.pathname.endsWith('/admin/login')) {
      location.href = '/admin/login';
    }
    throw new ApiError(data.message || 'وارد نشده‌اید', 401);
  }
  if (!res.ok || data.ok === false) {
    throw new ApiError(data.message || 'خطایی رخ داد', res.status);
  }
  return data as T;
}

export const adminApi = {
  login: (username: string, password: string, totp?: string) =>
    call<{ ok: boolean; token: string; admin: { username: string; role: string }; setupTotp: { secret: string; uri: string } | null; needTotp?: boolean }>(
      '/admin/login', { method: 'POST', body: { username, password, totp } }
    ),
  me: () => call<{ admin: { username: string; role: string } }>('/admin/me'),
  logout: () => call('/admin/logout', { method: 'POST' }),
  enableTotp: (code: string) => call('/admin/totp/enable', { method: 'POST', body: { code } }),

  stats: (days = 14) => call<{ stats: Stats; chart: ChartPoint[] }>(`/admin/stats?days=${days}`),

  users: (p: { q?: string; sort?: string; dir?: string; limit?: number; offset?: number; banned?: string }) => {
    const s = new URLSearchParams();
    Object.entries(p).forEach(([k, v]) => { if (v !== undefined && v !== '') s.set(k, String(v)); });
    return call<{ rows: AdminUser[]; total: number }>(`/admin/users?${s}`);
  },
  user: (id: string) => call<UserDetail>(`/admin/user?id=${encodeURIComponent(id)}`),
  ban: (id: string, banned: boolean, reason?: string) =>
    call('/admin/user/ban', { method: 'POST', body: { id, banned, reason } }),
  adjust: (id: string, coins: number, energy: number, reason: string) =>
    call<{ user: AdminUser }>('/admin/user/adjust', { method: 'POST', body: { id, coins, energy, reason } }),
  note: (id: string, note: string) => call('/admin/user/note', { method: 'POST', body: { id, note } }),

  claims: (status = 'pending', kind?: string) =>
    call<{ rows: Claim[]; total: number }>(`/admin/claims?status=${status}${kind ? `&kind=${kind}` : ''}&limit=100`),
  resolveClaim: (id: string, action: 'approve' | 'reject', note?: string) =>
    call('/admin/claim/resolve', { method: 'POST', body: { id, action, note } }),

  fraud: (resolved = false) => call<{ rows: FraudFlag[] }>(`/admin/fraud?resolved=${resolved ? 1 : 0}&limit=100`),
  resolveFraud: (id: number) => call('/admin/fraud/resolve', { method: 'POST', body: { id } }),

  games: (limit = 50) => call<{ rows: Game[] }>(`/admin/games?limit=${limit}`),
  settings: () => call<{ settings: Record<string, any>; defaults: Record<string, any> }>('/admin/settings'),
  saveSettings: (settings: Record<string, any>) =>
    call<{ settings: Record<string, any>; changed: string[] }>('/admin/settings/save', { method: 'POST', body: { settings } }),
  log: (limit = 100) => call<{ rows: AdminLog[] }>(`/admin/log?limit=${limit}`)
};

/* ------------------------------------------------------------ انواع */

export type Stats = {
  users: { total: number; today: number; week: number; active24h: number; verified: number; banned: number };
  games: { total: number; today: number; vsBot: number; live: number };
  economy: {
    coinsInCirculation: number; energyInCirculation: number;
    rakeToday: number; rakeTotal: number; rakeWeek: number;
    purchasedToday: number; purchasedTotal: number;
  };
  pending: { claims: number; sell: number; prize: number; sellToman: number; fraud: number };
};

export type ChartPoint = { date: string; users: number; games: number; rake: number; revenue: number };

export type AdminUser = {
  id: string; name: string; phone: string | null; telegramId: string | null; avatar: string;
  coins: number; energy: number; level: number; xp: number;
  games: number; wins: number; losses: number;
  isGuest: boolean; banned: boolean; banReason: string | null;
  referralCode: string; referredBy: string | null; invitedCount: number;
  note: string | null; lastIp: string | null; createdAt: number; lastSeen: number;
};

export type Tx = {
  id: number; type: string; coins: number; energy: number;
  coins_after: number; energy_after: number; note: string; created_at: number;
};

export type Game = {
  id: string; room_id: string; entry: number; winner_id: string | null; result: number;
  rake: number; prize: number; vs_bot: number; end_reason: string;
  started_at: number; ended_at: number; p1_name?: string; p2_name?: string;
  p1_id: string | null; p2_id: string | null;
};

export type Claim = {
  id: string; user_id: string; kind: 'sell' | 'prize'; status: string;
  amount: number; toman: number; energy: number; dest: string | null;
  prize_name: string | null; contact: string | null;
  created_at: number; handled_at: number | null; handled_by: string | null; admin_note: string | null;
  user_name: string; user_phone: string | null; user_coins: number; user_banned: number;
};

export type FraudFlag = {
  id: number; kind: string; user_id: string | null; other_id: string | null;
  score: number; detail: string; resolved: number; created_at: number;
  user_name: string | null; other_name: string | null;
};

export type AdminLog = {
  id: number; username: string | null; action: string; target: string | null;
  detail: string | null; ip: string | null; created_at: number;
};

export type UserDetail = {
  user: AdminUser;
  level: { level: number; xp: number; need: number };
  transactions: Tx[];
  games: Game[];
  claims: Claim[];
  sameIp: { id: string; name: string; coins: number; created_at: number }[];
};

/* ---------------------------------------------------------- کمکی‌ها */

export const fa = (n: number | null | undefined) => Number(n || 0).toLocaleString('fa-IR');

export const faDate = (ts: number | null | undefined) => {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return '—'; }
};

export const faDateTime = (ts: number | null | undefined) => {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('fa-IR', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch { return '—'; }
};

export const timeAgo = (ts: number | null | undefined) => {
  if (!ts) return '—';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'همین الان';
  if (s < 3600) return `${fa(Math.floor(s / 60))} دقیقه پیش`;
  if (s < 86400) return `${fa(Math.floor(s / 3600))} ساعت پیش`;
  if (s < 2592000) return `${fa(Math.floor(s / 86400))} روز پیش`;
  return faDate(ts);
};

export const TX_LABEL: Record<string, string> = {
  welcome: 'هدیه‌ی خوش‌آمد', daily: 'هدیه‌ی روزانه', stake: 'ورودی اتاق',
  win: 'برد', lose: 'باخت', refund: 'بازگشت ورودی', purchase: 'خرید سکه',
  sell: 'فروش سکه', prize: 'جایزه', skin: 'پوسته', referral: 'دعوت دوستان', admin: 'اصلاح ادمین'
};

export const FRAUD_LABEL: Record<string, string> = {
  collusion: 'تبانی',
  multi_account: 'چند حساب',
  referral_abuse: 'سوءاستفاده از کد معرف',
  fast_drain: 'تخلیه‌ی سریع موجودی'
};

export const ACTION_LABEL: Record<string, string> = {
  login: 'ورود', logout: 'خروج', login_failed: 'ورود ناموفق',
  ban: 'مسدود کردن', unban: 'رفع مسدودی', adjust: 'اصلاح موجودی',
  note: 'یادداشت', claim_approve: 'تأیید درخواست', claim_reject: 'رد درخواست',
  fraud_resolved: 'بستن پرچم تقلب', settings: 'تغییر تنظیمات', totp_enabled: 'فعال‌سازی دو مرحله‌ای'
};
