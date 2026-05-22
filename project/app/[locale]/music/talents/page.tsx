import { redirect } from 'next/navigation';

/**
 * /music/talents (Singer selector) is locked while Onyx pivots music
 * services to pure AI generation. We have no verified Singer talents in
 * the catalogue today and Wing prefers self-service via /music/create
 * (4-field form → AI generation) instead of pretending we have a Singer
 * roster.
 *
 * To re-enable: delete this file and restore the previous Singer-selection
 * UI from git history. Onyx 1500-talent network can be re-introduced when
 * Wing signs Singer TTS agreements + the talents have voice_id_status
 * = 'verified'.
 */
export default async function MusicTalentsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/music/create`);
}
