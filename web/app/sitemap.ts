import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: site.domain,                              lastModified: now, changeFrequency: 'weekly',  priority: 1 },
    { url: `${site.domain}/amoozesh-takhte-nard`,    lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${site.domain}/qavanin`,                 lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${site.domain}/harim-khosusi`,           lastModified: now, changeFrequency: 'yearly',  priority: 0.3 }
  ];
}
