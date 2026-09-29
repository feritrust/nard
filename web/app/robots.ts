import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // پنل مدیریت و مسیرهای داخلی نباید ایندکس شوند
        disallow: ['/admin', '/admin/', '/api/', '/play']
      }
    ],
    sitemap: `${site.domain}/sitemap.xml`,
    host: site.domain
  };
}
