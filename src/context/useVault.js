import { useContext } from 'react';
import { VaultContext } from './VaultContextDef';

export function useVault() {
  return useContext(VaultContext);
}
