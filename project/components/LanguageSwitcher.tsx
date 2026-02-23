'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { routing, type Locale } from '@/i18n/routing';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const localeLabels: Record<string, string> = {
  en: 'English',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
};

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitch = (newLocale: Locale) => {
    router.replace(pathname, { locale: newLocale });
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all',
          'text-gray-400 hover:text-white hover:bg-white/10',
          open && 'text-white bg-white/10'
        )}
        aria-label="Switch language"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{localeLabels[locale]}</span>
      </button>

      <div
        className={cn(
          'absolute right-0 top-full mt-2 min-w-[140px] rounded-xl overflow-hidden',
          'bg-black/70 backdrop-blur-xl border border-white/10 shadow-2xl',
          'transition-all duration-200 origin-top-right',
          open
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-95 pointer-events-none'
        )}
      >
        {routing.locales.map((loc) => (
          <button
            key={loc}
            onClick={() => handleSwitch(loc)}
            className={cn(
              'w-full text-left px-4 py-2.5 text-sm transition-colors',
              loc === locale
                ? 'text-white bg-white/10'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
          >
            {localeLabels[loc]}
          </button>
        ))}
      </div>
    </div>
  );
}
