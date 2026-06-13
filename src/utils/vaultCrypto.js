// Zero-knowledge vault crypto (browser Web Crypto / SubtleCrypto).
//
// Key hierarchy (Bitwarden/1Password-style wrapped key):
//   master password --PBKDF2--> Master Key (MK)   (derived each unlock, never stored)
//   random 256-bit ----------> Vault Key (VK)     (generated once, never stored raw)
//   VK --encrypted by MK------> wrappedKey         (this is persisted)
//   items --encrypted by VK---> ciphertext         (persisted)
//
// Only ciphertext + KDF params (salt, iv, iterations) ever leave the device.
// See docs/password-vault-design.md for the full rationale.

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

// OWASP 2023 floor for PBKDF2-HMAC-SHA256.
export const KDF_ITERATIONS = 600_000;

// Derive the Master Key from the master password. Non-extractable; only wraps/unwraps VK.
async function deriveMasterKey(password, salt, iterations = KDF_ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

const generateVaultKey = () =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

async function wrapVaultKey(vaultKey, masterKey) {
  const iv = randomBytes(12);
  const wrapped = await crypto.subtle.wrapKey('raw', vaultKey, masterKey, { name: 'AES-GCM', iv });
  return { wrappedKey: toB64(wrapped), wrapIv: toB64(iv) };
}

const unwrapVaultKey = (wrappedKeyB64, wrapIvB64, masterKey) =>
  crypto.subtle.unwrapKey(
    'raw', fromB64(wrappedKeyB64), masterKey,
    { name: 'AES-GCM', iv: fromB64(wrapIvB64) },
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );

// Encrypt / decrypt one item (any JSON-serialisable object) with VK. Fresh IV per write.
export async function encryptItem(vaultKey, obj) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vaultKey, enc.encode(JSON.stringify(obj)));
  return { ciphertext: toB64(ct), iv: toB64(iv) };
}

export async function decryptItem(vaultKey, { ciphertext, iv }) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, vaultKey, fromB64(ciphertext));
  return JSON.parse(dec.decode(pt));
}

// Create a brand-new vault. Returns meta (persist) + vaultKey (keep in memory only).
export async function createVault(masterPassword) {
  const salt = randomBytes(16);
  const masterKey = await deriveMasterKey(masterPassword, salt);
  const vaultKey = await generateVaultKey();
  const { wrappedKey, wrapIv } = await wrapVaultKey(vaultKey, masterKey);
  const meta = {
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: KDF_ITERATIONS,
    salt: toB64(salt),
    wrappedKey,
    wrapIv,
  };
  return { meta, vaultKey };
}

// Unlock an existing vault. Returns VK, or throws if the master password is wrong
// (AES-GCM auth-tag failure during unwrap — that is the password check).
export async function unlockVault(meta, masterPassword) {
  const masterKey = await deriveMasterKey(masterPassword, fromB64(meta.salt), meta.iterations);
  return unwrapVaultKey(meta.wrappedKey, meta.wrapIv, masterKey);
}
