import type { WizardStepId } from '../../types/wizard';

export interface WizardState {
  /** Currently selected/active draft id (null when no draft or creating new). */
  activeDraftId: string | null;
  /** Current wizard step for the active draft. */
  currentStep: WizardStepId;
  /** Target id for the current flow (e.g. stellar). */
  targetId: string | null;
  /** When set, the draft list shows a saving animation for this id (autosave in progress). */
  savingDraftId: string | null;
  /** Incremented after persisted draft changes so the sidebar list can refresh. */
  draftListRefreshTick: number;
}

const initialState: WizardState = {
  activeDraftId: null,
  currentStep: 'asset',
  targetId: null,
  savingDraftId: null,
  draftListRefreshTick: 0,
};

let state: WizardState = { ...initialState };
const listeners = new Set<(s: WizardState) => void>();

function getState(): WizardState {
  return state;
}

function setState(partial: Partial<WizardState>): void {
  state = { ...state, ...partial };
  listeners.forEach((fn) => fn(state));
}

/**
 * Shared wizard state container (foundational seam for Phase 3).
 * Subscribers get notified on change; used by AppRouter and wizard steps.
 */
export const wizardStore = {
  getState,
  setState,
  subscribe(fn: (s: WizardState) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  setActiveDraft(id: string | null): void {
    setState({ activeDraftId: id });
  },
  setCurrentStep(step: WizardStepId): void {
    setState({ currentStep: step });
  },
  setTargetId(id: string | null): void {
    setState({ targetId: id });
  },
  reset(): void {
    state = { ...initialState };
    listeners.forEach((fn) => fn(state));
  },
  setSavingDraftId(id: string | null): void {
    setState({ savingDraftId: id });
  },
  /** Call after a draft is written to storage so Recent Assets titles/metadata stay in sync. */
  bumpDraftListRefresh(): void {
    setState({ draftListRefreshTick: state.draftListRefreshTick + 1 });
  },
};
