import { redirect } from 'next/navigation';

/**
 * /music/catalog has been retired in favour of a simpler funnel.
 * Customers now reach music production via /music → contact form.
 * This redirect keeps any inbound link / bookmark working.
 */
export default async function MusicCatalogRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/music`);
}
