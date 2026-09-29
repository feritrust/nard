import type { Metadata } from 'next';
import Link from 'next/link';
import { site, api } from '@/lib/site';

export const metadata: Metadata = {
  title: `${site.name} — ${site.tagline}`,
  description: site.description,
  alternates: { canonical: '/' }
};

/* آمار زنده از سرور بازی — هر ۵ دقیقه تازه می‌شود، اگر سرور نبود بی‌سروصدا رد می‌شود */
async function liveStats() {
  try {
    const r = await fetch(`${api.base}/health`, { next: { revalidate: 300 } });
    if (!r.ok) return null;
    const d = await r.json();
    return { players: d.total ?? 0, online: d.online ?? 0, today: d.today ?? 0 };
  } catch {
    return null;
  }
}

const fa = (n: number) => n.toLocaleString('fa-IR');

const FEATURES = [
  { icon: '🎯', title: 'حریف واقعی', text: 'با بازیکن‌های واقعی از سراسر ایران بازی کنید. اگر کسی آنلاین نبود، حریف هوشمند وارد می‌شود تا منتظر نمانید.' },
  { icon: '🎲', title: 'قوانین کامل', text: 'مارس، توله‌مارس، بار، جمع‌کردن مهره و قانون بیشترین تاس — همه دقیقاً مثل تخته‌ی واقعی.' },
  { icon: '⚡', title: 'انرژی و جایزه', text: 'هر بازی به شما انرژی می‌دهد، چه ببرید چه ببازید. انرژی‌ها را با جایزه‌های واقعی عوض کنید.' },
  { icon: '🎨', title: 'پوسته‌های تخته', text: 'نُه پوسته از شب یلدا و فیروزه‌ی اصفهان تا اژدهای سرخ. اتاق‌های گران‌تر پوسته‌ی اختصاصی دارند.' },
  { icon: '👥', title: 'دعوت دوستان', text: 'به ازای هر دوستی که با کد شما بیاید، انرژی و سکه هدیه بگیرید.' },
  { icon: '📱', title: 'همه‌جا در دسترس', text: 'وب، مینی‌اپ تلگرام و اپ اندروید — با یک حساب، همه‌ی سکه‌ها و جوایز همه‌جا با شماست.' }
];

const ROOMS = [
  { icon: '🌱', name: 'مبتدی', entry: 100, prize: 200, fee: '—', level: 1 },
  { icon: '🥉', name: 'برنزی', entry: 500, prize: 1000, fee: '—', level: 1 },
  { icon: '🥈', name: 'نقره‌ای', entry: 1000, prize: 1800, fee: '۱۰٪', level: 2 },
  { icon: '🥇', name: 'طلایی', entry: 5000, prize: 9000, fee: '۱۰٪', level: 3 },
  { icon: '💎', name: 'الماس', entry: 25000, prize: 45000, fee: '۱۰٪', level: 5 },
  { icon: '👑', name: 'افسانه‌ای', entry: 100000, prize: 180000, fee: '۱۰٪', level: 8 }
];

const FAQ = [
  {
    q: 'بازی تخته‌نرد آنلاین رایگان است؟',
    a: 'بله. ثبت‌نام و بازی کردن کاملاً رایگان است و به محض ورود ۵۰۰ سکه هدیه می‌گیرید. هر روز هم یک هدیه‌ی روزانه دریافت می‌کنید.'
  },
  {
    q: 'با چه کسی بازی می‌کنم؟',
    a: 'با بازیکن‌های واقعی. اگر در آن لحظه حریف آنلاینی در آن اتاق نباشد، بعد از چند ثانیه یک حریف هوشمند وارد بازی می‌شود تا معطل نمانید.'
  },
  {
    q: 'انرژی چیست و چطور به دست می‌آید؟',
    a: 'به ازای هر ۱۰۰ سکه‌ای که در بازی شرط می‌بندید یک انرژی می‌گیرید — چه ببرید چه ببازید. اگر حریف را مارس کنید ۵۰٪ انرژی بیشتری می‌گیرید. انرژی‌ها در بخش جایزه‌ها خرج می‌شوند.'
  },
  {
    q: 'فی اتاق یعنی چه؟',
    a: 'در اتاق‌های ۱۰۰۰ سکه به بالا، ۱۰٪ از مبلغ کل میز به‌عنوان کارمزد کسر می‌شود. مثلاً در اتاق ۱۰۰۰ سکه، مبلغ میز ۲۰۰۰ سکه است و برنده ۱۸۰۰ سکه می‌گیرد. اتاق‌های مبتدی و برنزی هیچ کارمزدی ندارند.'
  },
  {
    q: 'اگر وسط بازی اینترنتم قطع شود چه می‌شود؟',
    a: 'نگران نباشید. ۴۵ ثانیه فرصت دارید برگردید و بازی دقیقاً از همان‌جا ادامه پیدا می‌کند. اپ خودش تلاش می‌کند دوباره وصل شود.'
  },
  {
    q: 'چطور اپ اندروید را نصب کنم؟',
    a: 'فایل نصبی را از همین صفحه دانلود کنید. همچنین می‌توانید بدون نصب، مستقیم در مرورگر یا داخل تلگرام بازی کنید.'
  },
  {
    q: 'مارس یعنی چه؟',
    a: 'اگر بازیکنی همه‌ی ۱۵ مهره‌اش را جمع کند در حالی که حریف حتی یک مهره هم جمع نکرده باشد، به آن مارس می‌گویند. اگر حریف علاوه بر آن مهره‌ای در خانه‌ی برنده یا روی بار داشته باشد، به آن توله‌مارس می‌گویند.'
  }
];

