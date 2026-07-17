import type { AddressDisplayProps } from '@openzeppelin/ui-components';
import { AddressDisplay } from '@openzeppelin/ui-components';
import { AddressNameResolutionProvider } from '@openzeppelin/ui-renderer';

import { useWizardStore } from '../../app/state/useWizardStore';

/**
 * `AddressDisplay` fed through reverse ENS resolution via the renderer's
 * `AddressNameResolutionProvider` bridge. Defaults `networkId` to the wizard's
 * context network so provenance scope gating matches alias resolution.
 */
export function ResolvedAddressDisplay({
  address,
  networkId: networkIdProp,
  ...displayProps
}: {
  address: string;
  networkId?: string;
} & Omit<AddressDisplayProps, 'address'>) {
  const contextNetworkId = useWizardStore((s) => s.activeNetworkId);
  const networkId = networkIdProp ?? contextNetworkId ?? undefined;

  return (
    <AddressNameResolutionProvider address={address} networkId={networkId}>
      <AddressDisplay address={address} networkId={networkId} {...displayProps} />
    </AddressNameResolutionProvider>
  );
}
