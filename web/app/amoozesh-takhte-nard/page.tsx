import type { Metadata } from 'next';
import Link from 'next/link';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'آموزش تخته‌نرد از صفر — قوانین، چیدمان و اصطلاحات',
  description:
    'آموزش کامل تخته‌نرد به زبان ساده: چیدمان مهره‌ها، نحوه‌ی حرکت با تاس، خوردن مهره و بار، ' +
    'جمع کردن مهره، تفاوت تک و مارس و توله‌مارس، و چند ترفند برای بردن بیشتر.',
  alternates: { canonical: '/amoozesh-takhte-nard' },
  openGraph: {
    title: 'آموزش تخته‌نرد از صفر — قوانین، چیدمان و اصطلاحات',
    description: 'همه‌ی قوانین تخته‌نرد به زبان ساده، همراه با اصطلاحات رایج و ترفندهای بازی.',
    type: 'article'
  }
};

const STEPS = [
  {
    t: 'تخته و چیدمان اولیه',
    b: `تخته‌نرد ۲۴ خانه (پیکان) دارد که به چهار ربع تقسیم می‌شود. هر بازیکن ۱۵ مهره دارد.
        چیدمان استاندارد این است: ۲ مهره روی خانه‌ی ۲۴، ۵ مهره روی خانه‌ی ۱۳، ۳ مهره روی خانه‌ی ۸ و
        ۵ مهره روی خانه‌ی ۶. حریف دقیقاً قرینه‌ی همین را دارد. شش خانه‌ی آخر مسیر هر بازیکن، «خانه» یا
        «هوم» او نام دارد.`
  },
  {
    t: 'شروع بازی و حرکت',
    b: `هر بازیکن یک تاس می‌اندازد؛ هر کس عدد بزرگ‌تر آورد شروع می‌کند و همان دو تاس را بازی می‌کند.
        در هر نوبت دو تاس می‌اندازید و به اندازه‌ی هر تاس، یک مهره را جلو می‌برید. می‌توانید هر دو عدد را
        با یک مهره بازی کنید یا با دو مهره‌ی جداگانه. اگر «جفت» بیاورید (مثلاً ۴ و ۴)، چهار بار آن عدد را
        بازی می‌کنید.`
  },
  {
    t: 'کجا می‌توان فرود آمد؟',
    b: `روی خانه‌ای می‌توانید مهره بگذارید که خالی باشد، مهره‌ی خودتان رویش باشد، یا فقط یک مهره‌ی حریف
        رویش باشد. اگر حریف دو مهره یا بیشتر روی خانه‌ای داشته باشد، آن خانه «بسته» است و شما نمی‌توانید
        واردش شوید.`
  },
  {
    t: 'خوردن مهره و بار',
    b: `اگر روی خانه‌ای فرود بیایید که فقط یک مهره‌ی حریف دارد (به آن مهره «تک» یا «بلوت» می‌گویند)،
        آن مهره خورده می‌شود و می‌رود روی «بار» — یعنی وسط تخته. بازیکنی که مهره روی بار دارد،
        تا وقتی آن مهره را وارد بازی نکند حق هیچ حرکت دیگری ندارد. مهره از بار، وارد خانه‌ی حریف می‌شود.`
  },
  {
    t: 'قانون مهم: بیشترین تاس ممکن',
    b: `باید بیشترین تعداد تاسی را که می‌توانید بازی کنید. اگر فقط یکی از دو تاس قابل بازی باشد، باید
        تاس بزرگ‌تر را بازی کنید (مگر اینکه فقط کوچک‌تر ممکن باشد). اگر هیچ حرکتی نداشته باشید،
        نوبتتان رد می‌شود.`
  },
  {
    t: 'جمع کردن مهره‌ها',
    b: `وقتی هر ۱۵ مهره‌تان وارد خانه‌ی خودتان شد، می‌توانید شروع به جمع کردن کنید. با تاس دقیق، مهره‌ی
        همان خانه را برمی‌دارید. اگر تاس بزرگ‌تر از دورترین مهره باشد، می‌توانید دورترین مهره را جمع کنید.
        اولین کسی که هر ۱۵ مهره را جمع کند برنده است.`
  },
  {
    t: 'تک، مارس و توله‌مارس',
    b: `اگر بازنده حداقل یک مهره جمع کرده باشد، باخت ساده است و به آن «تک» می‌گویند.
        اگر بازنده هیچ مهره‌ای جمع نکرده باشد، «مارس» شده است.
        اگر علاوه بر آن، مهره‌ای روی بار یا داخل خانه‌ی برنده داشته باشد، به آن «توله‌مارس» می‌گویند.`
  }
];

