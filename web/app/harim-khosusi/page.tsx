import type { Metadata } from 'next';
import Link from 'next/link';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'حریم خصوصی',
  description: 'سیاست حریم خصوصی تخته‌نرد آنلاین — چه اطلاعاتی جمع می‌کنیم و چرا.',
  alternates: { canonical: '/harim-khosusi' }
};

const SECTIONS = [
  {
    t: 'چه اطلاعاتی جمع می‌کنیم؟',
    b: [
      'شماره‌ی موبایل (اگر با شماره وارد شوید) — فقط برای ورود و بازگرداندن حساب.',
      'شناسه‌ی تلگرام (اگر از مینی‌اپ تلگرام استفاده کنید) — فقط برای شناسایی حساب شما.',
      'نام نمایشی و آواتاری که خودتان انتخاب می‌کنید.',
      'تاریخچه‌ی بازی‌ها و تراکنش‌های سکه، برای نمایش به خودتان و بررسی تخلف.',
      'نشانی IP، صرفاً برای تشخیص حساب‌های تقلبی و جلوگیری از سوءاستفاده.'
    ]
  },
  {
    t: 'چه چیزهایی جمع نمی‌کنیم',
    b: [
      'به مخاطبین، پیام‌ها، موقعیت مکانی، دوربین یا فایل‌های گوشی شما دسترسی نداریم.',
      'اطلاعات کارت بانکی را ذخیره نمی‌کنیم؛ پرداخت از طریق درگاه انجام می‌شود.'
    ]
  },
  {
    t: 'اشتراک‌گذاری با دیگران',
    b: ['اطلاعات شما را به هیچ شخص یا شرکت دیگری نمی‌فروشیم و در اختیار نمی‌گذاریم، مگر در صورت الزام قانونی.']
  },
  {
    t: 'حذف حساب',
    b: ['هر زمان بخواهید می‌توانید درخواست حذف حساب و اطلاعاتتان را بدهید. کافی است به پشتیبانی پیام دهید.']
  }
];

export default function Privacy() {
  return (
    <>
      <header className="border-b border-ink-500/60">
        <nav className="mx-auto flex max-w-3xl items-center px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5 font-black">
            <span className="text-2xl">🎲</span>
            <span className="bg-gradient-to-l from-gold-400 to-gold-300 bg-clip-text text-transparent">{site.name}</span>
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12">
        <nav aria-label="مسیر" className="text-xs text-ink-300">
          <Link href="/" className="hover:text-ink-100">خانه</Link><span className="mx-2">/</span><span>حریم خصوصی</span>
        </nav>
        <h1 className="mt-5 text-3xl font-black">حریم خصوصی</h1>
        <p className="mt-4 text-[15px] leading-8 text-ink-300">
          تا جای ممکن کم‌ترین اطلاعات را جمع می‌کنیم — فقط آن‌قدر که بازی کار کند و جلوی تقلب گرفته شود.
        </p>
        <div className="mt-10 space-y-7">
          {SECTIONS.map((s) => (
            <section key={s.t}>
              <h2 className="text-lg font-extrabold">{s.t}</h2>
              <ul className="mt-3 space-y-2">
                {s.b.map((p, i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-8 text-ink-300">
                    <span className="shrink-0 text-gold-400">◆</span><span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-12 text-sm text-ink-300">
          سؤالی دارید؟ <a href={`mailto:${site.support}`} className="text-gold-400 hover:underline">{site.support}</a>
        </p>
      </main>
      <footer className="border-t border-ink-500/60 px-5 py-8 text-center text-xs text-ink-300">
        <Link href="/" className="hover:text-ink-100">بازگشت به صفحه‌ی اصلی</Link>
      </footer>
    </>
  );
}
