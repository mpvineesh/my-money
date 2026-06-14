// Zero-knowledge vault crypto (browser Web Crypto / SubtleCrypto).
//
// Key hierarchy (Bitwarden/1Password-style wrapped key):
//   master password --PBKDF2--> Master Key (MK)   (derived each unlock, never stored)
//   recovery code   --PBKDF2--> Recovery Key (RK) (derived only during recovery)
//   random 256-bit ----------> Vault Key (VK)     (generated once, never stored raw)
//   VK --encrypted by MK------> wrappedKey         (persisted)
//   VK --encrypted by RK------> recoveryWrappedKey (persisted; lets a forgotten
//                                                   master password be recovered)
//   items --encrypted by VK---> ciphertext         (persisted)
//
// Only ciphertext + KDF params (salts, ivs, iterations) ever leave the device.
// See docs/password-vault-design.md for the full rationale.

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

// OWASP 2023 floor for PBKDF2-HMAC-SHA256.
export const KDF_ITERATIONS = 600_000;

// Recovery codes are typed with or without dashes/case — normalise before use.
const normalizeCode = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function generateRecoveryCode() {
  const hex = [...randomBytes(16)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return hex.match(/.{1,4}/g).join('-'); // 128 bits, shown as 8 groups of 4
}

// Derive a wrapping key (AES-GCM) from a secret string. Non-extractable.
async function deriveKey(secret, salt, iterations = KDF_ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
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

async function wrapVaultKey(vaultKey, wrappingKey) {
  const iv = randomBytes(12);
  const wrapped = await crypto.subtle.wrapKey('raw', vaultKey, wrappingKey, { name: 'AES-GCM', iv });
  return { wrappedKey: toB64(wrapped), wrapIv: toB64(iv) };
}

// Unwrapped VK is extractable so it can be re-wrapped on master-password change.
// (Once the vault is unlocked, an attacker who can run JS can read items anyway,
// so extractability does not meaningfully change the XSS threat model.)
const unwrapVaultKey = (wrappedKeyB64, wrapIvB64, wrappingKey) =>
  crypto.subtle.unwrapKey(
    'raw', fromB64(wrappedKeyB64), wrappingKey,
    { name: 'AES-GCM', iv: fromB64(wrapIvB64) },
    { name: 'AES-GCM', length: 256 },
    true,
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

// Create a brand-new vault. Returns meta (persist), vaultKey (memory only), and the
// one-time recoveryCode (show ONCE; it is not stored in a recoverable form).
export async function createVault(masterPassword) {
  const vaultKey = await generateVaultKey();

  const salt = randomBytes(16);
  const masterKey = await deriveKey(masterPassword, salt);
  const master = await wrapVaultKey(vaultKey, masterKey);

  const recoveryCode = generateRecoveryCode();
  const recoverySalt = randomBytes(16);
  const recoveryKey = await deriveKey(normalizeCode(recoveryCode), recoverySalt);
  const recovery = await wrapVaultKey(vaultKey, recoveryKey);

  const meta = {
    version: 2,
    kdf: 'PBKDF2-SHA256',
    iterations: KDF_ITERATIONS,
    salt: toB64(salt),
    wrappedKey: master.wrappedKey,
    wrapIv: master.wrapIv,
    recoverySalt: toB64(recoverySalt),
    recoveryWrappedKey: recovery.wrappedKey,
    recoveryWrapIv: recovery.wrapIv,
  };
  return { meta, vaultKey, recoveryCode };
}

// Unlock with the master password. Returns VK, or throws if wrong (auth-tag failure).
export async function unlockVault(meta, masterPassword) {
  const masterKey = await deriveKey(masterPassword, fromB64(meta.salt), meta.iterations);
  return unwrapVaultKey(meta.wrappedKey, meta.wrapIv, masterKey);
}

// Unlock with the recovery code. Returns VK, or throws if the code is wrong.
export async function recoverVault(meta, recoveryCode) {
  if (!meta.recoveryWrappedKey) throw new Error('This vault has no recovery code.');
  const recoveryKey = await deriveKey(normalizeCode(recoveryCode), fromB64(meta.recoverySalt), meta.iterations);
  return unwrapVaultKey(meta.recoveryWrappedKey, meta.recoveryWrapIv, recoveryKey);
}

// Re-wrap an (already unlocked) VK under a new master password. Recovery path is
// preserved. Returns updated meta to persist.
export async function rewrapMaster(meta, vaultKey, newPassword) {
  const salt = randomBytes(16);
  const masterKey = await deriveKey(newPassword, salt);
  const { wrappedKey, wrapIv } = await wrapVaultKey(vaultKey, masterKey);
  return { ...meta, salt: toB64(salt), wrappedKey, wrapIv };
}
