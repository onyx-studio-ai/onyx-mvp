import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Phase 5 / Profit First — pocket allocation helpers.
 *
 * Every helper here uses the service-role client because allocation
 * is driven by admin-only flows (the earnings PATCH handler, the
 * /admin/pockets UI). Never expose these to a public route.
 */

export interface Pocket {
  id: string;
  name: string;
  display_name: string;
  display_name_zh: string;
  allocation_percent: number;
  emoji: string | null;
  sort_order: number;
}

export interface PocketBalance extends Pocket {
  balance: number;
  inflow_total: number;
  outflow_total: number;
  txn_count: number;
}

export interface PocketTransaction {
  id: string;
  pocket_id: string;
  amount: number;
  currency: string;
  type: 'income_allocation' | 'spend' | 'buyout_outflow' | 'adjustment';
  source_earning_id: string | null;
  description: string | null;
  occurred_at: string;
  created_at: string;
}

function db(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function listPockets(): Promise<Pocket[]> {
  const { data, error } = await db()
    .from('pockets')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as Pocket[];
}

/**
 * Returns each pocket annotated with its current balance, derived from
 * the sum of all transactions (income_allocation, spend (negative),
 * buyout_outflow (negative), adjustment (signed)).
 */
export async function listPocketBalances(): Promise<PocketBalance[]> {
  const supabase = db();
  const [pocketsRes, txnsRes] = await Promise.all([
    supabase.from('pockets').select('*').order('sort_order', { ascending: true }),
    supabase.from('pocket_transactions').select('pocket_id, amount'),
  ]);

  if (pocketsRes.error) throw new Error(pocketsRes.error.message);
  if (txnsRes.error) throw new Error(txnsRes.error.message);

  const aggMap = new Map<string, { inflow: number; outflow: number; count: number }>();
  for (const t of txnsRes.data || []) {
    const agg = aggMap.get(t.pocket_id) || { inflow: 0, outflow: 0, count: 0 };
    const amt = Number(t.amount) || 0;
    if (amt >= 0) agg.inflow += amt;
    else agg.outflow += Math.abs(amt);
    agg.count += 1;
    aggMap.set(t.pocket_id, agg);
  }

  return (pocketsRes.data || []).map((p: Pocket) => {
    const agg = aggMap.get(p.id) || { inflow: 0, outflow: 0, count: 0 };
    return {
      ...p,
      balance: Math.round((agg.inflow - agg.outflow) * 100) / 100,
      inflow_total: Math.round(agg.inflow * 100) / 100,
      outflow_total: Math.round(agg.outflow * 100) / 100,
      txn_count: agg.count,
    };
  });
}

/**
 * Splits `incomeAmount` across all 6 pockets per their allocation_percent.
 *
 * Idempotent w.r.t. source_earning_id: if income_allocation transactions
 * already exist for this earning, returns the existing rows instead of
 * double-allocating. This matters because the trigger is "Wing ticks
 * payment_received" — she may tick + untick + re-tick.
 */
export async function allocateIncome(params: {
  sourceEarningId: string;
  incomeAmount: number;
  description?: string;
}): Promise<{ allocated: boolean; reason?: string }> {
  const { sourceEarningId, incomeAmount, description } = params;
  if (!Number.isFinite(incomeAmount) || incomeAmount <= 0) {
    return { allocated: false, reason: 'incomeAmount must be positive' };
  }

  const supabase = db();

  // Idempotency: skip if we already allocated this earning
  const { data: existing } = await supabase
    .from('pocket_transactions')
    .select('id')
    .eq('source_earning_id', sourceEarningId)
    .eq('type', 'income_allocation')
    .limit(1);
  if (existing && existing.length > 0) {
    return { allocated: false, reason: 'already allocated' };
  }

  const pockets = await listPockets();
  if (pockets.length === 0) {
    return { allocated: false, reason: 'no pockets configured' };
  }

  const rows = pockets.map((p) => ({
    pocket_id: p.id,
    amount: Math.round(incomeAmount * Number(p.allocation_percent) * 100) / 100,
    currency: 'USD',
    type: 'income_allocation' as const,
    source_earning_id: sourceEarningId,
    description: description || `Auto-allocated from earning ${sourceEarningId}`,
  }));

  const { error } = await supabase.from('pocket_transactions').insert(rows);
  if (error) throw new Error(error.message);
  return { allocated: true };
}

/** Reverse allocation if Wing un-ticks payment_received. */
export async function reverseAllocation(sourceEarningId: string): Promise<{ reversed: number }> {
  const supabase = db();
  const { data, error } = await supabase
    .from('pocket_transactions')
    .delete()
    .eq('source_earning_id', sourceEarningId)
    .eq('type', 'income_allocation')
    .select('id');
  if (error) throw new Error(error.message);
  return { reversed: data?.length || 0 };
}

/**
 * Buyout = Wing pays talent a lump sum. Deduct from Talent pocket
 * (negative amount). Idempotent per source_earning_id.
 */
export async function recordBuyoutOutflow(params: {
  sourceEarningId: string;
  payoutAmount: number;
  description?: string;
}): Promise<{ recorded: boolean; reason?: string }> {
  const { sourceEarningId, payoutAmount, description } = params;
  if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
    return { recorded: false, reason: 'payoutAmount must be positive' };
  }

  const supabase = db();
  const { data: existing } = await supabase
    .from('pocket_transactions')
    .select('id')
    .eq('source_earning_id', sourceEarningId)
    .eq('type', 'buyout_outflow')
    .limit(1);
  if (existing && existing.length > 0) {
    return { recorded: false, reason: 'already recorded' };
  }

  const { data: talentPocket, error: pocketErr } = await supabase
    .from('pockets')
    .select('id')
    .eq('name', 'talent')
    .single();
  if (pocketErr || !talentPocket) {
    throw new Error('talent pocket not found');
  }

  const { error } = await supabase.from('pocket_transactions').insert({
    pocket_id: talentPocket.id,
    amount: -Math.abs(Number(payoutAmount)),
    currency: 'USD',
    type: 'buyout_outflow',
    source_earning_id: sourceEarningId,
    description: description || `Buyout outflow for earning ${sourceEarningId}`,
  });
  if (error) throw new Error(error.message);
  return { recorded: true };
}

