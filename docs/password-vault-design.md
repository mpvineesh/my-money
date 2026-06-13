# Zero-Knowledge Password Vault — Design Sketch

A design for adding a password manager to My Money **without** the server (Firestore),
Google, or the admin service-account key ever seeing plaintext credentials.

> Status: design only. Nothing here is wired into the app yet.

## 1. Principles (the non-negotiables)

1. **The master password never leaves the device** and is never stored anywhere.
2. **Firestore only ever stores ciphertext** + the parameters needed to decrypt *given the
   master password* (salt, IV, iterations). None of those reveal the secrets.
3. **The encryption is the real protection — not the security rules.** The admin
   service-account key bypasses all Firestore rules, so rules alone can't protect this.
   Encryption is what keeps it safe even from you.
4. **No recovery.** Lose the master password → the vault is permanently unreadable. (Optional
   recovery code below.) This is the cost of zero-knowledge; it must be stated loudly in the UI.

## 2. Key hierarchy (the Bitwarden/1Password pattern)

Don't encrypt items directly with a password-derived key. Use a wrapped random key:

```
Master Password ──PBKDF2/Argon2──▶ Master Key (MK)        [derived each unlock, never stored]
Random 256-bit  ───────────────▶ Vault Key (VK)          [generated once, never stored raw]
VK  ──encrypt with MK──▶ wrappedVK                        [THIS is stored]
Items ──encrypt with VK──▶ ciphertext                     [stored]
```

Why the extra layer:
- Changing the master password only re-wraps VK (one tiny write) — items are untouched.
- VK is high-entropy random, so items aren't encrypted under a (possibly weak) human password.
- Unwrapping VK doubles as password verification: AES-GCM's auth tag fails on the wrong
  password, so there's no separate "password hash" to store or leak.

## 3. Crypto module (Web Crypto, no dependencies)

```js
// src/utils/vaultCrypto.js  (browser Web Crypto — SubtleCrypto)
const enc = new TextEncoder();
const dec = new TextDecoder();
const toB64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

// OWASP 2023 floor for PBKDF2-HMAC-SHA256. Argon2id is stronger (needs a WASM lib).
const KDF_ITERATIONS = 600_000;

// 1) Master Key from the master password. Non-extractable; only wraps/unwraps VK.
export async function deriveMasterKey(password, salt, iterations = KDF_ITERATIONS) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,                       // MK cannot be exported
    ['wrapKey', 'unwrapKey'],
  );
}

// 2) Fresh random Vault Key. Extractable so MK can wrap it.
export const generateVaultKey = () =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

// 3) Wrap VK with MK for storage.
export async function wrapVaultKey(vaultKey, masterKey) {
  const iv = randomBytes(12);
  const wrapped = await crypto.subtle.wrapKey('raw', vaultKey, masterKey, { name: 'AES-GCM', iv });
  return { wrappedKey: toB64(wrapped), wrapIv: toB64(iv) };
}

// 4) Unwrap VK. THROWS on wrong password (auth-tag failure) — that's the verification.
export const unwrapVaultKey = (wrappedKeyB64, wrapIvB64, masterKey) =>
  crypto.subtle.unwrapKey(
    'raw', fromB64(wrappedKeyB64), masterKey,
    { name: 'AES-GCM', iv: fromB64(wrapIvB64) },
    { name: 'AES-GCM', length: 256 },
    false,                       // unwrapped VK is non-extractable in memory
    ['encrypt', 'decrypt'],
  );

// 5/6) Per-item encrypt / decrypt with VK. Fresh IV every write (never reuse with GCM).
export async function encryptItem(vaultKey, obj) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vaultKey, enc.encode(JSON.stringify(obj)));
  return { ciphertext: toB64(ct), iv: toB64(iv) };
}
export async function decryptItem(vaultKey, { ciphertext, iv }) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, vaultKey, fromB64(ciphertext));
  return JSON.parse(dec.decode(pt));
}

// Setup a brand-new vault.
export async function createVault(masterPassword) {
  const salt = randomBytes(16);
  const masterKey = await deriveMasterKey(masterPassword, salt);
  const vaultKey = await generateVaultKey();
  const { wrappedKey, wrapIv } = await wrapVaultKey(vaultKey, masterKey);
  const meta = { version: 1, kdf: 'PBKDF2-SHA256', iterations: KDF_ITERATIONS, salt: toB64(salt), wrappedKey, wrapIv };
  return { meta, vaultKey };     // persist `meta`; keep `vaultKey` in memory ONLY
}

// Unlock an existing vault. Returns VK or throws on wrong password.
export async function unlockVault(meta, masterPassword) {
  const masterKey = await deriveMasterKey(masterPassword, fromB64(meta.salt), meta.iterations);
  return unwrapVaultKey(meta.wrappedKey, meta.wrapIv, masterKey);
}

// Change master password: re-wrap the SAME VK; items never touched.
export async function rewrapVault(meta, vaultKey, newPassword) {
  const salt = randomBytes(16);
  const masterKey = await deriveMasterKey(newPassword, salt);
  const { wrappedKey, wrapIv } = await wrapVaultKey(vaultKey, masterKey);
  return { ...meta, salt: toB64(salt), wrappedKey, wrapIv };
}
```

