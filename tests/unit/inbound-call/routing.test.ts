import { describe, test, expect } from 'vitest';
import { decideRoute, phoneDigits, normEmail } from '@/lib/inbound-call/routing';

describe('decideRoute', () => {
  test('existing lead wins over everything (no dup lead)', () => {
    expect(decideRoute({ leadId: 'l1', clientAccountId: 'c1', contactId: 'ct1' })).toBe('existing_lead');
  });
  test('client wins over contact when no lead', () => {
    expect(decideRoute({ clientAccountId: 'c1', contactId: 'ct1' })).toBe('existing_client');
  });
  test('contact when only a contact matched', () => {
    expect(decideRoute({ contactId: 'ct1' })).toBe('existing_contact');
  });
  test('new enquiry when nothing matched', () => {
    expect(decideRoute({})).toBe('new_enquiry');
    expect(decideRoute({ leadId: null, clientAccountId: null, contactId: null })).toBe('new_enquiry');
  });
});

describe('phoneDigits', () => {
  test('reduces mixed formats of the same number to equal digit suffixes', () => {
    expect(phoneDigits('+44 7123 456789')).toBe('7123456789');
    expect(phoneDigits('07123456789')).toBe('7123456789');
    expect(phoneDigits('(07123) 456 789')).toBe('7123456789');
    expect(phoneDigits('+447123456789')).toBe('7123456789');
  });
  test('empty / null inputs yield empty string', () => {
    expect(phoneDigits('')).toBe('');
    expect(phoneDigits(null)).toBe('');
    expect(phoneDigits(undefined)).toBe('');
    expect(phoneDigits('no digits here')).toBe('');
  });
});

describe('normEmail', () => {
  test('lowercases and trims', () => {
    expect(normEmail('  Dave@Example.COM ')).toBe('dave@example.com');
  });
  test('empty for null/undefined', () => {
    expect(normEmail(null)).toBe('');
    expect(normEmail(undefined)).toBe('');
  });
});