export default async function Home() {
  const stats = await liveStats();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'VideoGame',
        name: site.name,
        alternateName: 'تخته نرد آنلاین',
        description: site.description,
        url: site.domain,
        inLanguage: 'fa-IR',
        genre: ['Board Game', 'Strategy'],
        playMode: ['MultiPlayer', 'SinglePlayer'],
        applicationCategory: 'GameApplication',
        operatingSystem: 'Android, Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'IRR' },
        numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2 }
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQ.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a }
        }))
      },
      {
        '@type': 'WebSite',
        name: site.name,
        url: site.domain,
        inLanguage: 'fa-IR'
      }
    ]
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ------------------------------------------------ نوار بالا */}
      <header className="sticky top-0 z-50 border-b border-ink-500/60 bg-ink-900/85 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5 font-black text-lg">
            <span className="text-2xl">🎲</span>
            <span className="bg-gradient-to-l from-gold-400 via-gold-300 to-gold-400 bg-clip-text text-transparent">
              {site.name}
            </span>
          </Link>
          <div className="mr-auto hidden items-center gap-6 text-sm text-ink-300 md:flex">
            <a href="#features" className="transition hover:text-ink-100">امکانات</a>
            <a href="#rooms" className="transition hover:text-ink-100">اتاق‌ها</a>
            <Link href="/amoozesh-takhte-nard" className="transition hover:text-ink-100">آموزش تخته‌نرد</Link>
            <a href="#faq" className="transition hover:text-ink-100">سؤال‌های پرتکرار</a>
          </div>
          <Link
            href={site.play}
            className="mr-auto rounded-xl bg-gradient-to-l from-gold-400 to-gold-500 px-4 py-2 text-sm font-extrabold text-[#2a1e04] shadow-lg shadow-gold-400/20 transition hover:brightness-110 md:mr-0"
          >
            بازی کن
          </Link>
        </nav>
      </header>

      <main>
        {/* ------------------------------------------------ قهرمان */}
        <section className="hero-glow relative overflow-hidden px-5 py-16 md:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/40 bg-gold-400/10 px-3.5 py-1.5 text-xs font-bold text-gold-300">
                🎁 ۵۰۰ سکه هدیه‌ی خوش‌آمدگویی
              </span>
              <h1 className="mt-5 text-4xl font-black leading-[1.25] md:text-5xl">
                تخته‌نرد آنلاین،
                <br />
                <span className="bg-gradient-to-l from-gold-400 via-gold-300 to-gold-400 bg-clip-text text-transparent">
                  با حریف‌های واقعی
                </span>
              </h1>
              <p className="mt-5 max-w-lg text-[15px] leading-8 text-ink-300">
                همان تخته‌نردی که دوست دارید — با قوانین کامل، حریف واقعی، پوسته‌های زیبا و جایزه‌های واقعی.
                بدون نصب در مرورگر یا تلگرام بازی کنید، یا اپ اندروید را بگیرید.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={site.play}
                  className="rounded-2xl bg-gradient-to-l from-gold-400 to-gold-500 px-6 py-3.5 font-extrabold text-[#2a1e04] shadow-xl shadow-gold-400/25 transition hover:brightness-110"
                >
                  🎮 همین حالا بازی کن
                </Link>
                <a
                  href={site.telegram}
                  className="rounded-2xl border border-sky-400/40 bg-sky-400/10 px-6 py-3.5 font-extrabold text-sky-400 transition hover:bg-sky-400/20"
                >
                  ✈️ بازی در تلگرام
                </a>
                <a
                  href={site.apk}
                  className="rounded-2xl border border-ink-500 bg-ink-700 px-6 py-3.5 font-extrabold transition hover:bg-ink-600"
                >
                  ⬇️ دانلود اپ اندروید
                </a>
              </div>

              {stats && (
                <dl className="fa-nums mt-9 flex flex-wrap gap-8 text-sm">
                  <div>
                    <dt className="text-ink-300">بازیکن</dt>
                    <dd className="mt-0.5 text-2xl font-black text-gold-400">{fa(stats.players)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-300">آنلاین</dt>
                    <dd className="mt-0.5 text-2xl font-black text-mint-400">{fa(stats.online)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-300">عضو امروز</dt>
                    <dd className="mt-0.5 text-2xl font-black text-sky-400">{fa(stats.today)}</dd>
                  </div>
                </dl>
              )}
            </div>

            {/* تخته‌ی تزئینی */}
            <div aria-hidden className="mx-auto w-full max-w-sm">
              <div className="mini-board rounded-3xl p-3 shadow-2xl shadow-black/60 ring-1 ring-black/40">
                <div className="mini-felt flex h-72 gap-px overflow-hidden rounded-2xl p-1.5 shadow-inner md:h-80">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="flex flex-1 flex-col justify-between">
                      <div
                        className="h-[42%] w-full"
                        style={{
                          background:
                            i % 2 === 0
                              ? 'linear-gradient(180deg,#f0d7ad,#e4c79a 38%,#bb9c6f)'
                              : 'linear-gradient(180deg,#cf6539,#b8562f 38%,#83381c)',
                          clipPath: 'polygon(0 0,100% 0,50% 100%)'
                        }}
                      />
                      <div
                        className="h-[42%] w-full"
                        style={{
                          background:
                            i % 2 === 1
                              ? 'linear-gradient(0deg,#f0d7ad,#e4c79a 38%,#bb9c6f)'
                              : 'linear-gradient(0deg,#cf6539,#b8562f 38%,#83381c)',
                          clipPath: 'polygon(0 100%,100% 100%,50% 0)'
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ امکانات */}
        <section id="features" className="scroll-mt-20 px-5 py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-3xl font-black">چرا این تخته‌نرد؟</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-7 text-ink-300">
              همه‌چیز را طوری ساختیم که حس بازی با تخته‌ی واقعی را بدهد — از صدای تاس تا کشیدن مهره با انگشت.
            </p>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <article key={f.title} className="card-surface rounded-2xl p-6 transition hover:border-gold-400/40">
                  <div className="text-3xl">{f.icon}</div>
                  <h3 className="mt-4 text-lg font-extrabold">{f.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-7 text-ink-300">{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ اتاق‌ها */}
        <section id="rooms" className="scroll-mt-20 px-5 py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-3xl font-black">اتاق‌های بازی</h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-7 text-ink-300">
              از ۱۰۰ سکه تا ۱۰۰٬۰۰۰ سکه. هرچه اتاق گران‌تر، حریف قوی‌تر و پوسته‌ی تخته خاص‌تر.
            </p>

            <div className="card-surface fa-nums mt-10 overflow-hidden rounded-2xl">
              <table className="w-full text-right text-sm">
                <caption className="sr-only">جدول اتاق‌های بازی تخته‌نرد، ورودی و جایزه‌ی هر اتاق</caption>
                <thead className="bg-ink-800/70 text-xs text-ink-300">
                  <tr>
                    <th scope="col" className="px-4 py-3.5 font-bold">اتاق</th>
                    <th scope="col" className="px-4 py-3.5 font-bold">ورودی</th>
                    <th scope="col" className="px-4 py-3.5 font-bold">جایزه‌ی برنده</th>
                    <th scope="col" className="px-4 py-3.5 font-bold">فی</th>
                    <th scope="col" className="px-4 py-3.5 font-bold">حداقل سطح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-500/60">
                  {ROOMS.map((r) => (
                    <tr key={r.name} className="transition hover:bg-ink-800/40">
                      <th scope="row" className="px-4 py-3.5 text-right font-extrabold">
                        <span className="ml-1.5">{r.icon}</span>
                        {r.name}
                      </th>
                      <td className="px-4 py-3.5">{fa(r.entry)}</td>
                      <td className="px-4 py-3.5 font-bold text-gold-400">{fa(r.prize)}</td>
                      <td className="px-4 py-3.5 text-ink-300">{r.fee}</td>
                      <td className="px-4 py-3.5 text-ink-300">{fa(r.level)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-center text-xs leading-6 text-ink-300">
              فی از مبلغ کل میز (دو برابر ورودی) کسر می‌شود، نه از ورودی هر نفر.
            </p>
          </div>
        </section>

        {/* ------------------------------------------------ آموزش */}
        <section className="px-5 py-16">
          <div className="card-surface mx-auto max-w-4xl rounded-3xl p-8 md:p-12">
            <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
              <div>
                <h2 className="text-2xl font-black">تازه‌کارید؟ اشکالی ندارد</h2>
                <p className="mt-3 text-sm leading-8 text-ink-300">
                  قوانین تخته‌نرد را از صفر توضیح داده‌ایم: چیدمان مهره‌ها، حرکت، خوردن مهره، بار،
                  جمع کردن مهره و فرق تک و مارس و توله‌مارس. با چند دقیقه خواندن می‌توانید شروع کنید.
                </p>
              </div>
              <Link
                href="/amoozesh-takhte-nard"
                className="shrink-0 rounded-2xl border border-gold-400/40 bg-gold-400/10 px-6 py-3.5 text-center font-extrabold text-gold-300 transition hover:bg-gold-400/20"
              >
                آموزش تخته‌نرد →
              </Link>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ سؤال‌ها */}
        <section id="faq" className="scroll-mt-20 px-5 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-black">سؤال‌های پرتکرار</h2>
            <div className="mt-10 space-y-3">
              {FAQ.map((f) => (
                <details key={f.q} className="card-surface group rounded-2xl px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold">
                    <span>{f.q}</span>
                    <span className="shrink-0 text-gold-400 transition group-open:rotate-45">＋</span>
                  </summary>
                  <p className="mt-3 text-[13.5px] leading-8 text-ink-300">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ دعوت پایانی */}
        <section className="px-5 py-16">
          <div className="mx-auto max-w-4xl rounded-3xl border border-gold-400/30 bg-gradient-to-bl from-gold-400/15 via-ink-800 to-ink-800 p-10 text-center md:p-14">
            <h2 className="text-3xl font-black">همین حالا شروع کنید</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-ink-300">
              ثبت‌نام چند ثانیه طول می‌کشد و ۵۰۰ سکه هدیه می‌گیرید.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href={site.play}
                className="rounded-2xl bg-gradient-to-l from-gold-400 to-gold-500 px-7 py-3.5 font-extrabold text-[#2a1e04] shadow-xl shadow-gold-400/25 transition hover:brightness-110"
              >
                🎮 بازی در مرورگر
              </Link>
              <a
                href={site.telegram}
                className="rounded-2xl border border-sky-400/40 bg-sky-400/10 px-7 py-3.5 font-extrabold text-sky-400 transition hover:bg-sky-400/20"
              >
                ✈️ مینی‌اپ تلگرام
              </a>
              <a
                href={site.apk}
                className="rounded-2xl border border-ink-500 bg-ink-700 px-7 py-3.5 font-extrabold transition hover:bg-ink-600"
              >
                ⬇️ اپ اندروید
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ------------------------------------------------ پاورقی */}
      <footer className="border-t border-ink-500/60 px-5 py-10 text-sm text-ink-300">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2.5 font-extrabold text-ink-100">
            <span className="text-xl">🎲</span> {site.name}
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link href="/amoozesh-takhte-nard" className="transition hover:text-ink-100">آموزش تخته‌نرد</Link>
            <Link href="/qavanin" className="transition hover:text-ink-100">قوانین و شرایط</Link>
            <Link href="/harim-khosusi" className="transition hover:text-ink-100">حریم خصوصی</Link>
            <a href={`mailto:${site.support}`} className="transition hover:text-ink-100">پشتیبانی</a>
          </nav>
          <p className="fa-nums text-xs">© ۱۴۰۵ — همه‌ی حقوق محفوظ است</p>
        </div>
      </footer>
    </>
  );
}
