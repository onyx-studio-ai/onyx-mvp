'use client';

/*
  AI vs real-human browse switch, shared by /voices (AI catalogue) and /talents
  (human roster). Lands on either and one tap goes to the other — the two ways to
  "browse voices".
*/

import { Link, usePathname } from '@/i18n/navigation';
import { useLocale } from 'next-intl';

export default function BrowseVoiceTabs() {
  const locale = useLocale();
  const isZhCN = locale === 'zh-CN';
  const isZh = locale.startsWith('zh');
  const tx = (tw: string, cn: string, en: string) => (isZhCN ? cn : isZh ? tw : en);
  const pathname = usePathname();
  const aiActive = pathname === '/voices';
  const base = 'inline-flex items-center justify-center px-5 py-2 rounded-full text-sm font-medium transition-colors';

  return (
    <div className="inline-flex gap-1 p-1 rounded-full bg-white/[0.04] border border-white/10 mb-6">
      <Link href="/voices" className={`${base} ${aiActive ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white' : 'text-gray-300 hover:text-white'}`}>
        {tx('AI 聲音', 'AI 声音', 'AI Voices')}
      </Link>
      <Link href="/talents" className={`${base} ${!aiActive ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white' : 'text-gray-300 hover:text-white'}`}>
        {tx('真人配音員', '真人配音员', 'Human Talent')}
      </Link>
    </div>
  );
}
