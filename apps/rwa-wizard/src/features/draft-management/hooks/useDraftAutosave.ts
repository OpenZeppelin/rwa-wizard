import { useCallback, useEffect, useReducer, useRef } from 'react';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { WizardDraftStorageApi } from '../../../storage/wizardDraftStorageContext';
import type { WizardStepId } from '../../../types/wizard';
import { hasMeaningfulContent } from '../../../utils/meaningfulDraft';
import { autosaveReducer, initialAutosaveState, isAutosaveBusy } from './autosaveMachine';

const AUTOSAVE_DEBOUNCE_MS = 1000;

export type AutosaveErrorKind = 'create' | 'save';

export interface UseDraftAutosaveOptions {
  draftId: string | null;
  config: RWAConfig;
  targetId: string;
  currentStep: WizardStepId;
  storage: WizardDraftStorageApi;
  onDraftCreated?: (id: string) => void;
  /** Called after a draft is successfully persisted (create or update). */
  onPersistSuccess?: () => void;
  /** Called when a persist attempt fails. The hook preserves in-memory state regardless. */
  onPersistError?: (kind: AutosaveErrorKind, error: unknown) => void;
}

export interface UseDraftAutosaveResult {
  isSaving: boolean;
}

interface LatestInputs {
  draftId: string | null;
  config: RWAConfig;
  targetId: string;
  currentStep: WizardStepId;
}

/**
 * Debounced autosave hook for wizard drafts.
 *
 * Creates a new draft when meaningful content is entered and no draftId exists;
 * saves to the existing draft when draftId is set. Keeps the draft title in
 * sync with the token name (unless manually renamed).
 *
 * Internally driven by the {@link autosaveReducer} state machine
 * (`idle → debouncing → saving → saving-pending → error`) which makes edge
 * cases — in-flight edits, retry-after-error, cancel-on-unmount — explicit
 * and unit-testable.
 */
export function useDraftAutosave({
  draftId,
  config,
  targetId,
  currentStep,
  storage,
  onDraftCreated,
  onPersistSuccess,
  onPersistError,
}: UseDraftAutosaveOptions): UseDraftAutosaveResult {
  const [state, dispatch] = useReducer(autosaveReducer, initialAutosaveState);

  // Locally-adopted draftId after a successful `create`. Held until the
  // parent catches up with its own state update. Without this, a rapid edit
  // during the create round-trip can race the parent's prop update and
  // produce a duplicate draft on the next persist pass. Cleared whenever
  // the parent's `draftId` prop changes (including to `null` on reset).
  const locallyAdoptedIdRef = useRef<string | null>(null);
  const lastObservedDraftIdRef = useRef<string | null>(draftId);
  if (lastObservedDraftIdRef.current !== draftId) {
    locallyAdoptedIdRef.current = null;
    lastObservedDraftIdRef.current = draftId;
  }
  const effectiveDraftId = draftId ?? locallyAdoptedIdRef.current;

  // Capture the freshest inputs so the save effect always operates on the
  // most recent config/targetId/step, even if it was queued while previous
  // renders were still in flight.
  const latestRef = useRef<LatestInputs>({
    draftId: effectiveDraftId,
    config,
    targetId,
    currentStep,
  });
  latestRef.current = { draftId: effectiveDraftId, config, targetId, currentStep };

  // Destructure only the methods used so `persist` does not re-create when
  // `storage.drafts` (the live list) updates — which would cause an infinite
  // save loop.
  const { get, create, save } = storage;

  // Callbacks via refs so we can invoke the latest version without retriggering
  // effects when the parent re-creates closures.
  const onDraftCreatedRef = useRef(onDraftCreated);
  onDraftCreatedRef.current = onDraftCreated;
  const onPersistSuccessRef = useRef(onPersistSuccess);
  onPersistSuccessRef.current = onPersistSuccess;
  const onPersistErrorRef = useRef(onPersistError);
  onPersistErrorRef.current = onPersistError;

  // Dispatch EDIT whenever meaningful inputs change. Skipping empty configs
  // keeps the machine in `idle` until the user has actually typed something.
  useEffect(() => {
    if (!hasMeaningfulContent(config)) return;
    dispatch({ type: 'EDIT' });
  }, [config, currentStep, draftId, targetId]);

  // Debounce effect: while phase === 'debouncing', schedule a timer. Each edit
  // bumps `editTick`, which restarts the timer via the dep array.
  useEffect(() => {
    if (state.phase !== 'debouncing') return;
    const timer = setTimeout(() => {
      dispatch({ type: 'DEBOUNCE_ELAPSED' });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state.phase, state.editTick]);

  const persist = useCallback(async (): Promise<void> => {
    const { draftId: id, config: cfg, targetId: tid, currentStep: step } = latestRef.current;

    // Guard against racing clears of the token name between debounce and save.
    if (!hasMeaningfulContent(cfg)) return;

    const derivedTitle = cfg.token.name.trim() || cfg.token.symbol.trim() || 'Untitled';

    if (id) {
      const existing = await get(id);
      const titlePatch =
        existing && !existing.metadata?.isManuallyRenamed ? { title: derivedTitle } : {};
      await save(id, { config: cfg, currentStep: step, ...titlePatch });
    } else {
      const newId = await create({
        title: derivedTitle,
        targetId: tid,
        config: cfg,
        currentStep: step,
        metadata: { isManuallyRenamed: false, importSource: 'manual' },
      });
      // Adopt the new id locally before notifying the parent so that any
      // follow-up persist triggered by `saving-pending → saving` sees the
      // freshly-created draftId and issues a `save` (not another `create`).
      // The render-time merge above keeps this id in `latestRef.current`
      // even if the parent has not yet re-rendered with its updated prop.
      locallyAdoptedIdRef.current = newId;
      latestRef.current = { ...latestRef.current, draftId: newId };
      onDraftCreatedRef.current?.(newId);
    }
  }, [get, save, create]);

  // Persist effect: fires every time saveRunId changes (i.e. on each entry
  // into `saving`). We skip the initial render where saveRunId === 0.
  useEffect(() => {
    if (state.saveRunId === 0) return;
    const id = latestRef.current.draftId;
    let cancelled = false;

    persist()
      .then(() => {
        if (cancelled) return;
        onPersistSuccessRef.current?.();
        dispatch({ type: 'PERSIST_SUCCEEDED' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // `id` reflects the draftId at save-start; if it was null we attempted
        // a create, otherwise a save. This preserves the prior API contract.
        onPersistErrorRef.current?.(id ? 'save' : 'create', err);
        dispatch({ type: 'PERSIST_FAILED', error: err });
      });

    return () => {
      cancelled = true;
    };
  }, [state.saveRunId, persist]);

  return { isSaving: isAutosaveBusy(state) };
}
