import { redirect } from 'next/navigation';

/**
 * /music/create (self-service music order) has been retired.
 * Music projects are bespoke (vibe, length, instruments, licensing) so
 * we route everything through the brief form → manual quote pipeline.
 * This redirect keeps any inbound link / bookmark working.
 */
export default async function MusicCreateRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/contact?source=music-project`);
}
