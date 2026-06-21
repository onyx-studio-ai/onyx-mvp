/*
  Cloudflare Turnstile server-side verification.

  Self-managed (we call siteverify ourselves) rather than relying on Supabase's
  built-in captcha, because our signup/reset go through admin/server calls that
  bypass Supabase's captcha. One secret (TURNSTILE_SECRET_KEY in the server env)
  protects login + signup + reset uniformly.

  GRACEFUL ROLLOUT: if TURNSTILE_SECRET_KEY isn't set yet, verification is skipped
  (returns true) so nothing breaks before the secret is configured. Once the env
  is set, enforcement activates automatically.
*/

const SECRET = process.env.TURNSTILE_SECRET_KEY || '';

export function turnstileEnabled(): boolean {
  return !!SECRET;
}

export async function verifyTurnstile(token: string | null | undefined, ip?: string | null): Promise<boolean> {
  if (!SECRET) return true; // not configured yet — don't block anyone
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: SECRET, response: token });
    if (ip) body.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json();
    return !!data?.success;
  } catch {
    return false;
  }
}
