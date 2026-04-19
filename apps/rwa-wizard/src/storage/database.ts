import { createDexieDatabase } from '@openzeppelin/ui-storage';

const WIZARD_DRAFTS_STORE = 'wizardDrafts';

/**
 * IndexedDB database for the RWA Wizard app.
 * Uses @openzeppelin/ui-storage for schema and lifecycle.
 * Single store: wizard drafts (WizardDraftRecord).
 */
export const db: ReturnType<typeof createDexieDatabase> = createDexieDatabase('RwaWizard', [
  {
    version: 1,
    stores: {
      [WIZARD_DRAFTS_STORE]: '++id, targetId, status, updatedAt',
    },
  },
]);

export const WIZARD_DRAFTS_TABLE_NAME = WIZARD_DRAFTS_STORE;
