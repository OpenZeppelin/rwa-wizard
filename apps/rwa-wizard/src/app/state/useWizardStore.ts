import { useSyncExternalStore } from 'react';

import { wizardStore, type WizardState } from './wizardStore';

/**
 * Subscribe to a narrow slice of the wizard store via a selector.
 *
 * Usage:
 *
 * ```tsx
 * const activeDraftId = useWizardStore((s) => s.activeDraftId);
 * ```
 *
 * Re-renders only when `selector(state)` changes (by `Object.is`). Prefer
 * single-value selectors — returning freshly-built objects (`(s) => ({ a,
 * b })`) produces a new reference each call and defeats the selectivity.
 * For multi-field reads, call the hook once per field or memoize an
 * object selector with `useCallback` + a stable equality check (not
 * provided here; the app hasn't needed it yet).
 *
 * The same selector is used for client and server snapshots — the wizard
 * is SPA-only and the store has no meaningful "server" value, so reusing
 * the live getter keeps the selector definition in one place.
 */
export function useWizardStore<T>(selector: (state: WizardState) => T): T {
  return useSyncExternalStore(
    wizardStore.subscribe,
    () => selector(wizardStore.getState()),
    () => selector(wizardStore.getState())
  );
}

/**
 * Subscribe to the full wizard state. Re-renders on any store change.
 * Prefer {@link useWizardStore} with a selector — this hook exists only
 * for call sites that genuinely need several fields at once and haven't
 * been profiled yet.
 */
export function useWizardState(): WizardState {
  return useSyncExternalStore(wizardStore.subscribe, wizardStore.getState, wizardStore.getState);
}
