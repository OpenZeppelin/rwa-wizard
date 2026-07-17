import { useEffect } from 'react';

import { useWalletState } from '@openzeppelin/ui-react';

import { useWizardStore } from '../state/useWizardStore';

/**
 * Keeps WalletStateProvider's active network aligned with the wizard's context
 * network (preset deployment id or URL `:networkId`). Required so ENS forward
 * and reverse resolution use the same network scope as alias resolution.
 */
export function WalletNetworkSync(): null {
  const contextNetworkId = useWizardStore((s) => s.activeNetworkId);
  const { activeNetworkId, setActiveNetworkId } = useWalletState();

  useEffect(() => {
    if (contextNetworkId && contextNetworkId !== activeNetworkId) {
      setActiveNetworkId(contextNetworkId);
    }
  }, [contextNetworkId, activeNetworkId, setActiveNetworkId]);

  return null;
}
