import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { pool } from '@/lib/pg';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay() + (startOfDay.getDay() === 0 ? -6 : 1)); // Monday

    // Open session
    const openSession = await pool.query(
      `SELECT id, clocked_in_at FROM time_sessions WHERE user_id = $1 AND clocked_out_at IS NULL ORDER BY clocked_in_at DESC LIMIT 1`,
      [userId]
    );

    // Today's completed minutes
    const todayResult = await pool.query(
      `SELECT COALESCE(SUM(duration_minutes), 0) as total
       FROM time_sessions
       WHERE user_id = $1 AND clocked_in_at >= $2 AND clocked_out_at IS NOT NULL`,
      [userId, startOfDay.toISOString()]
    );

    // This week's completed minutes
    const weekResult = await pool.query(
      `SELECT COALESCE(SUM(duration_minutes), 0) as total
       FROM time_sessions
       WHERE user_id = $1 AND clocked_in_at >= $2 AND clocked_out_at IS NOT NULL`,
      [userId, startOfWeek.toISOString()]
    );

    const isClockedIn = openSession.rows.length > 0;
    const clockedInAt = isClockedIn ? openSession.rows[0].clocked_in_at : null;
    const currentSessionMinutes = isClockedIn
      ? Math.round((now.getTime() - new Date(clockedInAt).getTime()) / 60000)
      : 0;

    return NextResponse.json({
      isClockedIn,
      clockedInAt,
      todayMinutes: Number(todayResult.rows[0].total) + currentSessionMinutes,
      weekMinutes: Number(weekResult.rows[0].total) + currentSessionMinutes,
    });
  } catch (error) {
    console.error('Time status error:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
