import { useCallback, useContext, useEffect, useRef, useState } from 'react';

import type { DraftListItem } from '../types/wizard';
import {
  defaultWizardDraftStorageApi,
  WizardDraftStorageContext,
} from './wizardDraftStorageContext';

export function useWizardDraftStorage() {
  const ctx = useContext(WizardDraftStorageContext);
  if (ctx) return ctx;
  return defaultWizardDraftStorageApi;
}

/** Hook that returns draft list and a refresh function. */
export function useDraftList(): {
  items: DraftListItem[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
} {
  const { list } = useWizardDraftStorage();
  const [items, setItems] = useState<DraftListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  /** Only the first load should show the full-list loading state; later refreshes keep rows mounted (typewriter, etc.). */
  const initialLoadDoneRef = useRef(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const next = await list();
      setItems(next);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setItems([]);
    } finally {
      if (!initialLoadDoneRef.current) {
        initialLoadDoneRef.current = true;
        setIsLoading(false);
      }
    }
  }, [list]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, isLoading, error, refresh };
}
