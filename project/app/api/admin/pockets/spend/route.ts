import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';
import { recordSpend } from '@/lib/pockets';

/**
 * POST /api/admin/pockets/spend
 * Body: { pocketName, amount, description, occurredAt? }
 *
 * Records a spend (negative transaction) against a named pocket.
 * amount must be positive; the helper flips the sign before storing.
 */
export async function POST(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    const { pocketName, amount, description, occurredAt } = body;
    if (!pocketName || amount == null || !description) {
      return NextResponse.json(
        { error: 'pocketName, amount, description required' },
        { status: 400 },
      );
    }
    const txn = await recordSpend({
      currency: typeof body.currency === 'string' ? body.currency : undefined,
      pocketName,
      amount: Number(amount),
      description,
      occurredAt,
    });
    return NextResponse.json({ transaction: txn });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
