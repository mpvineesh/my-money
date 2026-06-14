import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { VaultContext } from './VaultContextDef';
import { FEATURES } from '../config';
import { createVault, unlockVault, recoverVault, rewrapMaster, encryptItem, decryptItem } from '../utils/vaultCrypto';

const AUTO_LOCK_MS = 5 * 60 * 1000; // lock after 5 minutes of inactivity

// Vault data lives at a top-level `vaults/{uid}` path (NOT under users/) so the
// family-member read rule can never reach it. The Vault Key is held only in a ref
// (memory) — never in state, localStorage, or the service-worker cache.
export function VaultProvider({ children }) {
  const { user, household } = useAuth();
  const uid = user?.uid;
  const enabled = FEATURES.passwordVault && !!uid && household?.mode !== 'member';

  // status: 'loading' | 'absent' (no vault yet) | 'locked' | 'unlocked' | 'disabled' | 'error'
  const [status, setStatus] = useState('loading');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const vaultKeyRef = useRef(null);
  const metaRef = useRef(null);
  const lockTimerRef = useRef(null);

  const metaDoc = useCallback(() => doc(db, 'vaults', uid), [uid]);
  const itemsCol = useCallback(() => collection(db, 'vaults', uid, 'items'), [uid]);

  const lock = useCallback(() => {
    vaultKeyRef.current = null;
    setItems([]);
    setStatus(metaRef.current ? 'locked' : 'absent');
  }, []);

  const resetLockTimer = useCallback(() => {
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    if (vaultKeyRef.current) lockTimerRef.current = setTimeout(lock, AUTO_LOCK_MS);
  }, [lock]);

  // Load vault meta when the (owner) user changes.
  useEffect(() => {
    if (!enabled) { setStatus('disabled'); return undefined; }
    let active = true;
    setStatus('loading');
    getDoc(metaDoc())
      .then((snap) => {
        if (!active) return;
        metaRef.current = snap.exists() ? snap.data() : null;
        setStatus(snap.exists() ? 'locked' : 'absent');
      })
      .catch(() => { if (active) { setError('Could not load the vault.'); setStatus('error'); } });
    return () => { active = false; };
  }, [enabled, metaDoc]);

  // Auto-lock when the tab is hidden or the page is being unloaded.
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') lock(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', lock);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', lock);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, [lock]);

  const loadItems = useCallback(async (vaultKey) => {
    const snap = await getDocs(itemsCol());
    const out = [];
    for (const d of snap.docs) {
      try {
        const data = d.data();
        const fields = await decryptItem(vaultKey, { ciphertext: data.ciphertext, iv: data.iv });
        out.push({ id: d.id, ...fields });
      } catch {
        // skip any item that fails to decrypt rather than breaking the whole list
      }
    }
    out.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    setItems(out);
  }, [itemsCol]);

  // Returns the one-time recovery code on success (show it once), or null on failure.
  const setup = useCallback(async (masterPassword) => {
    if (!enabled) return null;
    setError(''); setBusy(true);
    try {
      const { meta, vaultKey, recoveryCode } = await createVault(masterPassword);
      await setDoc(metaDoc(), meta);
      metaRef.current = meta;
      vaultKeyRef.current = vaultKey;
      setItems([]);
      setStatus('unlocked');
      resetLockTimer();
      return recoveryCode;
    } catch {
      setError('Could not create the vault.');
      return null;
    } finally { setBusy(false); }
  }, [enabled, metaDoc, resetLockTimer]);

  // Recover a forgotten master password: unlock via the recovery code, then set a
  // brand-new master password (re-wraps the same Vault Key; entries are preserved).
  const recoverWithCode = useCallback(async (recoveryCode, newPassword) => {
    setError(''); setBusy(true);
    try {
      let meta = metaRef.current;
      if (!meta) { meta = (await getDoc(metaDoc())).data(); metaRef.current = meta; }
      const vaultKey = await recoverVault(meta, recoveryCode);
      const newMeta = await rewrapMaster(meta, vaultKey, newPassword);
      await setDoc(metaDoc(), newMeta);
      metaRef.current = newMeta;
      vaultKeyRef.current = vaultKey;
      await loadItems(vaultKey);
      setStatus('unlocked');
      resetLockTimer();
      return true;
    } catch {
      setError('Incorrect recovery code.');
      return false;
    } finally { setBusy(false); }
  }, [metaDoc, loadItems, resetLockTimer]);

  // Last resort: permanently delete the vault and all entries, then start fresh.
  const resetVault = useCallback(async () => {
    if (!enabled) return false;
    setBusy(true);
    try {
      const snap = await getDocs(itemsCol());
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'vaults', uid, 'items', d.id))));
      await deleteDoc(metaDoc());
      vaultKeyRef.current = null;
      metaRef.current = null;
      setItems([]);
      setError('');
      setStatus('absent');
      return true;
    } catch {
      setError('Could not reset the vault.');
      return false;
    } finally { setBusy(false); }
  }, [enabled, itemsCol, metaDoc, uid]);

  const unlock = useCallback(async (masterPassword) => {
    setError(''); setBusy(true);
    try {
      let meta = metaRef.current;
      if (!meta) { meta = (await getDoc(metaDoc())).data(); metaRef.current = meta; }
      const vaultKey = await unlockVault(meta, masterPassword);
      vaultKeyRef.current = vaultKey;
      await loadItems(vaultKey);
      setStatus('unlocked');
      resetLockTimer();
      return true;
    } catch {
      setError('Incorrect master password.');
      return false;
    } finally { setBusy(false); }
  }, [metaDoc, loadItems, resetLockTimer]);

  const saveItem = useCallback(async (item) => {
    if (!vaultKeyRef.current) return;
    resetLockTimer();
    const { id, ...fields } = item;
    const { ciphertext, iv } = await encryptItem(vaultKeyRef.current, fields);
    const itemId = id || uuidv4();
    await setDoc(doc(db, 'vaults', uid, 'items', itemId), { ciphertext, iv, version: 1, updatedAt: Date.now() });
    setItems((cur) => {
      const next = cur.filter((x) => x.id !== itemId);
      next.push({ id: itemId, ...fields });
      next.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      return next;
    });
  }, [uid, resetLockTimer]);

  const deleteItem = useCallback(async (id) => {
    resetLockTimer();
    await deleteDoc(doc(db, 'vaults', uid, 'items', id));
    setItems((cur) => cur.filter((x) => x.id !== id));
  }, [uid, resetLockTimer]);

  const value = {
    enabled,
    status,
    items,
    error,
    busy,
    setup,
    unlock,
    recoverWithCode,
    resetVault,
    lock,
    saveItem,
    deleteItem,
    resetLockTimer,
  };

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
}
