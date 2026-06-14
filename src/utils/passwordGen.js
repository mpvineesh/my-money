// Strong random password generator using crypto.getRandomValues. Ambiguous
// characters (0/O/1/l/I) are omitted so generated passwords are easy to read.
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*-_=+?';

export function generatePassword(length = 16) {
  const pool = LOWER + UPPER + DIGITS + SYMBOLS;
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  let out = '';
  for (let i = 0; i < length; i += 1) out += pool[bytes[i] % pool.length];
  return out;
}
