/**
 * Centralised, validated access to Supabase env vars for server-side code.
 *
 * Why this file exists:
 *
 * The API routes used to read env vars with patterns like
 *   `process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hnblwckpnapsdladcjql.supabase.co'`
 * which **silently falls back to a hardcoded URL** if the env var goes
 * missing. When that hardcoded project was paused / deleted, every API
 * route quietly tried to talk to a dead URL and produced cryptic
 * "TypeError: fetch failed" errors with no hint about the real cause.
 *
 * Another bad pattern was
 *   `process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`
 * which lets a route that *needs* service-role privileges silently
 * downgrade to anon-key reads, where RLS may then mask the data and
 * make the bug look like "the DB doesn't have the row" rather than
 * "we forgot to ship the service-role key".
 *
 * Use the helpers here instead of constructing clients ad-hoc:
 *
 *   const supabase = getSupabaseServiceClient();   // writes, admin reads
 *   const supabase = getSupabaseAnonClient();      // public reads only
 *
 * Both throw `MissingSupabaseEnv` with the specific missing var(s) named
 * if the env is not configured — let it bubble; the route handler's
 * outer try/catch will turn it into a 500 with a descriptive message.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export class MissingSupabaseEnv extends Error {
  constructor(missing: string[]) {
    super(`Supabase is not configured: missing ${missing.join(', ')}. ` +
          `Check the Vercel environment variables for this deployment.`);
    this.name = 'MissingSupabaseEnv';
  }
}

function requireUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !url.startsWith('http')) {
    throw new MissingSupabaseEnv(['NEXT_PUBLIC_SUPABASE_URL']);
  }
  return url;
}

function requireServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new MissingSupabaseEnv(['SUPABASE_SERVICE_ROLE_KEY']);
  return key;
}

function requireAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new MissingSupabaseEnv(['NEXT_PUBLIC_SUPABASE_ANON_KEY']);
  return key;
}

/**
 * Service-role client — full admin privileges, bypasses RLS.
 * Use for: privileged DB writes (orders), reading rows that anon can't see,
 * Storage uploads, Auth admin actions (signup confirmation, password reset).
 *
 * NEVER expose to the browser. NEVER fall back to anon — if the service
 * role key is missing this MUST fail so the bug surfaces immediately.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  return createClient(requireUrl(), requireServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Anon-key client — public read access, RLS applies.
 * Use for: public-facing reads (e.g. the talents listing).
 */
export function getSupabaseAnonClient(): SupabaseClient {
  return createClient(requireUrl(), requireAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Helper for API route handlers: turn a MissingSupabaseEnv (or any other
 * thrown error) into a 500 response with a useful message.
 *
 * Example:
 *   try { ... } catch (err) { return supabaseErrorResponse(err, 'orders/voice'); }
 */
export function supabaseErrorResponse(err: unknown, routeName: string) {
  if (err instanceof MissingSupabaseEnv) {
    console.error(`[${routeName}] Supabase env missing:`, err.message);
    return NextResponse.json(
      { error: 'Service temporarily unavailable. The team has been notified.' },
      { status: 503 }
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${routeName}] Unexpected error:`, message);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
