import type { Metadata } from 'next';
import Link from 'next/link';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'قوانین و شرایط استفاده',
  description: 'قوانین استفاده از بازی تخته‌نرد آنلاین، شرایط سکه و جوایز، و قوانین ضد تقلب.',
  alternates: { canonical: '/qavanin' }
};

const SECTIONS = [
  {
    t: '۱. پذیرش قوانین',
    b: ['با ساختن حساب کاربری یا بازی کردن در این سرویس، این قوانین را پذیرفته‌اید. اگر با بخشی از آن موافق نیستید، لطفاً از سرویس استفاده نکنید.']
  },
  {
    t: '۲. حساب کاربری',
    b: [
      'هر شخص فقط مجاز به داشتن یک حساب است. ساختن چند حساب برای گرفتن هدیه‌ی خوش‌آمدگویی یا پاداش دعوت، تخلف محسوب می‌شود.',
      'مسئولیت حفظ دسترسی به شماره‌ی موبایل و حساب تلگرامی که با آن وارد شده‌اید با خودتان است.',
      'اگر حساب مهمان بسازید و اپ را پاک کنید، بازگرداندن سکه‌ها ممکن نیست. برای حفظ دارایی، شماره‌ی موبایل خود را ثبت کنید.'
    ]
  },
  {
    t: '۳. سکه و انرژی',
    b: [
      'سکه و انرژی صرفاً اعتبار داخل بازی هستند و ارزش پولی مستقلی ندارند.',
      'در اتاق‌های ۱۰۰۰ سکه به بالا، ۱۰٪ از مبلغ کل میز به‌عنوان کارمزد سرویس کسر می‌شود. این مقدار پیش از شروع هر بازی به شما نمایش داده می‌شود.',
      'انرژی با بازی کردن به دست می‌آید و قابل خرید یا انتقال نیست.'
    ]
  },
  {
    t: '۴. جوایز',
    b: [
      'جوایز سکه‌ای و آیتمی بلافاصله به حساب شما اضافه می‌شوند.',
      'جوایز فیزیکی یا شارژ، پس از بررسی درخواست و تأیید هویت ارسال می‌شوند. زمان بررسی معمولاً ۲۴ تا ۷۲ ساعت کاری است.',
      'در صورت تشخیص تخلف، درخواست جایزه رد شده و انرژی به حساب بازگردانده می‌شود.'
    ]
  },
  {
    t: '۵. تخلف و تقلب',
    b: [
      'تبانی با بازیکن دیگر برای انتقال سکه (باخت عمدی)، استفاده از چند حساب، یا هر روشی برای دور زدن قوانین، منجر به مسدود شدن حساب و ابطال دارایی می‌شود.',
      'استفاده از ربات، اسکریپت یا هر ابزار کمکی برای بازی ممنوع است.',
      'سیستم به‌صورت خودکار الگوهای مشکوک را علامت‌گذاری می‌کند و تیم پشتیبانی آن‌ها را بررسی می‌کند.'
    ]
  },
  {
    t: '۶. رفتار در بازی',
    b: ['توهین، تهدید یا هر رفتار آزاردهنده در چت بازی ممنوع است و می‌تواند به محدود شدن حساب منجر شود.']
  },
  {
    t: '۷. تغییر قوانین',
    b: ['ممکن است این قوانین در آینده به‌روز شوند. تغییرات مهم پیش از اجرا در بازی اطلاع‌رسانی می‌شود.']
  }
];

export default function Qavanin() {
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
          <Link href="/" className="hover:text-ink-100">خانه</Link><span className="mx-2">/</span><span>قوانین و شرایط</span>
        </nav>
        <h1 className="mt-5 text-3xl font-black">قوانین و شرایط استفاده</h1>
        <p className="mt-3 text-sm text-ink-300">آخرین به‌روزرسانی: مهر ۱۴۰۵</p>
        <div className="mt-10 space-y-7">
          {SECTIONS.map((s) => (
            <section key={s.t}>
              <h2 className="text-lg font-extrabold">{s.t}</h2>
              <div className="mt-2 space-y-2">
                {s.b.map((p, i) => (
                  <p key={i} className="text-[14px] leading-8 text-ink-300">{p}</p>
                ))}
              </div>
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
