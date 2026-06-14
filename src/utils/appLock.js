// Device-level app lock (a privacy gate, not data encryption — your data is already
// behind Google auth + Firestore rules, and the vault is separately encrypted).
// The PIN is stored only as a salted PBKDF2 hash in localStorage on this device.

const LOCK_KEY = 'app-lock-v1';
const ITERATIONS = 200_000;
const enc = new TextEncoder();

const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

async function deriveHash(pin, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, 256);
  return toB64(bits);
}

export function isAppLockEnabled() {
  return !!localStorage.getItem(LOCK_KEY);
}

export async function setAppPin(pin) {
  const salt = randomBytes(16);
  const hash = await deriveHash(pin, salt, ITERATIONS);
  localStorage.setItem(LOCK_KEY, JSON.stringify({ salt: toB64(salt), hash, iterations: ITERATIONS }));
}

export async function verifyAppPin(pin) {
  const raw = localStorage.getItem(LOCK_KEY);
  if (!raw) return true;
  try {
    const { salt, hash, iterations } = JSON.parse(raw);
    const candidate = await deriveHash(pin, fromB64(salt), iterations);
    return candidate === hash;
  } catch {
    return false;
  }
}

export function disableAppLock() {
  localStorage.removeItem(LOCK_KEY);
}
