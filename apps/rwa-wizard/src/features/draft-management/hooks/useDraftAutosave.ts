import { useCallback, useEffect, useRef, useState } from 'react';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { WizardDraftStorageApi } from '../../../storage/wizardDraftStorageContext';
import type { WizardStepId } from '../../../types/wizard';
import { hasMeaningfulContent } from '../../../utils/meaningfulDraft';

const AUTOSAVE_DEBOUNCE_MS = 1000;

export interface UseDraftAutosaveOptions {
  draftId: string | null;
  config: RWAConfig;
  targetId: string;
  currentStep: WizardStepId;
  storage: WizardDraftStorageApi;
  onDraftCreated?: (id: string) => void;
  /** Called after a draft is successfully persisted (create or update). */
  onPersistSuccess?: () => void;
}

export interface UseDraftAutosaveResult {
  isSaving: boolean;
}

/**
 * Debounced autosave hook for wizard drafts.
 * Creates a new draft when meaningful content is entered and no draftId exists.
 * Saves to the existing draft when draftId is set.
 * Keeps the draft title in sync with the token name (unless manually renamed).
 */
export function useDraftAutosave({
  draftId,
  config,
  targetId,
  currentStep,
  storage,
  onDraftCreated,
  onPersistSuccess,
}: UseDraftAutosaveOptions): UseDraftAutosaveResult {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const latestRef = useRef({ draftId, config, targetId, currentStep });
  const [isSaving, setIsSaving] = useState(false);

  latestRef.current = { draftId, config, targetId, currentStep };

  // Destructure only the methods used so `persist` does not re-create when
  // `storage.drafts` (the live list) updates — which would cause an infinite
  // save loop: save → IndexedDB write → liveDrafts update → new storage ref →
  // new persist → autosave effect re-fires → save again.
  const { get, create, save } = storage;

  const persist = useCallback(async () => {
    if (savingRef.current) return;
    const { draftId: id, config: cfg, targetId: tid, currentStep: step } = latestRef.current;

    if (!hasMeaningfulContent(cfg)) return;

    savingRef.current = true;
    setIsSaving(true);
    try {
      const derivedTitle = cfg.token.name.trim() || cfg.token.symbol.trim() || 'Untitled';

      if (id) {
        // Sync title from token name unless the user has manually renamed the draft.
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
        onDraftCreated?.(newId);
      }
      onPersistSuccess?.();
    } catch {
      // Storage failures must not destroy the in-memory session (contract).
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [get, save, create, onDraftCreated, onPersistSuccess]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void persist();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [config, currentStep, persist]);

  return { isSaving };
}
