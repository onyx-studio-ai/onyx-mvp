import type { SupabaseClient } from '@supabase/supabase-js';

/*
  Shared "awarded casting brief → production order" creation. Used by both:
    - the CLIENT picking an audition (app/api/client/requests/[id]/select)
    - Onyx converting an awarded case in admin (app/api/admin/casting/to-order)

  Creates one voice_order (status pending_payment) from the winning quote: client
  pays gross_amount, talent_price = net_amount, talent assigned via talent_id.
  Talent payout is handled OFFLINE by Onyx (monthly), so the order is a plain
  charge-the-client record — no marketplace split is stored here.

  brief_id makes the order traceable to the case AND guards against creating it
  twice (one order per brief).
*/

export type AwardBrief = {
  id: string;
  title?: string | null;
  content_type?: string | null;
  language?: string | null;
  brief?: string | null;
};
export type AwardQuote = {
  id: string;
  gross_amount?: number | null;
  net_amount?: number | null;
  talent_id?: string | null;
  currency?: string | null;
  included_revisions?: number | null; // revisions the talent offered → order's max_revisions
};

export async function createOrderFromAward(
  db: SupabaseClient,
  brief: AwardBrief,
  quote: AwardQuote,
  opts: { talentName?: string | null; orderEmail: string; scriptText?: string | null; scriptFileUrl?: string | null; deliveryDate?: string | null },
): Promise<{ ok: true; id: string; order_number: string; currency: string } | { ok: false; error: string; status: number }> {
  // One order per case — don't let a second selection / a second admin click
  // create a duplicate charge.
  const { data: existing } = await db.from('voice_orders').select('id, order_number').eq('brief_id', brief.id).maybeSingle();
  if (existing) return { ok: false, error: '此案已建立過製作單', status: 409 };

  const currency = (quote.currency as string) || 'USD';

  // order number: VO-YYMMDD-<seq of the day>
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  const { count } = await db.from('voice_orders').select('id', { count: 'exact', head: true }).gte('created_at', dayStart);
  const orderNumber = `VO-${ymd}-${String((count || 0) + 1).padStart(4, '0')}`;

  const { data: order, error } = await db.from('voice_orders').insert({
    order_number: orderNumber,
    email: opts.orderEmail,
    language: brief.language || '',
    voice_selection: (opts.talentName as string) || '',
    script_text: (opts.scriptText && opts.scriptText.trim()) || brief.brief || '',
    tone_style: 'Professional',
    use_case: brief.content_type || '',
    broadcast_rights: true,
    tier: 'tier-3',
    duration: 0,
    price: Number(quote.gross_amount) || 0,
    currency,
    project_name: brief.title || '',
    talent_id: quote.talent_id || null,
    talent_price: Number(quote.net_amount) || 0,
    status: 'pending_payment',
    payment_status: 'pending',
    revision_count: 0,
    max_revisions: Math.max(1, Math.trunc(Number(quote.included_revisions)) || 1), // from the talent's quote (999 = unlimited)
    rights_level: 'global',
    brief_id: brief.id,
    quote_id: quote.id,
    deadline: opts.deliveryDate || null,
    script_file_url: opts.scriptFileUrl || null,
  }).select('id, order_number').single();
  if (error) return { ok: false, error: error.message, status: 500 };

  return { ok: true, id: order.id as string, order_number: order.order_number as string, currency };
}
