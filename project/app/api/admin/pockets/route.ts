import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';
import {
  listPocketBalances,
  recordAdjustment,
} from '@/lib/pockets';

/**
 * GET /api/admin/pockets
 * Returns all 6 pockets with current balances + inflow/outflow totals.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  try {
    const pockets = await listPocketBalances();
    return NextResponse.json({ pockets });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/pockets
 * Body: { action: 'adjust', pocketName, amount, description }
 *
 * Manual adjustment (positive or negative). Used by Wing to seed
 * initial balances or correct mistakes outside the auto-allocation
 * flow.
 */
export async function POST(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json();
    if (body.action !== 'adjust') {
      return NextResponse.json({ error: 'unknown action' }, { status: 400 });
    }
    const { pocketName, amount, description } = body;
    if (!pocketName || amount == null || !description) {
      return NextResponse.json(
        { error: 'pocketName, amount, description required' },
        { status: 400 },
      );
    }
    const txn = await recordAdjustment({ pocketName, amount: Number(amount), description });
    return NextResponse.json({ transaction: txn });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
