import { useContext, useSyncExternalStore } from 'react';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { ConfigPath } from '../config-path';
import { anchorItemExists, anchorToConfigPath, parseConfigAnchor } from '../focused-path';
import type { ConfigAnchorKey } from '../focused-path';
import { InspectedAnchorContext } from './InspectedAnchorContext';
import type { InspectedAnchor } from './inspectedAnchorStore';

/** Stable no-ops for the no-provider case, so inertness costs no new identity per render. */
const NO_OP = (): void => {};
const NEVER_SUBSCRIBE = (): (() => void) => NO_OP;

/**
 * The subject as a live `ConfigPath`, or `null`.
 *
 * Three hops on **every render, with no memo**: decode the key, drop it if its
 * item is gone, else resolve it against the *live* draft. Resolving per render
 * rather than storing a path is what makes an index shift a non-event and what
 * retires the latch's generate-key stamp — there is no stored index left to go
 * stale. A `useMemo` keyed on the subject and not on the config would defeat
 * exactly the existence check below, in the one place nobody looks. INV-25,
 * INV-28.
 *
 * The cost is bounded and small: one decode, at most one scan of a collection
 * the wizard caps at fifteen, and one path build.
 *
 * Outside the provider: `null`, inert. INV-13.
 */
export function useInspectedConfigPath(config: RWAConfig): ConfigPath | null {
  const subject = useInspectedAnchorSubject();
  if (subject === null) return null;

  const anchor = parseConfigAnchor(subject);
  if (anchor === null) return null;

  // The read-time half of the reconciliation rule. Nothing clears the subject
  // when an item is removed — React fires no event when it unmounts a focused
  // element, so an event-driven clear would be a guard that looks present in
  // review and never runs. INV-20.
  if (!anchorItemExists(anchor, config)) return null;

  return anchorToConfigPath(anchor, config);
}

/**
 * Whether `anchor` is the subject. `false` for `undefined`, and outside the
 * provider.
 *
 * The snapshot is the **boolean**, not the subject, so only the item whose
 * answer actually flipped re-renders — the single-value selector discipline
 * `useWizardStore`'s own doc comment prescribes. Returning the subject and
 * letting the caller compare would re-render every chip on every subject change,
 * and the subject changes on every `focusin` anywhere in the wizard: the whole
 * form re-rendering on every tab press, which is the precise cost SF-12's hook
 * was pushed down into the drawer to avoid. INV-26.
 */
export function useIsInspected(anchor: ConfigAnchorKey | undefined): boolean {
  const store = useContext(InspectedAnchorContext);
  const isInspected = (): boolean =>
    anchor !== undefined && store !== null && store.getSnapshot() === anchor;

  return useSyncExternalStore(store?.subscribe ?? NEVER_SUBSCRIBE, isInspected, isInspected);
}

/**
 * The stable writer, for the two add handlers.
 *
 * Referentially stable for the provider's life — `inspect` is a property of a
 * store created once — so a component that only writes never re-renders because
 * of the subject. Outside the provider it is a stable no-op, deliberately;
 * see {@link InspectedAnchorContext}. INV-13, INV-26.
 */
export function useInspectAnchor(): (anchor: ConfigAnchorKey) => void {
  const store = useContext(InspectedAnchorContext);
  return store?.inspect ?? NO_OP;
}

/**
 * The raw subject key. Internal: every consumer wants either the resolved path
 * or a single item's boolean, and exposing the key would invite a caller to
 * store it and re-introduce the staleness the anchor removes.
 */
function useInspectedAnchorSubject(): InspectedAnchor {
  const store = useContext(InspectedAnchorContext);
  const getSnapshot = (): InspectedAnchor => store?.getSnapshot() ?? null;

  return useSyncExternalStore(store?.subscribe ?? NEVER_SUBSCRIBE, getSnapshot, getSnapshot);
}
