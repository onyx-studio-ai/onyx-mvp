'use client';

import { useTranslations } from 'next-intl';

const BRANDS = [
  'Spotify',
  'IYUNO',
  'Appen',
  'Mercedes-Benz',
  'TSMC',
  'Coca-Cola',
  'Yahoo',
];

export default function BrandMarquee() {
  const t = useTranslations('home.brandMarquee');
  const row = [...BRANDS, ...BRANDS, ...BRANDS, ...BRANDS];

  return (
    <section className="py-24 border-y border-white/5 bg-black/30 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-center text-sm font-light text-gray-500 uppercase tracking-[0.3em] mb-10">
          {t('sectionTitle')}
        </h2>
      </div>


      <div className="relative">
        <div className="marquee-track flex items-center whitespace-nowrap">
          {row.map((name, i) => (
            <span
              key={i}
              className="flex-shrink-0 mx-10 text-sm font-medium uppercase tracking-[0.2em] text-gray-600 hover:text-white transition-colors duration-400 cursor-default select-none"
            >
              {name}
            </span>
          ))}
        </div>

        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-black to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-black to-transparent pointer-events-none z-10" />
      </div>

      <style jsx>{`
        .marquee-track {
          animation: marquee 40s linear infinite;
          will-change: transform;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  );
}
