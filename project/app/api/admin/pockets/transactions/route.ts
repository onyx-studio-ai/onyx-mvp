import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOnly } from '@/app/api/admin/_utils/requireAdmin';
import { listPocketTransactions } from '@/lib/pockets';

/**
 * GET /api/admin/pockets/transactions?pocket_id=xxx&limit=50
 *
 * Returns recent transactions for a specific pocket. Wing uses this
 * to expand a pocket card and see its history.
 */
export async function GET(request: NextRequest) {
  const unauthorized = requireAdminOnly(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const pocketId = searchParams.get('pocket_id');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  if (!pocketId) {
    return NextResponse.json({ error: 'pocket_id required' }, { status: 400 });
  }

  try {
    const transactions = await listPocketTransactions(pocketId, limit);
    return NextResponse.json({ transactions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
