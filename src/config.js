// Feature flags. Flip a value to false to hide a feature across the whole app.
export const FEATURES = {
  // Zero-knowledge password vault (Settings → Security → Password Vault).
  // Owner-only; data is end-to-end encrypted client-side (see docs/password-vault-design.md).
  passwordVault: true,
};
