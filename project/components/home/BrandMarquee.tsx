'use client';

// ─────────────────────────────────────────────────────────────────────────────
// BrandMarquee is LOCKED pending Wing's confirmation of which brands are
// genuinely Onyx clients with rights to display their logos.
//
// Previous version hardcoded ['Spotify','IYUNO','Appen','Mercedes-Benz','TSMC',
// 'Coca-Cola','Yahoo']. Showing those names without active trademark licenses
// is false advertising / trademark risk.
//
// To re-enable: replace the inert export below with a real <BrandMarquee /> that
// renders only clients you have written permission from. Optionally read from a
// Supabase `client_logos` table with `is_authorized=true` records.
// ─────────────────────────────────────────────────────────────────────────────

export default function BrandMarquee() {
  return null;
}
