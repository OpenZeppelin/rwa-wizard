import { useMemo } from 'react';
import type { ReactNode } from 'react';

import {
  defaultWizardDraftStorageApi,
  WizardDraftStorageContext,
} from './wizardDraftStorageContext';
import type { WizardDraftStorageApi } from './wizardDraftStorageContext';

export function WizardDraftStorageProvider({
  children,
  api = defaultWizardDraftStorageApi,
}: {
  children: ReactNode;
  api?: WizardDraftStorageApi;
}) {
  const value = useMemo(() => api, [api]);
  return (
    <WizardDraftStorageContext.Provider value={value}>
      {children}
    </WizardDraftStorageContext.Provider>
  );
}
