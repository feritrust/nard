'use client';

import { useEffect, useState } from 'react';
import { adminApi, fa } from '@/lib/adminApi';
import { Card, Button, Input, Spinner, ErrorBox, Toast, Badge } from '@/components/ui';

type Field = {
  key: string;
  label: string;
  hint?: string;
  unit?: string;
  kind?: 'number' | 'toggle';
};

const GROUPS: { title: string; note?: string; fields: Field[] }[] = [
  {
    title: 'هدیه‌ها',
    fields: [
      { key: 'WELCOME_COINS', label: 'هدیه‌ی خوش‌آمدگویی', unit: 'سکه', hint: 'یک‌بار برای هر کاربر جدید' },
      { key: 'DAILY_BONUS', label: 'هدیه‌ی روزانه', unit: 'سکه', hint: 'هر روز یک‌بار' }
    ]
  },
  {
    title: 'اقتصاد بازی',
    note: 'تغییر این اعداد بلافاصله روی بازی‌های بعدی اثر می‌گذارد.',
    fields: [
      { key: 'RAKE_PERCENT', label: 'درصد فی', unit: '٪', hint: 'از مبلغ کل میز کسر می‌شود' },
      { key: 'RAKE_MIN_ENTRY', label: 'حداقل ورودی برای فی', unit: 'سکه', hint: 'اتاق‌های ارزان‌تر فی ندارند' },
      { key: 'ENERGY_PER_COINS', label: 'سکه به ازای هر ۱ انرژی', unit: 'سکه', hint: 'هرچه کمتر، انرژی بیشتر' },
      { key: 'ENERGY_MARS_BONUS', label: 'پاداش مارس', hint: 'مثلاً ۰٫۵ یعنی ۵۰٪ انرژی بیشتر' }
    ]
  },
  {
    title: 'دعوت دوستان',
    fields: [
      { key: 'REFERRAL_ENERGY', label: 'انرژی دعوت‌کننده', unit: 'انرژی' },
      { key: 'REFERRAL_COINS', label: 'سکه‌ی دعوت‌کننده', unit: 'سکه' },
      { key: 'REFERRAL_BONUS_NEW', label: 'سکه‌ی کاربر جدید', unit: 'سکه' }
    ]
  },
  {
    title: 'فروش سکه',
    fields: [
      { key: 'SELL_RATE', label: 'نرخ فروش', unit: 'سکه = ۱۰۰۰ تومان', hint: 'هرچه بیشتر، ارزش سکه کمتر' },
      { key: 'SELL_MIN', label: 'حداقل مقدار فروش', unit: 'سکه' }
    ]
  },
  {
    title: 'وضعیت سرویس',
    fields: [
      { key: 'MAINTENANCE', label: 'حالت تعمیرات', kind: 'toggle', hint: 'بازی برای همه بسته می‌شود' },
      { key: 'SIGNUP_OPEN', label: 'ثبت‌نام باز است', kind: 'toggle' }
    ]
  }
];

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string> | null>(null);
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'err' } | null>(null);

  const load = () => {
    setError('');
    adminApi.settings()
      .then((d) => {
        const v: Record<string, string> = {};
        Object.entries(d.settings).forEach(([k, val]) => { v[k] = String(val); });
        setValues(v);
        setInitial(v);
      })
      .catch((e) => setError(e.message));
  };
  useEffect(load, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const dirty = values && Object.keys(values).some((k) => values[k] !== initial[k]);

  const save = async () => {
    if (!values) return;
    setBusy(true);
    try {
      const changed: Record<string, string> = {};
      Object.keys(values).forEach((k) => { if (values[k] !== initial[k]) changed[k] = values[k]; });
      const d = await adminApi.saveSettings(changed);
      const v: Record<string, string> = {};
      Object.entries(d.settings).forEach(([k, val]) => { v[k] = String(val); });
      setValues(v); setInitial(v);
      setToast({ message: `${fa(d.changed.length)} تنظیم ذخیره شد`, tone: 'ok' });
    } catch (e) {
      setToast({ message: (e as Error).message, tone: 'err' });
    }
    setBusy(false);
  };

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!values) return <Spinner />;

  // پیش‌نمایش اثر تنظیمات روی یک اتاق نمونه
  const rake = Number(values.RAKE_PERCENT) || 0;
  const sample = 1000;
  const pot = sample * 2;
  const rakeAmt = sample >= Number(values.RAKE_MIN_ENTRY) ? Math.round((pot * rake) / 100) : 0;

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} tone={toast.tone} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">تنظیمات</h1>
          <p className="mt-1 text-xs text-ink-300">فقط مالک می‌تواند این‌ها را تغییر دهد</p>
        </div>
        {dirty && (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setValues(initial)}>برگرداندن</Button>
            <Button variant="gold" onClick={save} disabled={busy}>
              {busy ? 'در حال ذخیره…' : 'ذخیره‌ی تغییرات'}
            </Button>
          </div>
        )}
      </div>

      {/* پیش‌نمایش */}
      <Card className="border-gold-400/30 p-5">
        <h2 className="text-sm font-extrabold text-gold-400">پیش‌نمایش — اتاق ۱٬۰۰۰ سکه</h2>
        <div className="fa-nums mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <span className="text-ink-300">مبلغ میز: <b className="text-ink-100">{fa(pot)}</b></span>
          <span className="text-ink-300">فی: <b className="text-rose-400">{fa(rakeAmt)}</b></span>
          <span className="text-ink-300">جایزه‌ی برنده: <b className="text-gold-400">{fa(pot - rakeAmt)}</b></span>
          <span className="text-ink-300">سود خالص برنده: <b className="text-mint-300">{fa(pot - rakeAmt - sample)}</b></span>
          <span className="text-ink-300">
            انرژی: <b className="text-energy-400">
              {fa(Math.max(1, Math.round(sample / (Number(values.ENERGY_PER_COINS) || 100))))}
            </b>
          </span>
        </div>
      </Card>

      {GROUPS.map((g) => (
        <Card key={g.title} className="p-5">
          <h2 className="text-sm font-extrabold">{g.title}</h2>
          {g.note && <p className="mt-1 text-[11.5px] text-ink-300">{g.note}</p>}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {g.fields.map((f) => {
              const changed = values[f.key] !== initial[f.key];
              if (f.kind === 'toggle') {
                const on = values[f.key] === '1';
                return (
                  <div key={f.key} className={`rounded-xl border p-4 ${changed ? 'border-gold-400/50' : 'border-ink-500'} bg-ink-900`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold">{f.label}</div>
                        {f.hint && <div className="mt-1 text-[11px] text-ink-300">{f.hint}</div>}
                      </div>
                      <Button
                        size="sm"
                        variant={on ? 'mint' : 'ghost'}
                        onClick={() => setValues({ ...values, [f.key]: on ? '0' : '1' })}
                      >
                        {on ? 'روشن' : 'خاموش'}
                      </Button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={f.key} className={`rounded-xl border p-4 ${changed ? 'border-gold-400/50' : 'border-ink-500'} bg-ink-900`}>
                  <label className="flex items-center justify-between gap-2 text-sm font-bold">
                    <span>{f.label}</span>
                    {changed && <Badge tone="gold">تغییر کرده</Badge>}
                  </label>
                  {f.hint && <div className="mt-1 text-[11px] text-ink-300">{f.hint}</div>}
                  <div className="mt-2.5 flex items-center gap-2">
                    <Input
                      value={values[f.key] ?? ''}
                      onChange={(v) => setValues({ ...values, [f.key]: v })}
                      ltr
                      className="flex-1"
                    />
                    {f.unit && <span className="shrink-0 text-[11px] text-ink-300">{f.unit}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {dirty && (
        <div className="sticky bottom-4 flex justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-gold-400/50 bg-ink-900/95 px-5 py-3 shadow-2xl backdrop-blur">
            <span className="text-xs text-ink-300">تغییرات ذخیره نشده</span>
            <Button variant="gold" size="sm" onClick={save} disabled={busy}>
              {busy ? 'صبر کنید…' : 'ذخیره'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
