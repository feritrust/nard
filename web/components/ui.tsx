'use client';

import { ReactNode } from 'react';

/* =====================================================================
 *  اجزای مشترک پنل
 * ===================================================================== */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-ink-500 bg-gradient-to-br from-ink-700 to-ink-600 ${className}`}>
      {children}
    </div>
  );
}

export function Stat({
  label, value, sub, tone = 'default', icon
}: {
  label: string; value: string; sub?: string;
  tone?: 'default' | 'gold' | 'mint' | 'rose' | 'sky' | 'violet';
  icon?: string;
}) {
  const tones = {
    default: 'text-ink-100',
    gold: 'text-gold-400',
    mint: 'text-mint-400',
    rose: 'text-rose-400',
    sky: 'text-sky-400',
    violet: 'text-violet-400'
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-ink-300">{label}</div>
          <div className={`fa-nums mt-2 truncate text-2xl font-black ${tones[tone]}`}>{value}</div>
          {sub && <div className="fa-nums mt-1 text-[11px] text-ink-300">{sub}</div>}
        </div>
        {icon && <div className="shrink-0 text-2xl opacity-80">{icon}</div>}
      </div>
    </Card>
  );
}

export function Button({
  children, onClick, variant = 'default', size = 'md', disabled, type = 'button', className = ''
}: {
  children: ReactNode; onClick?: () => void;
  variant?: 'default' | 'gold' | 'mint' | 'rose' | 'sky' | 'ghost';
  size?: 'sm' | 'md'; disabled?: boolean; type?: 'button' | 'submit'; className?: string;
}) {
  const variants = {
    default: 'bg-ink-600 border-ink-500 text-ink-100 hover:bg-ink-500',
    gold: 'bg-gradient-to-l from-gold-400 to-gold-500 border-transparent text-[#2a1e04] hover:brightness-110',
    mint: 'bg-mint-400/15 border-mint-400/40 text-mint-300 hover:bg-mint-400/25',
    rose: 'bg-rose-400/15 border-rose-400/40 text-rose-400 hover:bg-rose-400/25',
    sky: 'bg-sky-400/15 border-sky-400/40 text-sky-400 hover:bg-sky-400/25',
    ghost: 'bg-transparent border-ink-500 text-ink-300 hover:bg-ink-700 hover:text-ink-100'
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm' };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border font-bold transition disabled:pointer-events-none disabled:opacity-45 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({
  value, onChange, placeholder, type = 'text', ltr, className = '', onKeyDown,
  autoFocus, maxLength, label, hint
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
  ltr?: boolean; className?: string; onKeyDown?: (e: React.KeyboardEvent) => void;
  autoFocus?: boolean; maxLength?: number; label?: string; hint?: string;
}) {
  const field = (
    <input
      type={type}
      value={value}
      autoFocus={autoFocus}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      dir={ltr ? 'ltr' : 'rtl'}
      className={`w-full rounded-xl border border-ink-500 bg-ink-900 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-ink-300/60 focus:border-gold-400 ${ltr ? 'text-left' : ''} ${className}`}
    />
  );
  if (!label && !hint) return field;
  return (
    <label className="mt-3 block">
      {label && <span className="mb-1.5 block text-xs font-bold text-ink-300">{label}</span>}
      {field}
      {hint && <span className="mt-1.5 block text-[11px] text-ink-300">{hint}</span>}
    </label>
  );
}

export function Badge({
  children, tone = 'default'
}: { children: ReactNode; tone?: 'default' | 'gold' | 'mint' | 'rose' | 'sky' | 'violet' }) {
  const tones = {
    default: 'bg-ink-600 text-ink-300 border-ink-500',
    gold: 'bg-gold-400/12 text-gold-400 border-gold-400/35',
    mint: 'bg-mint-400/12 text-mint-300 border-mint-400/35',
    rose: 'bg-rose-400/12 text-rose-400 border-rose-400/35',
    sky: 'bg-sky-400/12 text-sky-400 border-sky-400/35',
    violet: 'bg-violet-400/12 text-violet-400 border-violet-400/35'
  };
  return (
    <span className={`inline-block whitespace-nowrap rounded-lg border px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Empty({ text, icon = '📭' }: { text: string; icon?: string }) {
  return (
    <div className="py-16 text-center">
      <div className="text-4xl opacity-60">{icon}</div>
      <p className="mt-3 text-sm text-ink-300">{text}</p>
    </div>
  );
}

export function Spinner({ text = 'در حال بارگذاری…' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="size-8 animate-spin rounded-full border-[3px] border-ink-500 border-t-gold-400" />
      <p className="mt-4 text-sm text-ink-300">{text}</p>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="border-rose-400/40 p-6 text-center">
      <div className="text-3xl">⚠️</div>
      <p className="mt-3 text-sm text-rose-400">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button onClick={onRetry} size="sm">تلاش دوباره</Button>
        </div>
      )}
    </Card>
  );
}

/** نمودار میله‌ای ساده — بدون کتابخانه‌ی خارجی */
export function BarChart({
  data, label, color = 'var(--color-gold-400)', format
}: {
  data: { date: string; value: number }[];
  label: string;
  color?: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = format || ((n: number) => n.toLocaleString('fa-IR'));
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-extrabold">{label}</h3>
        <span className="fa-nums text-xs text-ink-300">مجموع {fmt(total)}</span>
      </div>

      {/* ردیف میله‌ها — ارتفاع ثابت تا درصدها معنا پیدا کنند */}
      <div className="mt-5 flex h-36 gap-1.5" role="img" aria-label={label}>
        {data.map((d) => {
          const h = d.value > 0 ? Math.max(4, (d.value / max) * 100) : 2;
          return (
            <div key={d.date} className="group relative flex h-full flex-1 items-end">
              <div
                className="w-full rounded-t-md transition-opacity group-hover:opacity-75"
                style={{ height: `${h}%`, background: d.value > 0 ? color : 'var(--color-ink-500)' }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-ink-500 bg-ink-900 px-2 py-1 text-[11px] shadow-xl group-hover:block">
                <span className="fa-nums font-bold">{fmt(d.value)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ردیف تاریخ‌ها */}
      <div className="mt-2 flex gap-1.5">
        {data.map((d) => (
          <span key={d.date} className="fa-nums flex-1 text-center text-[9px] text-ink-300">
            {new Date(d.date).toLocaleDateString('fa-IR', { day: 'numeric' })}
          </span>
        ))}
      </div>
    </Card>
  );
}

/** پنجره‌ی گفت‌وگو */
export function Modal({
  open, onClose, title, children, width = 'max-w-md'
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: string }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`w-full ${width} max-h-[88vh] overflow-y-auto rounded-2xl border border-ink-500 bg-gradient-to-br from-ink-700 to-ink-600 p-6 shadow-2xl`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-lg font-black">{title}</h3>
          <button onClick={onClose} className="text-xl text-ink-300 transition hover:text-ink-100" aria-label="بستن">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** نوار پیام کوتاه */
export function Toast({ message, tone }: { message: string; tone: 'ok' | 'err' }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-5 z-[60] flex justify-center px-4">
      <div
        className={`rounded-full border px-5 py-2.5 text-sm font-bold shadow-2xl ${
          tone === 'ok'
            ? 'border-mint-400/50 bg-ink-900 text-mint-300'
            : 'border-rose-400/50 bg-ink-900 text-rose-400'
        }`}
      >
        {message}
      </div>
    </div>
  );
}
