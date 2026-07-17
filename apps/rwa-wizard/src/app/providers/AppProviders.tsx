import { Toaster } from 'sonner';
import { useCallback, useMemo, type ReactNode } from 'react';

import { NameResolverProvider, TooltipProvider } from '@openzeppelin/ui-components';
import {
  AnalyticsProvider,
  RuntimeProvider,
  useRuntimeNameResolver,
  useWalletState,
  WalletStateProvider,
} from '@openzeppelin/ui-react';
import type { CreateRuntimeOptions, NetworkConfig } from '@openzeppelin/ui-types';

import { AliasLabelBridge } from '../../contexts/AliasLabelBridge';
import { getNetworkById, getRuntime } from '../../services/runtime/ecosystemManager';
import { WizardDraftStorageProvider } from '../../storage';
import { DEFAULT_WIZARD_NETWORK_ID } from '../../utils/defaultRwaConfig';
import { WalletNetworkSync } from './WalletNetworkSync';

/**
 * Projects the active runtime's name-resolution capability into the
 * `NameResolverProvider` seam so every `AddressField` resolves typed ENS names
 * inline. On runtimes without the capability the resolver is empty and fields
 * behave exactly as before.
 */
function NameResolverBridge({ children }: { children: ReactNode }) {
  const resolver = useRuntimeNameResolver();
  const { activeNetworkId, activeNetworkConfig } = useWalletState();

  return (
    <NameResolverProvider
      {...resolver}
      activeNetworkId={activeNetworkId ?? null}
      activeNetworkName={activeNetworkConfig?.name}
    >
      {children}
    </NameResolverProvider>
  );
}

/**
 * Shared providers and client-side app composition root for the RWA Wizard.
 * AppConfigService is initialized in {@link ../config/initAppConfig} (called
 * from `main.tsx` before render); this component wraps the app with React
 * context providers that need to be available to the tree.
 *
 * `RuntimeProvider` + `WalletStateProvider` supply the active adapter runtime
 * for ENS forward/reverse resolution. Mainnet-L1 miss-fallback is always enabled
 * for EVM runtimes (003 opt-in).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const analyticsTagId = import.meta.env.VITE_GA_TAG_ID || '';

  const runtimeCreationOptions = useMemo(
    (): CreateRuntimeOptions => ({
      nameResolution: { enableMainnetL1MissFallback: true },
    }),
    []
  );

  const resolveRuntime = useCallback(
    (networkConfig: NetworkConfig) => getRuntime(networkConfig, runtimeCreationOptions),
    [runtimeCreationOptions]
  );

  const getNetworkConfigById = useCallback(async (id: string) => {
    return (await getNetworkById(id)) ?? null;
  }, []);

  return (
    <AnalyticsProvider tagId={analyticsTagId} autoInit>
      <RuntimeProvider resolveRuntime={resolveRuntime}>
        <WalletStateProvider
          initialNetworkId={DEFAULT_WIZARD_NETWORK_ID}
          getNetworkConfigById={getNetworkConfigById}
        >
          <WalletNetworkSync />
          <TooltipProvider delayDuration={200}>
            <WizardDraftStorageProvider>
              <NameResolverBridge>
                <AliasLabelBridge>
                  {children}
                  <Toaster position="top-right" />
                </AliasLabelBridge>
              </NameResolverBridge>
            </WizardDraftStorageProvider>
          </TooltipProvider>
        </WalletStateProvider>
      </RuntimeProvider>
    </AnalyticsProvider>
  );
}
