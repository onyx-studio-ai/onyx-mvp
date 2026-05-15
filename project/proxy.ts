import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);
const BASE_URL = 'https://www.onyxstudios.ai';
const PRELAUNCH_MODE = process.env.PRELAUNCH_MODE === 'true';
const PREVIEW_USER = process.env.PREVIEW_BASIC_AUTH_USER || '';
const PREVIEW_PASSWORD = process.env.PREVIEW_BASIC_AUTH_PASSWORD || '';

function normalizePath(pathname: string) {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function stripLocalePrefix(pathname: string) {
  for (const locale of routing.locales) {
    const localePrefix = `/${locale}`;
    if (pathname === localePrefix) {
      return '/';
    }
    if (pathname.startsWith(`${localePrefix}/`)) {
      return pathname.slice(localePrefix.length) || '/';
    }
  }
  return pathname;
}

function getLocaleFromPath(pathname: string) {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return routing.defaultLocale;
}

function buildLocalePath(locale: string, normalizedPath: string) {
  const path = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  if (locale === routing.defaultLocale) {
    return path;
  }
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}

function shouldNoIndex(normalizedPath: string) {
  const blockedPrefixes = ['/admin', '/dashboard', '/auth', '/checkout', '/verify', '/voice-id'];
  return blockedPrefixes.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));
}

function parseBasicAuth(header: string | null): { user: string; password: string } | null {
  if (!header || !header.startsWith('Basic ')) {
    return null;
  }
  try {
    const decoded = atob(header.slice(6));
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) {
      return null;
    }
    return {
      user: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function getUnauthorizedResponse() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Onyx Preview", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}

export default function proxy(request: NextRequest) {
  if (PRELAUNCH_MODE) {
    // Fail closed in prelaunch mode if credentials are not configured.
    if (!PREVIEW_USER || !PREVIEW_PASSWORD) {
      return new NextResponse('Preview protection is enabled but credentials are missing.', {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const auth = parseBasicAuth(request.headers.get('authorization'));
    if (!auth || auth.user !== PREVIEW_USER || auth.password !== PREVIEW_PASSWORD) {
      return getUnauthorizedResponse();
    }
  }

  const pathname = request.nextUrl.pathname;
  const normalizedPath = stripLocalePrefix(pathname);
  const normalizedPathname = normalizePath(normalizedPath);

  const response = intlMiddleware(request);
  const currentLocale = getLocaleFromPath(pathname);
  const canonicalPath = buildLocalePath(currentLocale, normalizedPathname);

  const linkEntries = [`<${BASE_URL}${canonicalPath}>; rel="canonical"`];

  for (const locale of routing.locales) {
    const localePath = buildLocalePath(locale, normalizedPathname);
    linkEntries.push(`<${BASE_URL}${localePath}>; rel="alternate"; hreflang="${locale}"`);
  }

  const defaultPath = buildLocalePath(routing.defaultLocale, normalizedPathname);
  linkEntries.push(`<${BASE_URL}${defaultPath}>; rel="alternate"; hreflang="x-default"`);

  response.headers.set('Link', linkEntries.join(', '));

  if (PRELAUNCH_MODE || shouldNoIndex(normalizedPathname)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  return response;
}

export const config = {
  matcher: [
    // Skip assets/metadata routes (robots.txt, sitemap.xml, etc.) and internal paths.
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
