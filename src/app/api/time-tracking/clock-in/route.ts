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

    // Check if already clocked in (open session exists)
    const existing = await pool.query(
      `SELECT id FROM time_sessions WHERE user_id = $1 AND clocked_out_at IS NULL ORDER BY clocked_in_at DESC LIMIT 1`,
      [userId]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Already clocked in' }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO time_sessions (user_id) VALUES ($1) RETURNING id, clocked_in_at`,
      [userId]
    );

    return NextResponse.json({ session: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Clock-in error:', error);
    return NextResponse.json({ error: 'Failed to clock in' }, { status: 500 });
  }
}
