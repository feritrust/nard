import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { site } from '@/lib/site';
import './globals.css';

/* فونت را خودمان میزبانی می‌کنیم — هم سریع‌تر است، هم به گوگل فونت وابسته نیست
   (که در ایران معمولاً کند یا در دسترس نیست). */
const vazir = localFont({
  src: [
    { path: '../public/fonts/Vazirmatn-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/Vazirmatn-Medium.woff2',  weight: '500', style: 'normal' },
    { path: '../public/fonts/Vazirmatn-Bold.woff2',    weight: '700', style: 'normal' },
    { path: '../public/fonts/Vazirmatn-Black.woff2',   weight: '900', style: 'normal' }
  ],
  display: 'swap',
  variable: '--font-vazir',
  fallback: ['Tahoma', 'system-ui', 'sans-serif']
});

export const metadata: Metadata = {
  metadataBase: new URL(site.domain),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s | ${site.name}`
  },
  description: site.description,
  keywords: site.keywords,
  applicationName: site.name,
  authors: [{ name: site.name }],
  creator: site.name,
  publisher: site.name,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: site.locale,
    url: site.domain,
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.name} — ${site.tagline}`,
    description: site.description
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 }
  },
  category: 'games'
};

export const viewport: Viewport = {
  themeColor: '#0b1220',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazir.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
