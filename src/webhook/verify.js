import crypto from 'crypto';

export function verifySignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];

  if (!signature) {
    return res.status(401).json({ error: 'No signature found' });
  }

  const rawBody = JSON.stringify(req.body);
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const trusted = Buffer.from(expected, 'utf8');
  const received = Buffer.from(signature, 'utf8');

  const isValid = crypto.timingSafeEqual(trusted, received);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}