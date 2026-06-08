import { getTranslations } from 'next-intl/server';

const BASE_URL = 'https://www.onyxstudios.ai';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  const ogImage = {
    url: '/logo-og.png',
    width: 1200,
    height: 1200,
    alt: 'AI Tools Directory — Onyx Studios',
  };
  return {
    title: t('toolsTitle'),
    description: t('toolsDescription'),
    alternates: {
      canonical: '/tools',
      languages: {
        en: '/tools',
        'zh-TW': '/zh-TW/tools',
        'zh-CN': '/zh-CN/tools',
      },
    },
    openGraph: {
      type: 'website' as const,
      siteName: 'Onyx Studios',
      title: t('toolsTitle'),
      description: t('toolsDescription'),
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: t('toolsTitle'),
      description: t('toolsDescription'),
      images: [ogImage],
    },
  };
}

// ItemList schema — helps Google surface individual tools in rich results
const itemListJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'AI Tools for Voice & Audio Professionals',
  description:
    'Curated AI tools for voice actors, audio engineers, and music creators — TTS, voice cloning, music generation, dubbing, and transcription.',
  url: `${BASE_URL}/tools`,
  numberOfItems: 20,
  itemListElement: [
    { '@type': 'ListItem', position: 1,  name: 'ElevenLabs',        url: 'https://elevenlabs.io' },
    { '@type': 'ListItem', position: 2,  name: 'Murf.ai',           url: 'https://murf.ai' },
    { '@type': 'ListItem', position: 3,  name: 'Play.ht',           url: 'https://play.ht' },
    { '@type': 'ListItem', position: 4,  name: 'Resemble AI',       url: 'https://www.resemble.ai' },
    { '@type': 'ListItem', position: 5,  name: 'Suno',              url: 'https://suno.com' },
    { '@type': 'ListItem', position: 6,  name: 'Udio',              url: 'https://udio.com' },
    { '@type': 'ListItem', position: 7,  name: 'AIVA',              url: 'https://www.aiva.ai' },
    { '@type': 'ListItem', position: 8,  name: 'Stable Audio',      url: 'https://stability.ai/stable-audio' },
    { '@type': 'ListItem', position: 9,  name: 'HeyGen',            url: 'https://www.heygen.com' },
    { '@type': 'ListItem', position: 10, name: 'Rask.ai',           url: 'https://www.rask.ai' },
    { '@type': 'ListItem', position: 11, name: 'Dubverse',          url: 'https://dubverse.ai' },
    { '@type': 'ListItem', position: 12, name: 'Papercup',          url: 'https://www.papercup.com' },
    { '@type': 'ListItem', position: 13, name: 'Adobe Podcast',     url: 'https://podcast.adobe.com' },
    { '@type': 'ListItem', position: 14, name: 'Descript',          url: 'https://www.descript.com' },
    { '@type': 'ListItem', position: 15, name: 'Cleanvoice',        url: 'https://cleanvoice.ai' },
    { '@type': 'ListItem', position: 16, name: 'Krisp',             url: 'https://krisp.ai' },
    { '@type': 'ListItem', position: 17, name: 'Whisper (OpenAI)',  url: 'https://github.com/openai/whisper' },
    { '@type': 'ListItem', position: 18, name: 'Otter.ai',          url: 'https://otter.ai' },
    { '@type': 'ListItem', position: 19, name: 'AssemblyAI',        url: 'https://www.assemblyai.com' },
    { '@type': 'ListItem', position: 20, name: 'Deepgram',          url: 'https://deepgram.com' },
  ],
};

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      {children}
    </>
  );
}
