import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { pool } from '@/lib/pg';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Find open session
    const open = await pool.query(
      `SELECT id, clocked_in_at FROM time_sessions WHERE user_id = $1 AND clocked_out_at IS NULL ORDER BY clocked_in_at DESC LIMIT 1`,
      [userId]
    );

    if (open.rows.length === 0) {
      return NextResponse.json({ error: 'Not clocked in' }, { status: 400 });
    }

    const sessionId = open.rows[0].id;
    const clockedInAt = new Date(open.rows[0].clocked_in_at);
    const now = new Date();
    const durationMinutes = Math.round((now.getTime() - clockedInAt.getTime()) / 60000);

    const result = await pool.query(
      `UPDATE time_sessions SET clocked_out_at = NOW(), duration_minutes = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, clocked_in_at, clocked_out_at, duration_minutes`,
      [durationMinutes, sessionId]
    );

    return NextResponse.json({ session: result.rows[0] });
  } catch (error) {
    console.error('Clock-out error:', error);
    return NextResponse.json({ error: 'Failed to clock out' }, { status: 500 });
  }
}
