import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { startCadence, pauseCadence, resumeCadence } from '@/lib/cadence';

export const runtime = 'nodejs';

const CADENCE_ENABLED = process.env.ENABLE_CADENCE === 'true';

// POST /api/cadence/actions - Start, pause, or resume a cadence
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!CADENCE_ENABLED) {
      return NextResponse.json({
        error: 'Cadence engine is disabled. Set ENABLE_CADENCE=true to activate.',
      }, { status: 403 });
    }

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const { action, leadId, cadenceId, reason, steps } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required (start, pause, resume)' }, { status: 400 });
    }

    switch (action) {
      case 'start': {
        if (!leadId) {
          return NextResponse.json({ error: 'leadId is required for start' }, { status: 400 });
        }
        if (!steps || !Array.isArray(steps) || steps.length === 0) {
          return NextResponse.json({ error: 'steps array is required (templateId + delayDays)' }, { status: 400 });
        }
        const id = await startCadence(leadId, steps);
        return NextResponse.json({ success: true, cadenceId: id }, { status: 201 });
      }

      case 'pause': {
        if (!cadenceId) {
          return NextResponse.json({ error: 'cadenceId is required for pause' }, { status: 400 });
        }
        const validReasons = ['paused_replied', 'paused_meeting', 'stopped_active_client'];
        if (!reason || !validReasons.includes(reason)) {
          return NextResponse.json({ error: 'reason is required (paused_replied, paused_meeting, stopped_active_client)' }, { status: 400 });
        }
        await pauseCadence(cadenceId, reason);
        return NextResponse.json({ success: true });
      }

      case 'resume': {
        if (!cadenceId) {
          return NextResponse.json({ error: 'cadenceId is required for resume' }, { status: 400 });
        }
        await resumeCadence(cadenceId);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Invalid action. Use start, pause, or resume.' }, { status: 400 });
    }
  } catch (error) {
    console.error('Cadence action error:', error);
    const message = error instanceof Error ? error.message : 'Failed to perform cadence action';
    // Only pass through known business-logic errors, not internal details
    const knownErrors = ['Lead not found', 'Lead has no email', 'Lead already in active cadence',
      'Cadence not found', 'Cadence is not active', 'Cadence is already active', 'Cadence cannot be resumed'];
    const status = knownErrors.some(e => message.includes(e)) ? 400 : 500;
    return NextResponse.json({ error: status === 400 ? message : 'Failed to perform cadence action' }, { status });
  }
}