## 4. Firestore data model

```
users/{uid}/vault/meta
  { version, kdf, iterations, salt, wrappedKey, wrapIv }      // no secrets, just KDF params
users/{uid}/vaultItems/{itemId}
  { ciphertext, iv, version, updatedAt }                       // title/username/password all inside ciphertext
```

Put **everything sensitive inside `ciphertext`** (title, username, password, URL, notes). Only
`itemId`, `updatedAt`, and the count are visible to the server — minimize that metadata leak.

## 5. Security rules — keep members and the broad rule OUT of the vault

The current rule `match /users/{userId}/{document=**}` lets family **members read the owner's
entire subtree** — which would include the vault. Firestore is allow-only (any matching `allow`
grants access), so you must make the broad rule *not* cover the vault, and add an owner-only rule.

```
match /users/{userId} {
  allow read, write: if isOwner(userId);

  // Vault: owner-only, members NEVER, and it stays ciphertext regardless.
  match /vault/{doc}      { allow read, write: if isOwner(userId); }
  match /vaultItems/{doc} { allow read, write: if isOwner(userId); }

  // Everything else: owner read/write, members read-only — but explicitly excluding the vault.
  match /{collection}/{doc} {
    allow read: if isOwner(userId)
      || (callerIsMemberOf(userId) && collection != 'vault' && collection != 'vaultItems');
    allow write: if isOwner(userId);
  }
}
```

Remember: this is **defense in depth**. The real guarantee is that even a reader who bypasses
rules (admin key, a Firestore leak) sees only ciphertext.

## 6. Runtime / UX flow

- **In-memory key only.** Hold VK in a React context/ref. **Never** write VK or the master
  password to `localStorage`, `IndexedDB`, or the service-worker cache.
- **Locked vs unlocked.** App starts locked (VK = null). Unlock screen takes the master password
  → `unlockVault` → VK in memory. Wrong password throws → "Incorrect master password."
- **Auto-lock.** Clear VK on: inactivity timeout (e.g. 5 min), `document visibilitychange`
  (tab hidden), and `pagehide`. Re-prompt to unlock.
- **Add/edit.** Encrypt with VK before writing; the plaintext exists only transiently in memory.
- **Copy to clipboard.** Auto-clear the clipboard after ~20s; warn that clipboard managers may
  capture it.

## 7. Optional recovery code

Generate a second high-entropy random key at setup, wrap VK with it too, and show it **once** for
the user to store offline (print/safe). Losing the master password then still allows recovery via
the code. Without this, lost master password = permanent data loss.

## 8. Residual risks (be honest about these)

- **XSS is the dominant threat.** Decryption happens in the browser, so any injected script can
  read the unlocked vault or keylog the master password. A PWA auto-updates, so a single
  compromised deploy = full compromise. Mitigate with a strict Content-Security-Policy, no
  `dangerouslySetInnerHTML`/`eval`, and tight dependency hygiene — but you can't fully match a
  native app's isolation.
- **Weak master password** → offline brute force of `wrappedKey` *if* the Firestore data leaks.
  Enforce a strong master password; prefer **Argon2id** over PBKDF2 if you add a WASM lib.
- **Metadata** (item count, timestamps) is visible server-side.
- **No third-party audit.** This is hand-rolled crypto; the primitives are standard but the
  assembly hasn't been reviewed.

## 9. Recommendation

This design is *correct in shape* and safe enough for low/medium-sensitivity secrets if built
carefully. For your primary, high-value credentials, an audited manager (Bitwarden — open-source,
self-hostable) is still the safer choice. If you build this, scope it accordingly and treat the
XSS surface as the thing to get right.
```
