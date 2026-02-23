'use client';

import { useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { useScrollAnimation } from '@/hooks/use-scroll-animation';

export default function Testimonials() {
  const t = useTranslations('home.testimonials');
  const { ref: titleRef, isVisible: titleVisible } = useScrollAnimation();

  const testimonials = [
    { quote: t('quote1'), author: t('author1'), role: t('role1'), rating: 5 },
    { quote: t('quote2'), author: t('author2'), role: t('role2'), rating: 5 },
    { quote: t('quote3'), author: t('author3'), role: t('role3'), rating: 5 },
  ];

  return (
    <section className="relative py-24 px-4 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-[#0a0a0a] to-[#050505]" />

      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-1/2 left-1/3 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <div ref={titleRef} className={`text-center mb-16 fade-up-element ${titleVisible ? 'fade-up-visible' : ''}`}>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            {t('sectionTitle')}
          </h2>
          <p className="text-gray-400 text-lg">
            {t('sectionSubtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm border border-white/10 rounded-2xl p-8 h-full hover:border-white/20 transition-all duration-300">
                <div className="flex gap-1 mb-6">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-5 h-5 fill-yellow-500 text-yellow-500"
                    />
                  ))}
                </div>

                <blockquote className="text-gray-300 text-base leading-relaxed mb-8">
                  "{testimonial.quote}"
                </blockquote>

                <div className="pt-6 border-t border-white/10">
                  <p className="text-white font-semibold mb-1">
                    {testimonial.author}
                  </p>
                  <p className="text-gray-500 text-sm">
                    {testimonial.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
