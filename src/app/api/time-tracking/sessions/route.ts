import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { pool } from '@/lib/pg';

export const runtime = 'nodejs';

// GET /api/time-tracking/sessions?userId=xxx&from=YYYY-MM-DD&to=YYYY-MM-DD
// Admin sees all users; VA sees only their own
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = session.user.role === 'admin';
    const { searchParams } = new URL(request.url);
    const specificUserId = searchParams.get('userId');

    // Admin with no userId filter: show all users' sessions
    // Admin with userId filter: show that user's sessions
    // VA: always own sessions only
    const filterByUser = !isAdmin || specificUserId !== null;
    const targetUserId = specificUserId || session.user.id;

    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const params: string[] = [];
    const whereClause = filterByUser ? `WHERE ts.user_id = $${params.push(targetUserId)}` : 'WHERE 1=1';

    let query = `
      SELECT
        ts.id,
        ts.user_id,
        u.name as user_name,
        ts.clocked_in_at,
        ts.clocked_out_at,
        ts.duration_minutes,
        ts.notes,
        ts.created_at
      FROM time_sessions ts
      JOIN users u ON u.id = ts.user_id
      ${whereClause}
    `;

    if (from) {
      params.push(from);
      query += ` AND ts.clocked_in_at >= $${params.length}`;
    }
    if (to) {
      params.push(to + 'T23:59:59Z');
      query += ` AND ts.clocked_in_at <= $${params.length}`;
    }

    query += ` ORDER BY ts.clocked_in_at DESC LIMIT 100`;

    const result = await pool.query(query, params);

    // Summary
    const completed = result.rows.filter(r => r.clocked_out_at);
    const totalMinutes = completed.reduce((sum: number, r) => sum + (r.duration_minutes || 0), 0);

    return NextResponse.json({
      sessions: result.rows,
      totalMinutes,
      totalHours: (totalMinutes / 60).toFixed(2),
    });
  } catch (error) {
    console.error('Sessions fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}
