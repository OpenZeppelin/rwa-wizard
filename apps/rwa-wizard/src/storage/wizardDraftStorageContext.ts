import { createContext } from 'react';

import type {
  CreateDraftInput,
  DraftListItem,
  SaveDraftPatch,
  WizardDraftRecord,
} from '../types/wizard';
import { wizardDraftStorage } from './WizardDraftStorage';

export interface WizardDraftStorageApi {
  list: () => Promise<DraftListItem[]>;
  get: (id: string) => Promise<WizardDraftRecord | undefined>;
  create: (input: CreateDraftInput) => Promise<string>;
  save: (id: string, patch: SaveDraftPatch) => Promise<void>;
  rename: (id: string, title: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  export: (ids?: string[]) => Promise<string>;
  import: (json: string) => Promise<string[]>;
}

export const defaultWizardDraftStorageApi: WizardDraftStorageApi = {
  list: () => wizardDraftStorage.list(),
  get: (id) => wizardDraftStorage.get(id),
  create: (input) => wizardDraftStorage.create(input),
  save: (id, patch) => wizardDraftStorage.saveDraft(id, patch),
  rename: (id, title) => wizardDraftStorage.rename(id, title),
  remove: (id) => wizardDraftStorage.remove(id),
  export: (ids) => wizardDraftStorage.export(ids),
  import: (json) => wizardDraftStorage.import(json),
};

export const WizardDraftStorageContext = createContext<WizardDraftStorageApi | null>(null);
