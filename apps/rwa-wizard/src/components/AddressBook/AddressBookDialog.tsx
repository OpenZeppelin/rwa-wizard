import { toast } from 'sonner';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@openzeppelin/ui-components';
import { AddressBookWidget } from '@openzeppelin/ui-renderer';
import { useAddressBookWidgetProps } from '@openzeppelin/ui-storage';
import type { NetworkConfig } from '@openzeppelin/ui-types';

import { useWizardStore } from '../../app/state/useWizardStore';
import { useAllNetworks } from '../../hooks/useAllNetworks';
import { useRwaWizardAnalytics } from '../../hooks/useRwaWizardAnalytics';
import {
  getEcosystemDefinition,
  getEcosystemMetadata,
} from '../../services/runtime/ecosystemManager';
import { db } from '../../storage/database';

const DEFAULT_ADDRESS_PLACEHOLDER = '0x...';

// Explorer path segment per ecosystem — mirrors the same fallback used by
// `ui-builder` and `role-manager`'s address book when no live runtime is
// available for a network. Adapter packages own per-network URL generation
// only when a runtime is connected; for read-only address-book rows we stitch
// the URL from `network.explorerUrl` ourselves.
const ECOSYSTEM_ADDRESS_PATH: Record<string, string> = {
  evm: 'address',
  stellar: 'account',
};

interface AddressBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Address book dialog for managing per-address aliases across all supported
 * ecosystems. Mirrors the pattern used by `role-manager`'s `AddressBook` page:
 *
 * - Networks come from {@link useAllNetworks} (lightweight `/networks` subpath
 *   imports — no wallet SDKs).
 * - `addressExample` and other display metadata are read synchronously from
 *   the statically-imported ecosystem metadata.
 * - `resolveAddressing` lazy-loads the matching adapter only when the user
 *   actually starts inline-editing an address row.
 */
export function AddressBookDialog({ open, onOpenChange }: AddressBookDialogProps) {
  const activeNetworkId = useWizardStore((s) => s.activeNetworkId);
  const { networks } = useAllNetworks();
  const [filterNetworkIds, setFilterNetworkIds] = useState<string[]>([]);
  const { trackAddressBookOpened } = useRwaWizardAnalytics();
  const wasAddressBookOpenRef = useRef(false);

  const activeNetworkConfig = useMemo(
    () => (activeNetworkId ? networks.find((n) => n.id === activeNetworkId) : undefined),
    [networks, activeNetworkId]
  );

  useEffect(() => {
    const wasOpen = wasAddressBookOpenRef.current;
    wasAddressBookOpenRef.current = open;

    if (!open || wasOpen) return;

    const networkId = activeNetworkConfig?.id ?? 'unknown';
    const ecosystem = activeNetworkConfig?.ecosystem ?? 'unknown';
    trackAddressBookOpened(networkId, ecosystem);
  }, [open, activeNetworkConfig, trackAddressBookOpened]);

  const widgetProps = useAddressBookWidgetProps(db, {
    networkId: activeNetworkId ?? undefined,
    filterNetworkIds,
    onError: (title, err) => toast.error(`${title}: ${err instanceof Error ? err.message : err}`),
  });

  const resolveNetwork = useCallback(
    (networkId: string) => networks.find((n) => n.id === networkId),
    [networks]
  );

  const resolveExplorerUrl = useCallback(
    (address: string, networkId?: string) => {
      if (!networkId) return undefined;
      const net = networks.find((n) => n.id === networkId);
      if (!net?.explorerUrl) return undefined;
      const baseUrl = net.explorerUrl.replace(/\/+$/, '');
      const segment = ECOSYSTEM_ADDRESS_PATH[net.ecosystem] ?? 'address';
      return `${baseUrl}/${segment}/${address}`;
    },
    [networks]
  );

  const resolveAddressing = useCallback(async (network: NetworkConfig) => {
    const def = await getEcosystemDefinition(network.ecosystem);
    const addressing = def?.capabilities.addressing?.();
    if (!addressing) {
      throw new Error(`Unsupported ecosystem for addressing: ${network.ecosystem}`);
    }
    return {
      ...addressing,
      isValidAddress: addressing.isValidAddress.bind(addressing),
      dispose: () => {},
    };
  }, []);

  const resolveAddressPlaceholder = useCallback(
    (network: NetworkConfig) =>
      getEcosystemMetadata(network.ecosystem)?.addressExample ?? DEFAULT_ADDRESS_PLACEHOLDER,
    []
  );

  const addressPlaceholder = activeNetworkConfig
    ? (getEcosystemMetadata(activeNetworkConfig.ecosystem)?.addressExample ??
      DEFAULT_ADDRESS_PLACEHOLDER)
    : DEFAULT_ADDRESS_PLACEHOLDER;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Address Book</DialogTitle>
          <DialogDescription>
            Manage address aliases across all networks. Aliases are stored locally and appear
            automatically wherever addresses are displayed.
          </DialogDescription>
        </DialogHeader>
        <AddressBookWidget
          {...widgetProps}
          title="Saved Addresses"
          resolveNetwork={resolveNetwork}
          resolveExplorerUrl={resolveExplorerUrl}
          resolveAddressing={resolveAddressing}
          addressPlaceholder={addressPlaceholder}
          resolveAddressPlaceholder={resolveAddressPlaceholder}
          networks={networks}
          currentNetworkId={activeNetworkId ?? undefined}
          filterNetworkIds={filterNetworkIds}
          onFilterNetworkIdsChange={setFilterNetworkIds}
        />
      </DialogContent>
    </Dialog>
  );
}
