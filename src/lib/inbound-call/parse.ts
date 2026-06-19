/**
 * Pure parser for the ElevenLabs "post_call_transcription" webhook payload
 * emitted by the 24/7 answering-service agent.
 *
 * The agent collects caller details via its data-collection fields; this turns
 * the (loosely typed) webhook body into a clean, predictable shape the route
 * can route on. No I/O, fully unit-testable.
 *
 * Payload reference (ElevenLabs Conversational AI post-call webhook):
 *   {
 *     type: "post_call_transcription",
 *     event_timestamp: 1718800000,
 *     data: {
 *       agent_id, conversation_id, status,
 *       metadata: { call_duration_secs, phone_call: { external_number, direction } },
 *       analysis: {
 *         transcript_summary, call_successful,
 *         data_collection_results: { <field>: { value, rationale } | <string> }
 *       }
 *     }
 *   }
 */

export interface InboundCallData {
  conversationId: string | null;
  agentId: string | null;
  callerName: string | null;
  companyName: string | null;
  /** Phone the caller gave / read back during the call. */
  phone: string | null;
  /** Caller-ID number from the carrier (fallback when no spoken number). */
  callerIdNumber: string | null;
  email: string | null;
  location: string | null;
  serviceType: string | null;
  messageNotes: string | null;
  summary: string | null;
  callSuccessful: string | null;
  durationSecs: number | null;
}

type Json = Record<string, unknown>;

function asObj(v: unknown): Json | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : undefined;
}

/** Extract a data-collection field's value, tolerating both `{value}` and raw-string shapes. */
function dcValue(results: Json | undefined, key: string): string | null {
  if (!results) return null;
  const raw = results[key];
  if (raw == null) return null;
  if (typeof raw === 'string') return raw.trim() || null;
  const obj = asObj(raw);
  if (obj && 'value' in obj) {
    const v = obj.value;
    if (v == null) return null;
    const s = String(v).trim();
    return s || null;
  }
  return null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

/**
 * Parse a raw ElevenLabs post-call webhook body into InboundCallData.
 * Always returns a fully-populated object (nulls for anything missing) so the
 * caller never has to defend against undefined.
 */
export function parseAnsweringServicePayload(body: unknown): InboundCallData {
  const root = asObj(body) ?? {};
  const data = asObj(root.data) ?? {};
  const metadata = asObj(data.metadata) ?? {};
  const phoneCall = asObj(metadata.phone_call) ?? {};
  const analysis = asObj(data.analysis) ?? {};
  const dc = asObj(analysis.data_collection_results);

  const durRaw = metadata.call_duration_secs;
  const durationSecs = typeof durRaw === 'number' && Number.isFinite(durRaw) ? durRaw : null;

  return {
    conversationId: str(data.conversation_id),
    agentId: str(data.agent_id),
    callerName: dcValue(dc, 'caller_name'),
    companyName: dcValue(dc, 'company_name'),
    phone: dcValue(dc, 'phone_number'),
    callerIdNumber: str(phoneCall.external_number),
    email: dcValue(dc, 'email_address'),
    location: dcValue(dc, 'location'),
    serviceType: dcValue(dc, 'service_type'),
    messageNotes: dcValue(dc, 'message_notes'),
    summary: str(analysis.transcript_summary),
    callSuccessful: str(analysis.call_successful),
    durationSecs,
  };
}

/** Best phone for storage/matching: spoken number first, carrier caller-ID fallback. */
export function resolvedPhone(d: InboundCallData): string | null {
  return d.phone || d.callerIdNumber || null;
}
