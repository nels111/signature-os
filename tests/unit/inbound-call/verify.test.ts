import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';
import { verifyHmacSignature, validateElevenLabsRequest } from '@/lib/elevenlabs-verify';

const SECRET = 'test_secret_value';
const body = JSON.stringify({ type: 'post_call_transcription', data: { conversation_id: 'x' } });

function sign(rawBody: string, secret: string, t: number): string {
  const v0 = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return `t=${t},v0=${v0}`;
}

describe('verifyHmacSignature', () => {
  const now = 1_718_800_000_000;
  const t = Math.floor(now / 1000);

  test('accepts a correctly signed body', () => {
    expect(verifyHmacSignature(body, sign(body, SECRET, t), SECRET, now)).toBe(true);
  });
  test('rejects a wrong secret', () => {
    expect(verifyHmacSignature(body, sign(body, 'other', t), SECRET, now)).toBe(false);
  });
  test('rejects a tampered body', () => {
    expect(verifyHmacSignature(body + 'x', sign(body, SECRET, t), SECRET, now)).toBe(false);
  });
  test('rejects a stale timestamp (>30 min)', () => {
    const stale = t - 31 * 60;
    expect(verifyHmacSignature(body, sign(body, SECRET, stale), SECRET, now)).toBe(false);
  });
  test('rejects malformed signature headers', () => {
    expect(verifyHmacSignature(body, 'garbage', SECRET, now)).toBe(false);
    expect(verifyHmacSignature(body, 't=123', SECRET, now)).toBe(false);
    expect(verifyHmacSignature(body, '', SECRET, now)).toBe(false);
  });
});

describe('validateElevenLabsRequest', () => {
  const now = 1_718_800_000_000;
  const t = Math.floor(now / 1000);

  beforeEach(() => { process.env.ELEVENLABS_WEBHOOK_SECRET = SECRET; });
  afterEach(() => { delete process.env.ELEVENLABS_WEBHOOK_SECRET; });

  test('accepts a valid HMAC signature header', () => {
    const h = new Headers({ 'elevenlabs-signature': sign(body, SECRET, t) });
    expect(validateElevenLabsRequest(body, h, now)).toBe(true);
  });

  test('accepts a matching Bearer shared secret', () => {
    const h = new Headers({ authorization: `Bearer ${SECRET}` });
    expect(validateElevenLabsRequest(body, h, now)).toBe(true);
  });

  test('accepts a matching x-webhook-secret header', () => {
    const h = new Headers({ 'x-webhook-secret': SECRET });
    expect(validateElevenLabsRequest(body, h, now)).toBe(true);
  });

  test('rejects a wrong shared secret', () => {
    const h = new Headers({ 'x-webhook-secret': 'nope' });
    expect(validateElevenLabsRequest(body, h, now)).toBe(false);
  });

  test('rejects when no proof is supplied', () => {
    expect(validateElevenLabsRequest(body, new Headers(), now)).toBe(false);
  });

  test('fails closed when no secret is configured', () => {
    delete process.env.ELEVENLABS_WEBHOOK_SECRET;
    const h = new Headers({ 'elevenlabs-signature': sign(body, SECRET, t) });
    expect(validateElevenLabsRequest(body, h, now)).toBe(false);
  });
});
