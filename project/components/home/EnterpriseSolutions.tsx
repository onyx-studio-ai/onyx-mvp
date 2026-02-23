'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Video, Database } from 'lucide-react';
import ContactModal from '@/components/ContactModal';

export default function EnterpriseSolutions() {
  const t = useTranslations('home.enterprise');
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [contactMessage, setContactMessage] = useState('');

  const solutions = [
    {
      icon: Video,
      title: t('lipSyncTitle'),
      description: t('lipSyncDescription'),
      iconColor: 'text-cyan-400',
      iconBg: 'bg-cyan-500/20',
    },
    {
      icon: Database,
      title: t('acousticTitle'),
      description: t('acousticDescription'),
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/20',
      disclaimer: t('acousticDisclaimer'),
    },
  ];

  const handleChatClick = (serviceName: string) => {
    setContactMessage(t('contactMessageTemplate', { serviceName }));
    setIsContactOpen(true);
  };

  return (
    <>
      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
        defaultMessage={contactMessage}
        department="HELLO"
        source="enterprise-solutions"
      />

      <section className="relative py-24 px-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.03),transparent_70%)]" />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              {t('sectionTitle')}
            </h2>
            <p className="text-lg text-gray-400 max-w-3xl mx-auto">
              {t('sectionSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {solutions.map((solution, index) => {
              const Icon = solution.icon;
              return (
                <div
                  key={index}
                  className="group relative p-8 rounded-2xl bg-gradient-to-b from-white/[0.03] to-white/[0.01] border border-white/10 hover:border-white/20 transition-all duration-300 hover:transform hover:-translate-y-1 flex flex-col"
                >
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="relative flex flex-col flex-1">
                    <div className={`w-14 h-14 rounded-xl ${solution.iconBg} flex items-center justify-center mb-6`}>
                      <Icon className={`w-7 h-7 ${solution.iconColor}`} />
                    </div>

                    <h3 className="text-2xl font-bold mb-4">{solution.title}</h3>

                    <p className="text-sm text-gray-400 mb-8 leading-relaxed flex-1">
                      {solution.description}
                    </p>

                    <button
                      onClick={() => handleChatClick(solution.title)}
                      className="inline-flex items-center justify-center w-full px-6 py-3 rounded-lg font-medium transition-all bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20"
                    >
                      {t('consultButton')}
                    </button>
                    {'disclaimer' in solution && solution.disclaimer && (
                      <p className="text-[11px] text-gray-500 mt-3 text-center leading-relaxed">
                        {solution.disclaimer}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
