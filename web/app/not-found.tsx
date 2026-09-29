import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="text-6xl">🎲</div>
      <h1 className="text-2xl font-black">این صفحه پیدا نشد</h1>
      <p className="text-sm text-ink-300">شاید نشانی را اشتباه وارد کرده‌اید.</p>
      <Link
        href="/"
        className="rounded-2xl bg-gradient-to-l from-gold-400 to-gold-500 px-6 py-3 font-extrabold text-[#2a1e04]"
      >
        بازگشت به صفحه‌ی اصلی
      </Link>
    </main>
  );
}
