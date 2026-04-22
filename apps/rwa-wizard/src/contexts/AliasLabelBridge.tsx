/**
 * Bridges alias storage and the AddressLabelProvider + AddressSuggestionProvider
 * from ui-components. Reads the current network from the wizard store (the
 * wizard's context network — preset deployment id, or the URL `:networkId`
 * when the deployment is custom) and creates reactive resolvers backed by Dexie.
 *
 * - All `AddressDisplay` instances in the subtree automatically resolve aliases.
 * - All `AddressField` instances in the subtree automatically show alias suggestions.
 * - Clicking the pencil icon on any AddressDisplay opens the `AliasEditPopover`.
 *
 * The pencil icon (and `AliasEditPopover` save flow) is only exposed when an
 * `activeNetworkId` is known. Saving an alias without a network would create
 * a "global" record that is unreachable from the network-scoped Address Book
 * filters and is not recognized by the wizard's per-network alias resolver.
 * When no network is in scope, the user must use the Address Book dialog,
 * which forces an explicit network selection.
 */
import { toast } from 'sonner';
import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';

import { AddressLabelProvider, AddressSuggestionProvider } from '@openzeppelin/ui-components';
import { AliasEditPopover, useAliasEditState } from '@openzeppelin/ui-renderer';
import {
  useAliasEditCallbacks,
  useAliasLabelResolver,
  useAliasSuggestionResolver,
} from '@openzeppelin/ui-storage';

import { useWizardStore } from '../app/state/useWizardStore';
import { db } from '../storage/database';

export function AliasLabelBridge({ children }: { children: ReactNode }) {
  const activeNetworkId = useWizardStore((s) => s.activeNetworkId);

  const labelResolver = useAliasLabelResolver(db, {
    networkId: activeNetworkId ?? undefined,
  });

  const suggestionResolver = useAliasSuggestionResolver(db);
  const editCallbacks = useAliasEditCallbacks(db);

  const { editing, onEditLabel, handleClose, lastClickRef } = useAliasEditState(
    activeNetworkId ?? undefined
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      lastClickRef.current = { x: e.clientX, y: e.clientY };
    },
    [lastClickRef]
  );

  // Only enable the pencil edit affordance when we know which network the
  // alias should be scoped to. This prevents the popover from ever creating
  // a network-less ("global") alias record.
  const editLabelHandler = activeNetworkId ? onEditLabel : undefined;

  // Defensive guard: even if `editing` is set somehow, refuse to persist an
  // alias without a networkId so we can never silently create an
  // unreachable record. Surface a clear actionable message to the user.
  const guardedEditCallbacks = useMemo(
    () => ({
      ...editCallbacks,
      onSave: async (input: { address: string; alias: string; networkId?: string }) => {
        if (!input.networkId) {
          const message = 'Open the Address Book to add an alias and pick a network.';
          toast.error(message);
          throw new Error(message);
        }
        return editCallbacks.onSave(input);
      },
    }),
    [editCallbacks]
  );

  return (
    <div onPointerDown={handlePointerDown}>
      <AddressLabelProvider
        resolveLabel={labelResolver.resolveLabel}
        onEditLabel={editLabelHandler}
      >
        <AddressSuggestionProvider resolveSuggestions={suggestionResolver.resolveSuggestions}>
          {children}
        </AddressSuggestionProvider>
      </AddressLabelProvider>

      {editing && (
        <AliasEditPopover
          address={editing.address}
          networkId={editing.networkId}
          anchorRect={editing.anchorRect}
          onClose={handleClose}
          {...guardedEditCallbacks}
        />
      )}
    </div>
  );
}
