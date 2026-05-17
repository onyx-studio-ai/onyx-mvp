import type { MetadataRoute } from 'next';

const BASE_URL = 'https://www.onyxstudios.ai';
const PRELAUNCH_MODE = process.env.PRELAUNCH_MODE === 'true' || process.env.VERCEL_ENV === 'preview';

export default function robots(): MetadataRoute.Robots {
  if (PRELAUNCH_MODE) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/dashboard/',
          '/auth/',
          '/checkout/',
          '/verify/',
          '/voice-id/',
          '/*/admin/',
          '/*/dashboard/',
          '/*/auth/',
          '/*/checkout/',
          '/*/verify/',
          '/*/voice-id/',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
