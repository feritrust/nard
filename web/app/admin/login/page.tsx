'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, setToken, ApiError } from '@/lib/adminApi';
import { Button, Input, Card } from '@/components/ui';

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needTotp, setNeedTotp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // اگر ادمین هنوز دو مرحله‌ای را فعال نکرده، بلافاصله بعد از ورود راهنمایی می‌کنیم
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [setupCode, setSetupCode] = useState('');

  const submit = async () => {
    if (!username || !password) { setError('نام کاربری و رمز را وارد کنید'); return; }
    setBusy(true); setError('');
    try {
      const d = await adminApi.login(username, password, totp || undefined);
      setToken(d.token);
      if (d.setupTotp) { setSetup(d.setupTotp); setBusy(false); return; }
      router.replace('/admin');
    } catch (e) {
      const err = e as ApiError;
      if ((err as any).status === 401 || err.message.includes('دو مرحله')) {
        // سرور گفت کد لازم است
      }
      setError(err.message);
      if (err.message.includes('دو مرحله')) setNeedTotp(true);
      setBusy(false);
    }
  };

  const finishSetup = async () => {
    setBusy(true); setError('');
    try {
      await adminApi.enableTotp(setupCode);
      router.replace('/admin');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  /* --------------------------------- راه‌اندازی کد دو مرحله‌ای */
  if (setup) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-5">
        <Card className="w-full max-w-md p-7">
          <div className="text-center">
            <div className="text-4xl">🔐</div>
            <h1 className="mt-3 text-xl font-black">دو مرحله‌ای را فعال کنید</h1>
            <p className="mt-2 text-[13px] leading-7 text-ink-300">
              این پنل به پول کاربران دسترسی دارد. بدون کد دو مرحله‌ای، لو رفتن رمز یعنی از دست رفتن همه‌چیز.
            </p>
          </div>

          <div className="mt-6 rounded-xl border border-ink-500 bg-ink-900 p-4">
            <p className="text-xs text-ink-300">
              این کد را در <b className="text-ink-100">Google Authenticator</b> (یا هر اپ مشابه) وارد کنید:
            </p>
            <code className="mt-3 block select-all break-all rounded-lg bg-ink-800 p-3 text-center text-sm tracking-widest text-gold-400" dir="ltr">
              {setup.secret}
            </code>
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-xs text-ink-300">کد ۶ رقمی ساخته‌شده را وارد کنید</label>
            <Input
              value={setupCode}
              onChange={(v) => setSetupCode(v.replace(/\D/g, '').slice(0, 6))}
              placeholder="۱۲۳۴۵۶"
              ltr
              maxLength={6}
              autoFocus
              className="text-center text-xl tracking-[0.4em]"
              onKeyDown={(e) => e.key === 'Enter' && finishSetup()}
            />
          </div>

          {error && <p className="mt-3 text-center text-xs text-rose-400">{error}</p>}

          <div className="mt-5 space-y-2">
            <Button variant="gold" onClick={finishSetup} disabled={busy || setupCode.length !== 6} className="w-full">
              {busy ? 'در حال بررسی…' : 'فعال‌سازی و ورود'}
            </Button>
            <Button variant="ghost" onClick={() => router.replace('/admin')} className="w-full">
              فعلاً نه (توصیه نمی‌شود)
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  /* --------------------------------------------------- فرم ورود */
  return (
    <div className="flex min-h-dvh items-center justify-center p-5">
      <Card className="w-full max-w-sm p-7">
        <div className="text-center">
          <div className="text-4xl">🎲</div>
          <h1 className="mt-3 text-xl font-black">پنل مدیریت</h1>
          <p className="mt-1.5 text-xs text-ink-300">تخته‌نرد حرفه‌ای</p>
        </div>

        <div className="mt-7 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs text-ink-300">نام کاربری</label>
            <Input value={username} onChange={setUsername} ltr autoFocus
              onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-ink-300">رمز عبور</label>
            <Input value={password} onChange={setPassword} type="password" ltr
              onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </div>
          {needTotp && (
            <div>
              <label className="mb-1.5 block text-xs text-ink-300">کد دو مرحله‌ای</label>
              <Input
                value={totp}
                onChange={(v) => setTotp(v.replace(/\D/g, '').slice(0, 6))}
                ltr maxLength={6} autoFocus
                className="text-center text-lg tracking-[0.4em]"
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>
          )}
        </div>

        {error && <p className="mt-4 text-center text-xs text-rose-400">{error}</p>}

        <Button variant="gold" onClick={submit} disabled={busy} className="mt-6 w-full">
          {busy ? 'در حال ورود…' : 'ورود'}
        </Button>

        <p className="mt-5 text-center text-[11px] leading-6 text-ink-300">
          اولین بار است؟ روی سرور اجرا کنید:
          <br />
          <code className="text-ink-100" dir="ltr">node create-admin.js &lt;user&gt; &lt;pass&gt; owner</code>
        </p>
      </Card>
    </div>
  );
}
