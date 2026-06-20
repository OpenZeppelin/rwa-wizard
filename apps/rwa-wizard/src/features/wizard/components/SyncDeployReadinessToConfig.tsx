import { useEffect, useRef } from 'react';

import type { DeployGuidanceDTO } from '../../../services/codegen/types';
import { useDeployReadiness } from '../context/useDeployReadiness';

interface SyncDeployReadinessToConfigProps {
  guidance: DeployGuidanceDTO;
}

/**
 * Clears deploy-readiness toggles when signer-relevant config changes so
 * acknowledgments always match the current Admin address and testnet-only
 * identity scaffolding cannot leak into non-testnet generation.
 */
export function SyncDeployReadinessToConfig({ guidance }: SyncDeployReadinessToConfigProps) {
  const { setSignerAcknowledged, setIncludeIdentitySupport } = useDeployReadiness();
  const previousAdminAddressRef = useRef<string | null>(null);
  const previousNetworkIsTestnetRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (
      previousAdminAddressRef.current !== null &&
      previousAdminAddressRef.current !== guidance.adminAddress
    ) {
      setSignerAcknowledged(false);
    }
    previousAdminAddressRef.current = guidance.adminAddress;
  }, [guidance.adminAddress, setSignerAcknowledged]);

  useEffect(() => {
    if (previousNetworkIsTestnetRef.current === true && !guidance.networkIsTestnet) {
      setIncludeIdentitySupport(false);
    }
    previousNetworkIsTestnetRef.current = guidance.networkIsTestnet;
  }, [guidance.networkIsTestnet, setIncludeIdentitySupport]);

  return null;
}