export async function reverseBuyoutOutflow(sourceEarningId: string): Promise<{ reversed: number }> {
  const supabase = db();
  const { data, error } = await supabase
    .from('pocket_transactions')
    .delete()
    .eq('source_earning_id', sourceEarningId)
    .eq('type', 'buyout_outflow')
    .select('id');
  if (error) throw new Error(error.message);
  return { reversed: data?.length || 0 };
}

/** Manual spend by Wing — picks a pocket and an amount to deduct. */
export async function recordSpend(params: {
  pocketName: string;
  amount: number;
  description: string;
  occurredAt?: string;
}): Promise<PocketTransaction> {
  const { pocketName, amount, description, occurredAt } = params;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('amount must be positive');
  }
  if (!description?.trim()) {
    throw new Error('description is required for spend');
  }

  const supabase = db();
  const { data: pocket, error: pocketErr } = await supabase
    .from('pockets')
    .select('id')
    .eq('name', pocketName)
    .single();
  if (pocketErr || !pocket) {
    throw new Error(`pocket "${pocketName}" not found`);
  }

  const { data, error } = await supabase
    .from('pocket_transactions')
    .insert({
      pocket_id: pocket.id,
      amount: -Math.abs(amount),
      currency: 'USD',
      type: 'spend',
      description: description.trim(),
      occurred_at: occurredAt || new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PocketTransaction;
}

/** Manual adjustment by Wing — positive or negative. Seed balances, fix mistakes, etc. */
export async function recordAdjustment(params: {
  pocketName: string;
  amount: number;
  description: string;
}): Promise<PocketTransaction> {
  const { pocketName, amount, description } = params;
  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error('amount must be non-zero');
  }
  if (!description?.trim()) {
    throw new Error('description is required for adjustment');
  }

  const supabase = db();
  const { data: pocket, error: pocketErr } = await supabase
    .from('pockets')
    .select('id')
    .eq('name', pocketName)
    .single();
  if (pocketErr || !pocket) {
    throw new Error(`pocket "${pocketName}" not found`);
  }

  const { data, error } = await supabase
    .from('pocket_transactions')
    .insert({
      pocket_id: pocket.id,
      amount,
      currency: 'USD',
      type: 'adjustment',
      description: description.trim(),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PocketTransaction;
}

export async function listPocketTransactions(pocketId: string, limit = 50): Promise<PocketTransaction[]> {
  const { data, error } = await db()
    .from('pocket_transactions')
    .select('*')
    .eq('pocket_id', pocketId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data || []) as PocketTransaction[];
}
