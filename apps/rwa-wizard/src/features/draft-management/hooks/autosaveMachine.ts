/**
 * Explicit state machine powering {@link useDraftAutosave}.
 *
 * Phases
 * ------
 * - `idle` — nothing pending; no timer, no in-flight persist.
 * - `debouncing` — an edit landed and we are waiting for the user to settle
 *   before persisting. Re-entering from `idle`/`error` starts a new timer;
 *   re-entering from itself (additional edits) restarts the timer.
 * - `saving` — the debounce elapsed and a persist call is in flight.
 * - `saving-pending` — a persist call is in flight, and a newer edit has
 *   landed. We flush the newer state as soon as the current call resolves.
 * - `error` — the last persist attempt failed. Held until the next edit
 *   arrives (which transitions back to `debouncing`).
 *
 * Transitions are pure — all side effects (timer scheduling, persist calls,
 * callback invocations) live in the hook and react to state changes.
 */

export type AutosavePhase = 'idle' | 'debouncing' | 'saving' | 'saving-pending' | 'error';

export interface AutosaveState {
  phase: AutosavePhase;
  lastError: unknown | null;
  /** Bumped on every edit so the debounce-timer effect can restart itself. */
  editTick: number;
  /** Bumped every time we transition into `saving` so the persist effect re-runs. */
  saveRunId: number;
}

export type AutosaveEvent =
  | { type: 'EDIT' }
  | { type: 'DEBOUNCE_ELAPSED' }
  | { type: 'PERSIST_SUCCEEDED' }
  | { type: 'PERSIST_FAILED'; error: unknown };

export const initialAutosaveState: AutosaveState = {
  phase: 'idle',
  lastError: null,
  editTick: 0,
  saveRunId: 0,
};

export function autosaveReducer(state: AutosaveState, event: AutosaveEvent): AutosaveState {
  switch (state.phase) {
    case 'idle':
      if (event.type === 'EDIT') {
        return { ...state, phase: 'debouncing', editTick: state.editTick + 1 };
      }
      return state;

    case 'debouncing':
      if (event.type === 'EDIT') {
        return { ...state, editTick: state.editTick + 1 };
      }
      if (event.type === 'DEBOUNCE_ELAPSED') {
        return { ...state, phase: 'saving', saveRunId: state.saveRunId + 1 };
      }
      return state;

    case 'saving':
      if (event.type === 'EDIT') {
        return { ...state, phase: 'saving-pending' };
      }
      if (event.type === 'PERSIST_SUCCEEDED') {
        return { ...state, phase: 'idle', lastError: null };
      }
      if (event.type === 'PERSIST_FAILED') {
        return { ...state, phase: 'error', lastError: event.error };
      }
      return state;

    case 'saving-pending':
      if (event.type === 'EDIT') {
        return state;
      }
      // Both outcomes flush the pending edit immediately — we know there are
      // newer bits on the wire, so we start a fresh save instead of debouncing.
      if (event.type === 'PERSIST_SUCCEEDED') {
        return { ...state, phase: 'saving', saveRunId: state.saveRunId + 1, lastError: null };
      }
      if (event.type === 'PERSIST_FAILED') {
        return {
          ...state,
          phase: 'saving',
          saveRunId: state.saveRunId + 1,
          lastError: event.error,
        };
      }
      return state;

    case 'error':
      if (event.type === 'EDIT') {
        return { ...state, phase: 'debouncing', editTick: state.editTick + 1, lastError: null };
      }
      return state;
  }
}

/** True when a persist call is on the wire (or about to be re-fired). */
export function isAutosaveBusy(state: AutosaveState): boolean {
  return state.phase === 'saving' || state.phase === 'saving-pending';
}
