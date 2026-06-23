'use client';

/*
  Rescue for password set/reset links. Supabase redirects recovery links to its
  configured Site URL (the homepage) unless the exact reset-password URL is in the
  redirect allowlist — so users land on '/' with the recovery token in the hash and
  never see the set-password form. This forwards them to /auth/reset-password with
  the hash intact, so the flow works regardless of the Supabase allowlist config.
  (Proper fix is still to allowlist the URL in Supabase — this is belt-and-suspenders.)
*/

import { useEffect } from 'react';

export default function RecoveryRedirect() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token') || !hash.includes('type=recovery')) return;
    if (window.location.pathname.includes('/auth/reset-password')) return;
    window.location.replace(`/auth/reset-password${hash}`);
  }, []);
  return null;
}
