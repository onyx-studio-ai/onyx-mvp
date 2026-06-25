'use client';

/*
  /apply/voice is retired. The canonical voice-talent application is /apply/talent
  (the same form the recruitment emails link to): localized labels, AI/director as
  optional opt-ins, two consents, no voiceprint affidavit, no expected-rate step.
  Redirect here so old links/bookmarks land on the right form. The previous wizard
  is preserved in git history if any of its fields are ever needed.
*/

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';

export default function ApplyVoiceRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/apply/talent');
  }, [router]);
  return (
    <main className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
      <p className="text-gray-500 text-sm">前往配音員報名…</p>
    </main>
  );
}
