import { describe, expect, it } from 'vitest';

import {
  autosaveReducer,
  initialAutosaveState,
  isAutosaveBusy,
  type AutosaveState,
} from './autosaveMachine';

function reduce(state: AutosaveState, events: Parameters<typeof autosaveReducer>[1][]) {
  return events.reduce(autosaveReducer, state);
}

describe('autosaveReducer', () => {
  it('starts in idle with no pending work', () => {
    expect(initialAutosaveState.phase).toBe('idle');
    expect(initialAutosaveState.lastError).toBeNull();
    expect(isAutosaveBusy(initialAutosaveState)).toBe(false);
  });

  it('edit from idle moves to debouncing and bumps editTick', () => {
    const next = autosaveReducer(initialAutosaveState, { type: 'EDIT' });
    expect(next.phase).toBe('debouncing');
    expect(next.editTick).toBe(1);
  });

  it('edits while debouncing bump editTick without changing phase', () => {
    const next = reduce(initialAutosaveState, [
      { type: 'EDIT' },
      { type: 'EDIT' },
      { type: 'EDIT' },
    ]);
    expect(next.phase).toBe('debouncing');
    expect(next.editTick).toBe(3);
  });

  it('debounce elapsed transitions debouncing -> saving and bumps saveRunId', () => {
    const next = reduce(initialAutosaveState, [{ type: 'EDIT' }, { type: 'DEBOUNCE_ELAPSED' }]);
    expect(next.phase).toBe('saving');
    expect(next.saveRunId).toBe(1);
  });

  it('edit during saving queues work as saving-pending', () => {
    const next = reduce(initialAutosaveState, [
      { type: 'EDIT' },
      { type: 'DEBOUNCE_ELAPSED' },
      { type: 'EDIT' },
    ]);
    expect(next.phase).toBe('saving-pending');
    expect(isAutosaveBusy(next)).toBe(true);
  });

  it('persist success from saving returns to idle and clears lastError', () => {
    const next = reduce({ ...initialAutosaveState, phase: 'saving', lastError: new Error('x') }, [
      { type: 'PERSIST_SUCCEEDED' },
    ]);
    expect(next.phase).toBe('idle');
    expect(next.lastError).toBeNull();
  });

  it('persist failure from saving transitions to error and preserves lastError', () => {
    const err = new Error('quota');
    const next = reduce({ ...initialAutosaveState, phase: 'saving' }, [
      { type: 'PERSIST_FAILED', error: err },
    ]);
    expect(next.phase).toBe('error');
    expect(next.lastError).toBe(err);
  });

  it('persist success from saving-pending immediately starts another saving run', () => {
    const start = reduce(initialAutosaveState, [
      { type: 'EDIT' },
      { type: 'DEBOUNCE_ELAPSED' }, // saving
      { type: 'EDIT' }, // saving-pending
    ]);
    expect(start.phase).toBe('saving-pending');
    const firstSaveId = start.saveRunId;

    const next = autosaveReducer(start, { type: 'PERSIST_SUCCEEDED' });
    expect(next.phase).toBe('saving');
    expect(next.saveRunId).toBe(firstSaveId + 1);
    expect(next.lastError).toBeNull();
  });

  it('persist failure from saving-pending still flushes the pending edit and does not stash the error', () => {
    // `lastError` is part of the `error` phase contract — stashing it while
    // we immediately re-fire a save would never surface to consumers and only
    // creates a stale value for the next transition to clean up.
    const err = new Error('boom');
    const start = reduce(initialAutosaveState, [
      { type: 'EDIT' },
      { type: 'DEBOUNCE_ELAPSED' },
      { type: 'EDIT' },
    ]);
    const next = autosaveReducer(start, { type: 'PERSIST_FAILED', error: err });
    expect(next.phase).toBe('saving');
    expect(next.saveRunId).toBe(start.saveRunId + 1);
    expect(next.lastError).toBeNull();
  });

  it('edit from error clears lastError and returns to debouncing', () => {
    const start: AutosaveState = {
      ...initialAutosaveState,
      phase: 'error',
      lastError: new Error('prior'),
    };
    const next = autosaveReducer(start, { type: 'EDIT' });
    expect(next.phase).toBe('debouncing');
    expect(next.lastError).toBeNull();
    expect(next.editTick).toBe(1);
  });

  it('unrelated events in idle are no-ops', () => {
    const noop = autosaveReducer(initialAutosaveState, { type: 'DEBOUNCE_ELAPSED' });
    expect(noop).toEqual(initialAutosaveState);
  });

  it('isAutosaveBusy covers both in-flight phases', () => {
    expect(isAutosaveBusy({ ...initialAutosaveState, phase: 'saving' })).toBe(true);
    expect(isAutosaveBusy({ ...initialAutosaveState, phase: 'saving-pending' })).toBe(true);
    expect(isAutosaveBusy({ ...initialAutosaveState, phase: 'debouncing' })).toBe(false);
    expect(isAutosaveBusy({ ...initialAutosaveState, phase: 'idle' })).toBe(false);
    expect(isAutosaveBusy({ ...initialAutosaveState, phase: 'error' })).toBe(false);
  });
});
