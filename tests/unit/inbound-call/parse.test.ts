import { describe, test, expect } from 'vitest';
import { parseAnsweringServicePayload, resolvedPhone } from '@/lib/inbound-call/parse';

const fullPayload = {
  type: 'post_call_transcription',
  event_timestamp: 1718800000,
  data: {
    agent_id: 'agent_123',
    conversation_id: 'conv_abc',
    status: 'done',
    metadata: {
      call_duration_secs: 142,
      phone_call: { direction: 'inbound', external_number: '+447111222333', agent_number: '+447480486271' },
    },
    analysis: {
      transcript_summary: 'Caller wants a quote for a weekly office clean.',
      call_successful: 'success',
      data_collection_results: {
        caller_name: { value: 'Dave Thompson', rationale: 'said his name' },
        company_name: { value: "Dave's Garage" },
        phone_number: { value: '07123 456789' },
        email_address: { value: 'dave@davesgarage.co.uk' },
        location: { value: 'Exeter' },
        service_type: { value: 'weekly office clean' },
        message_notes: { value: 'Wants a callback Monday' },
      },
    },
  },
};

describe('parseAnsweringServicePayload', () => {
  test('extracts all fields from a full payload', () => {
    const d = parseAnsweringServicePayload(fullPayload);
    expect(d.conversationId).toBe('conv_abc');
    expect(d.agentId).toBe('agent_123');
    expect(d.callerName).toBe('Dave Thompson');
    expect(d.companyName).toBe("Dave's Garage");
    expect(d.phone).toBe('07123 456789');
    expect(d.callerIdNumber).toBe('+447111222333');
    expect(d.email).toBe('dave@davesgarage.co.uk');
    expect(d.location).toBe('Exeter');
    expect(d.serviceType).toBe('weekly office clean');
    expect(d.messageNotes).toBe('Wants a callback Monday');
    expect(d.summary).toContain('weekly office clean');
    expect(d.callSuccessful).toBe('success');
    expect(d.durationSecs).toBe(142);
  });

  test('tolerates raw-string data-collection values (not just {value})', () => {
    const d = parseAnsweringServicePayload({
      data: { analysis: { data_collection_results: { caller_name: 'Jane', email_address: 'jane@x.com' } } },
    });
    expect(d.callerName).toBe('Jane');
    expect(d.email).toBe('jane@x.com');
  });

  test('returns all-null shape for an empty / garbage body', () => {
    for (const bad of [null, undefined, {}, [], 'nope', 42]) {
      const d = parseAnsweringServicePayload(bad);
      expect(d.callerName).toBeNull();
      expect(d.phone).toBeNull();
      expect(d.email).toBeNull();
      expect(d.durationSecs).toBeNull();
    }
  });

  test('trims whitespace and treats empty strings as null', () => {
    const d = parseAnsweringServicePayload({
      data: { analysis: { data_collection_results: { caller_name: { value: '  ' }, company_name: { value: '  Acme  ' } } } },
    });
    expect(d.callerName).toBeNull();
    expect(d.companyName).toBe('Acme');
  });

  test('resolvedPhone prefers spoken number, falls back to caller ID', () => {
    expect(resolvedPhone(parseAnsweringServicePayload(fullPayload))).toBe('07123 456789');
    const noSpoken = parseAnsweringServicePayload({
      data: { metadata: { phone_call: { external_number: '+447999888777' } }, analysis: { data_collection_results: {} } },
    });
    expect(resolvedPhone(noSpoken)).toBe('+447999888777');
    const neither = parseAnsweringServicePayload({});
    expect(resolvedPhone(neither)).toBeNull();
  });
});
