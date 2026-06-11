import { NextRequest, NextResponse } from 'next/server';

// Promo codes are stored in env var as comma-separated CODE:PERCENT pairs.
// Example: PROMO_CODES=HUNT50:50,LAUNCH30:30,WELCOME20:20
// Add/remove codes by updating the Vercel env var — no code change needed.
function parsePromoCodes(): Record<string, number> {
  const raw = process.env.PROMO_CODES || '';
  const result: Record<string, number> = {};
  if (!raw.trim()) return result;

  for (const pair of raw.split(',')) {
    const parts = pair.trim().split(':');
    if (parts.length !== 2) continue;
    const code = parts[0].trim().toUpperCase();
    const pct = Number(parts[1].trim());
    if (code && Number.isFinite(pct) && pct > 0 && pct <= 100) {
      result[code] = pct;
    }
  }
  return result;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const codes = parsePromoCodes();
  const discountPercent = codes[code];

  if (discountPercent === undefined) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({ valid: true, discountPercent, code });
}
