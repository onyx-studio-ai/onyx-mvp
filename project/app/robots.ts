import type { MetadataRoute } from 'next';

const BASE_URL = 'https://www.onyxstudios.ai';
const PRELAUNCH_MODE = process.env.PRELAUNCH_MODE === 'true' || process.env.VERCEL_ENV === 'preview';

export default function robots(): MetadataRoute.Robots {
  if (PRELAUNCH_MODE) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }

  const privateRoutes = [
    '/admin/',
    '/dashboard/',
    '/auth/',
    '/checkout/',
    '/paddle-checkout/',
    '/verify/',
    '/voice-id/',
    '/*/admin/',
    '/*/dashboard/',
    '/*/auth/',
    '/*/checkout/',
    '/*/paddle-checkout/',
    '/*/verify/',
    '/*/voice-id/',
  ];

  return {
    rules: [
      // Standard crawlers
      {
        userAgent: '*',
        allow: '/',
        disallow: privateRoutes,
      },
      // LLM crawlers — explicitly allowed for GEO/AEO discoverability
      { userAgent: 'GPTBot', allow: '/', disallow: privateRoutes },
      { userAgent: 'ClaudeBot', allow: '/', disallow: privateRoutes },
      { userAgent: 'PerplexityBot', allow: '/', disallow: privateRoutes },
      { userAgent: 'Googlebot-Extended', allow: '/', disallow: privateRoutes },
      { userAgent: 'anthropic-ai', allow: '/', disallow: privateRoutes },
      { userAgent: 'cohere-ai', allow: '/', disallow: privateRoutes },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