const TIPS = [
  'تک‌مهره (بلوت) نگذارید، مخصوصاً نزدیک خانه‌ی حریف — خورده شدن یعنی برگشتن به اول مسیر.',
  'خانه‌ی ۵ خودتان («نقطه‌ی طلایی») را زود ببندید؛ مهم‌ترین خانه‌ی تخته است.',
  'چند خانه‌ی پشت سر هم بستن («سد») حریف را زمین‌گیر می‌کند.',
  'وقتی جلو هستید، ریسک نکنید و مستقیم بدوید. وقتی عقب هستید، باید ریسک کنید.',
  'مهره‌هایتان را روی یک خانه تلنبار نکنید؛ پخش بودن انتخاب‌های بیشتری می‌دهد.'
];

export default function Amoozesh() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'آموزش تخته‌نرد از صفر',
    description: 'قوانین کامل تخته‌نرد به زبان ساده',
    inLanguage: 'fa-IR',
    step: STEPS.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.t,
      text: s.b.replace(/\s+/g, ' ').trim()
    }))
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="border-b border-ink-500/60 bg-ink-900/85 backdrop-blur">
        <nav className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5 font-black">
            <span className="text-2xl">🎲</span>
            <span className="bg-gradient-to-l from-gold-400 to-gold-300 bg-clip-text text-transparent">
              {site.name}
            </span>
          </Link>
          <Link
            href={site.play}
            className="mr-auto rounded-xl bg-gradient-to-l from-gold-400 to-gold-500 px-4 py-2 text-sm font-extrabold text-[#2a1e04]"
          >
            بازی کن
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        <nav aria-label="مسیر" className="text-xs text-ink-300">
          <Link href="/" className="hover:text-ink-100">خانه</Link>
          <span className="mx-2">/</span>
          <span>آموزش تخته‌نرد</span>
        </nav>

        <h1 className="mt-5 text-3xl font-black leading-snug md:text-4xl">آموزش تخته‌نرد از صفر</h1>
        <p className="mt-4 text-[15px] leading-9 text-ink-300">
          تخته‌نرد یکی از قدیمی‌ترین بازی‌های جهان است و ریشه‌اش به ایران باستان برمی‌گردد. قوانینش
          ساده است ولی برای خوب بازی کردن باید کمی استراتژی بلد باشید. این صفحه همه‌ی چیزی است که
          برای شروع لازم دارید.
        </p>

        <div className="mt-12 space-y-8">
          {STEPS.map((s, i) => (
            <article key={s.t} className="card-surface rounded-2xl p-6">
              <h2 className="flex items-center gap-3 text-xl font-extrabold">
                <span className="fa-nums grid size-8 shrink-0 place-items-center rounded-xl bg-gold-400/15 text-sm text-gold-400">
                  {(i + 1).toLocaleString('fa-IR')}
                </span>
                {s.t}
              </h2>
              <p className="mt-3 text-[14px] leading-9 text-ink-300">{s.b}</p>
            </article>
          ))}
        </div>

        <h2 className="mt-14 text-2xl font-black">چند ترفند برای بردن بیشتر</h2>
        <ul className="mt-5 space-y-3">
          {TIPS.map((t) => (
            <li key={t} className="card-surface flex gap-3 rounded-xl p-4 text-[14px] leading-8 text-ink-300">
              <span className="shrink-0 text-gold-400">◆</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>

        <div className="card-surface mt-14 rounded-2xl p-8 text-center">
          <h2 className="text-xl font-black">آماده‌اید امتحان کنید؟</h2>
          <p className="mt-2 text-sm text-ink-300">۵۰۰ سکه هدیه می‌گیرید و می‌توانید با حریف واقعی بازی کنید.</p>
          <Link
            href={site.play}
            className="mt-6 inline-block rounded-2xl bg-gradient-to-l from-gold-400 to-gold-500 px-7 py-3.5 font-extrabold text-[#2a1e04]"
          >
            🎮 شروع بازی
          </Link>
        </div>
      </main>

      <footer className="border-t border-ink-500/60 px-5 py-8 text-center text-xs text-ink-300">
        <Link href="/" className="hover:text-ink-100">بازگشت به صفحه‌ی اصلی</Link>
      </footer>
    </>
  );
}
