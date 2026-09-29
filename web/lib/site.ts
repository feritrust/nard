/**
 * site.ts — نام برند، دامنه و متن‌های ثابت سایت
 *
 * برای عوض کردن اسم یا دامنه، فقط همین فایل و متغیر NEXT_PUBLIC_SITE_URL
 * را تغییر دهید؛ عنوان‌ها، متاتگ‌ها، sitemap و ساختار داده خودشان به‌روز می‌شوند.
 */

export const site = {
  name: 'تخته‌نرد حرفه‌ای',
  shortName: 'تخته‌نرد',
  domain: process.env.NEXT_PUBLIC_SITE_URL || 'https://nard.app',
  tagline: 'بازی آنلاین تخته‌نرد با حریف‌های واقعی',
  description:
    'تخته‌نرد آنلاین فارسی با حریف واقعی، اتاق‌های مختلف، جایزه و سیستم انرژی. ' +
    'رایگان بازی کنید — روی وب، تلگرام و اندروید. ۵۰۰ سکه هدیه‌ی خوش‌آمدگویی.',
  keywords: [
    'تخته نرد', 'تخته نرد آنلاین', 'بازی تخته نرد', 'نرد آنلاین',
    'تخته نرد دو نفره', 'بازی نرد', 'تخته نرد اندروید', 'تخته نرد فارسی',
    'آموزش تخته نرد', 'قوانین تخته نرد', 'مارس', 'تخته نرد با حریف واقعی'
  ],
  telegram: 'https://t.me/nard_app_bot',
  apk: '/download/nard.apk',
  play: '/play',
  support: 'support@nard.app',
  locale: 'fa_IR'
};

export const api = {
  base: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
};
