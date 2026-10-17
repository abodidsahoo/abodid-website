import { randomBytes, scryptSync } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = resolve(process.cwd(), '.env.local');

const readHiddenLine = async (prompt) => {
  if (!process.stdin.isTTY) {
    const value = readFileSync(0, 'utf8').trim();
    if (!value) throw new Error('A password is required on stdin.');
    return value;
  }

  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  return new Promise((resolveValue, reject) => {
    let value = '';
    const onData = (character) => {
      if (character === '\u0003') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        reject(new Error('Cancelled.'));
        return;
      }
      if (character === '\r' || character === '\n') {
        process.stdin.off('data', onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\n');
        resolveValue(value);
        return;
      }
      if (character === '\u007f') {
        value = value.slice(0, -1);
        return;
      }
      value += character;
    };
    process.stdin.on('data', onData);
  });
};

const existing = (() => {
  try {
    return readFileSync(target, 'utf8');
  } catch {
    return '';
  }
})();

const rotatePassword = process.argv.includes('--rotate-password');
const hasKey = (name) => new RegExp(`^${name}=`, 'm').test(existing);
const password = await readHiddenLine('Land viewer password: ');
if (password.length < 6) throw new Error('Use at least 6 characters.');

const salt = randomBytes(16).toString('hex');
// Colons avoid dotenv's `$NAME` expansion rules while remaining easy to parse.
const passwordHash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const additions = [];
let nextContents = existing;

if (rotatePassword && hasKey('LAND_VIEWER_PASSWORD_HASH')) {
  nextContents = nextContents.replace(/^LAND_VIEWER_PASSWORD_HASH=.*$/m, `LAND_VIEWER_PASSWORD_HASH=${passwordHash}`);
} else if (!hasKey('LAND_VIEWER_PASSWORD_HASH')) {
  additions.push(`LAND_VIEWER_PASSWORD_HASH=${passwordHash}`);
}
if (!hasKey('LAND_SESSION_SECRET')) {
  additions.push(`LAND_SESSION_SECRET=${randomBytes(48).toString('hex')}`);
}
if (!hasKey('LAND_DATA_ENCRYPTION_KEY')) {
  additions.push(`LAND_DATA_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}`);
}

if (additions.length === 0 && !rotatePassword) {
  console.log('Land secrets already exist in .env.local; no changes made.');
  process.exit(0);
}

if (additions.length) {
  const separator = nextContents.length && !nextContents.endsWith('\n') ? '\n' : '';
  const section = `${separator}\n# Family Land Register (server-only)\n${additions.join('\n')}\n`;
  nextContents = `${nextContents}${section}`;
}
writeFileSync(target, nextContents, { mode: 0o600 });
console.log(rotatePassword ? 'Rotated the server-only land viewer password hash.' : `Added ${additions.length} server-only land setting(s) to the ignored .env.local file.`);

