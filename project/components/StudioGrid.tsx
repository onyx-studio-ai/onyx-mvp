'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export const StudioGrid = () => {
  const t = useTranslations('home.studioGrid');
  return (
    <section className="w-full bg-black py-24 px-4 md:px-8 border-t border-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="mb-14 text-center">
           <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
             {t('headingMain')} <span className="text-gray-500">{t('headingHighlight')}</span>
           </h2>
           <p className="text-gray-400 mt-4 max-w-2xl mx-auto text-lg">
             {t('description')}
           </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 h-64 md:h-[350px] relative overflow-hidden rounded-2xl group border border-white/5">
            <img
              src="/studio-main.jpg"
              alt=""
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100"
              style={{ objectPosition: 'center 60%' }}
            />
          </div>

          <div className="h-64 relative overflow-hidden rounded-2xl group border border-white/5">
            <img
              src="/studio-booth.jpg"
              alt=""
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100"
            />
          </div>

          <div className="h-64 relative overflow-hidden rounded-2xl group border border-white/5">
            <img
              src="/studio-daw.jpg"
              alt=""
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
