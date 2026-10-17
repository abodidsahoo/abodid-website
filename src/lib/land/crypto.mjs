import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const parseKey = (secret) => {
  const value = String(secret || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error('LAND_DATA_ENCRYPTION_KEY must be a 32-byte hexadecimal value.');
  }
  return Buffer.from(value, 'hex');
};

export const encryptLandAsset = (contents, secret) => {
  const key = parseKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(contents), cipher.final()]);
  return JSON.stringify({
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: Buffer.from(iv).toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  });
};

export const decryptLandAsset = (envelopeText, secret) => {
  const envelope = JSON.parse(String(envelopeText));
  if (envelope.version !== 1 || envelope.algorithm !== 'aes-256-gcm') {
    throw new Error('Unsupported encrypted land asset format.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    parseKey(secret),
    Buffer.from(envelope.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]);
};

