import crypto from 'crypto';

const SECRET = 'test_secret';
const PAYLOAD = JSON.stringify({ action: 'opened' });

function makeSignature(body, secret) {
  return 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
}

describe('Webhook signature verification', () => {

  test('valid signature produces correct sha256 format', () => {
    const sig = makeSignature(PAYLOAD, SECRET);
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  test('different secret produces different signature', () => {
    const sig1 = makeSignature(PAYLOAD, SECRET);
    const sig2 = makeSignature(PAYLOAD, 'wrong_secret');
    expect(sig1).not.toBe(sig2);
  });

  test('same payload and secret always produce same signature', () => {
    const sig1 = makeSignature(PAYLOAD, SECRET);
    const sig2 = makeSignature(PAYLOAD, SECRET);
    expect(sig1).toBe(sig2);
  });

  test('different payload produces different signature', () => {
    const sig1 = makeSignature(PAYLOAD, SECRET);
    const sig2 = makeSignature(JSON.stringify({ action: 'closed' }), SECRET);
    expect(sig1).not.toBe(sig2);
  });

});