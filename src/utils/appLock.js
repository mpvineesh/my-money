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

// How long the app may sit in the background before the PIN is required again. Without
// this, every notification glance or app switch re-locked the app immediately.
export const APP_LOCK_GRACE_MS = 2 * 60 * 1000;
const LAST_HIDDEN_KEY = 'app-lock-last-hidden-v1';

export function recordAppHidden() {
  try {
    localStorage.setItem(LAST_HIDDEN_KEY, String(Date.now()));
  } catch {
    // Storage unavailable; the next return will simply require the PIN.
  }
}

export function clearAppHidden() {
  try {
    localStorage.removeItem(LAST_HIDDEN_KEY);
  } catch {
    // ignore
  }
}

// True when the app was backgrounded recently enough that the PIN can be skipped.
export function isWithinLockGrace() {
  try {
    const hiddenAt = Number(localStorage.getItem(LAST_HIDDEN_KEY));
    return Number.isFinite(hiddenAt) && hiddenAt > 0 && Date.now() - hiddenAt < APP_LOCK_GRACE_MS;
  } catch {
    return false;
  }
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
