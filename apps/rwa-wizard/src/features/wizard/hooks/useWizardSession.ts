import { useCallback, useEffect, useRef, useState } from 'react';

import { DEFAULT_TARGET_ID } from '../../../app/routes/wizardConstants';
import { useWizardStore } from '../../../app/state/useWizardStore';
import { wizardStore } from '../../../app/state/wizardStore';
import { useWizardDraftStorage } from '../../../storage';
import { isTargetId, type TargetId, type WizardStepId } from '../../../types/wizard';
import { getErrorMessage } from '../../../utils/errorReporting';
import { useDraftAutosave } from '../../draft-management/hooks/useDraftAutosave';
import { useGenerationFlow } from '../../generation/hooks/useGenerationFlow';
import { useWizardDraftState } from '../state/useWizardDraftState';
import { useTargetRuntime, type TargetRuntimeState } from './useTargetRuntime';

/** Fixed minimum visible duration for each generation phase in the progress dialog. */
const GENERATION_MIN_PHASE_DURATION_MS = 450;

export interface WizardSession {
  activeDraftId: string | null;
  currentStep: WizardStepId;
  selectedTargetId: TargetId;
  draftState: ReturnType<typeof useWizardDraftState>;
  runtime: TargetRuntimeState;
  generation: ReturnType<typeof useGenerationFlow>;
  persistError: string | null;
  clearPersistError: () => void;
  /**
   * Monotonic key the page can include on child containers to force a remount.
   * Bumped on Cancel (reset) and when a different draft is hydrated from
   * storage (sidebar selection). Crucially, *not* bumped when autosave
   * promotes a "new" in-memory form into a freshly-created draft id —
   * keying off `activeDraftId` directly would unmount the form mid-keystroke
   * on the user's first input, dropping focus.
   */
  resetKey: number;
  /** Cancels the active draft, clears local form state, and bumps `resetKey` for a full remount. */
  resetSession: () => void;
}

/**
 * Orchestrates the wizard page: hydrates drafts from storage when the
 * active id changes, runs autosave, loads the target runtime, drives
 * generation, and surfaces persist errors for display.
 *
 * Encapsulating the orchestration here keeps the page component itself
 * purely presentational (steps + navigation + error banners), and makes
 * the state machine testable without the WizardLayout chrome in the way.
 */
export function useWizardSession(): WizardSession {
  const activeDraftId = useWizardStore((s) => s.activeDraftId);
  const currentStep = useWizardStore((s) => s.currentStep);
  const targetId = useWizardStore((s) => s.targetId);
  const selectedTargetId: TargetId = targetId ?? DEFAULT_TARGET_ID;

  const storage = useWizardDraftStorage();
  const draftState = useWizardDraftState();
  const [persistError, setPersistError] = useState<string | null>(null);

  const runtime = useTargetRuntime(selectedTargetId);

  // Draft ids that were created locally in this session via autosave. When
  // the store transitions to one of these ids we MUST NOT re-hydrate from
  // storage: our in-memory `draftState.config` is authoritative and fresher
  // than any snapshot storage may have persisted. Re-reading storage here
  // would overwrite user keystrokes typed between the create round-trip
  // and this effect firing (see "silent data overwrite after first autosave").
  const locallyCreatedIdsRef = useRef<Set<string>>(new Set());

  const [resetKey, setResetKey] = useState(0);

  // Load the draft record when activeDraftId changes; clear form state when
  // id is cleared (e.g. delete). `isActive` guards against races when the
  // user switches drafts while a prior `get` is still pending.
  useEffect(() => {
    let isActive = true;

    async function syncDraftFromStorage() {
      const id = activeDraftId;
      if (!id) {
        draftState.resetConfig();
        return;
      }
      if (locallyCreatedIdsRef.current.has(id)) {
        locallyCreatedIdsRef.current.delete(id);
        return;
      }
      const draft = await storage.get(id);
      if (!isActive) return;
      if (!draft) {
        wizardStore.setActiveDraft(null);
        draftState.resetConfig();
        return;
      }
      // `draft.targetId` is persisted as `string` to be forward-compatible
      // with future chains. Narrow here before pushing into the strongly-
      // typed store; unknown values fall back to the default rather than
      // crashing a legitimately-restored draft.
      wizardStore.setTargetId(isTargetId(draft.targetId) ? draft.targetId : DEFAULT_TARGET_ID);
      wizardStore.setCurrentStep(draft.currentStep);
      draftState.setConfig(draft.config);
      // Bump the mount key so any wizard-step component holding local
      // (uncontrolled) state is rebuilt against the freshly-loaded draft,
      // matching the previous behavior of keying the layout off
      // `activeDraftId`. The autosave-created branch above returns early,
      // so first-keystroke draft creation no longer triggers a remount.
      setResetKey((k) => k + 1);
    }
    void syncDraftFromStorage();

    return () => {
      isActive = false;
    };
    // Intentionally only re-run on draft id changes — config edits must not
    // retrigger storage reads (would clobber keystrokes). React-hooks
    // exhaustive-deps is off for this file (it's .ts, not .tsx).
  }, [activeDraftId]);

  const handleDraftCreated = useCallback((id: string) => {
    locallyCreatedIdsRef.current.add(id);
    wizardStore.setActiveDraft(id);
  }, []);

  const handlePersistSuccess = useCallback(() => {
    wizardStore.bumpDraftListRefresh();
    setPersistError(null);
  }, []);

  const handlePersistError = useCallback((kind: 'create' | 'save', err: unknown) => {
    const detail = getErrorMessage(err);
    setPersistError(
      kind === 'create'
        ? `Unable to save this draft to your browser: ${detail}`
        : `Unable to update this draft: ${detail}`
    );
  }, []);

  const { isSaving } = useDraftAutosave({
    draftId: activeDraftId,
    config: draftState.config,
    targetId: selectedTargetId,
    currentStep,
    storage,
    onDraftCreated: handleDraftCreated,
    onPersistSuccess: handlePersistSuccess,
    onPersistError: handlePersistError,
  });

  const generation = useGenerationFlow({
    draftId: activeDraftId,
    config: draftState.config,
    codegenService: runtime.codegenService,
    // The user explicitly saves the file from the success dialog — browsers
    // don't tell us whether a download actually lands on disk, so forcing
    // an auto-download would let the UI claim "downloaded" when the user
    // could have canceled the browser save dialog.
    autoDownload: false,
    // Real codegen often completes in single-digit ms, which makes the
    // phase list in the dialog flash by unreadably. A small per-phase floor
    // turns the progress into a perceptible animation without noticeably
    // slowing real generation (phases with real work still reflect actual
    // duration).
    minPhaseDurationMs: GENERATION_MIN_PHASE_DURATION_MS,
  });

  useEffect(() => {
    if (isSaving && activeDraftId) {
      wizardStore.setSavingDraftId(activeDraftId);
    } else {
      wizardStore.setSavingDraftId(null);
    }
    return () => {
      wizardStore.setSavingDraftId(null);
    };
  }, [isSaving, activeDraftId]);

  const resetSession = useCallback(() => {
    wizardStore.reset();
    draftState.resetConfig();
    setResetKey((k) => k + 1);
  }, [draftState]);

  return {
    activeDraftId,
    currentStep,
    selectedTargetId,
    draftState,
    runtime,
    generation,
    persistError,
    clearPersistError: () => setPersistError(null),
    resetKey,
    resetSession,
  };
}
