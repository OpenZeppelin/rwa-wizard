import { EntityStorage, withQuotaHandling } from '@openzeppelin/ui-storage';

import type {
  CreateDraftInput,
  DraftListItem,
  SaveDraftPatch,
  WizardDraftRecord,
} from '../types/wizard';
import { db, WIZARD_DRAFTS_TABLE_NAME } from './database';

const EXPORT_SCHEMA_VERSION = '1.0';

interface WizardDraftRecordPersisted extends WizardDraftRecord {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Persistence layer for wizard drafts (contract: draft-storage-contract).
 * Extends EntityStorage for list/create/get/save/rename/remove and versioned export/import.
 */
export class WizardDraftStorage extends EntityStorage<WizardDraftRecordPersisted> {
  constructor() {
    super(db, WIZARD_DRAFTS_TABLE_NAME);
  }

  /**
   * Returns lightweight list items for draft list UI, ordered by updatedAt descending.
   */
  async list(): Promise<DraftListItem[]> {
    const all = await this.getAll();
    return all.map((r) => ({
      id: r.id,
      title: r.title,
      targetId: r.targetId,
      status: r.status,
      symbol: r.config.token.symbol,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Creates a new draft. Call only after meaningful content exists (contract).
   * Returns the new draft id.
   */
  async create(input: CreateDraftInput): Promise<string> {
    const schemaVersion = input.metadata.schemaVersion ?? EXPORT_SCHEMA_VERSION;
    const metadata = {
      ...input.metadata,
      schemaVersion,
    };
    return await withQuotaHandling(this.tableName, async () => {
      return await super.save({
        title: input.title.trim() || 'Untitled',
        targetId: input.targetId,
        status: 'draft',
        currentStep: input.currentStep ?? 'asset',
        config: input.config,
        metadata,
      });
    });
  }

  /**
   * Updates an existing draft by id. Updates updatedAt (EntityStorage hook).
   * Exposed as "save" in the storage contract API.
   */
  async saveDraft(id: string, patch: SaveDraftPatch): Promise<void> {
    const record = await this.get(id);
    if (!record) {
      throw new Error(`draft-storage/not-found`);
    }
    const {
      id: _id,
      createdAt: _c,
      updatedAt: _u,
      ...rest
    } = patch as Partial<WizardDraftRecordPersisted>;
    await this.update(id, rest);
  }

  /**
   * Renames a draft and marks it as manually renamed so autosave does not overwrite.
   */
  async rename(id: string, title: string): Promise<void> {
    const record = await this.get(id);
    if (!record) {
      throw new Error(`draft-storage/not-found`);
    }
    await this.update(id, {
      title: title.trim() || record.title,
      metadata: {
        ...record.metadata,
        isManuallyRenamed: true,
      },
    });
  }

  /**
   * Removes a draft permanently. UI should confirm before calling.
   */
  async remove(id: string): Promise<void> {
    await this.delete(id);
  }

  /**
   * Creates a copy of an existing draft with a new id. Title and config are preserved
   * so duplicated token names are not altered.
   */
  async duplicate(id: string): Promise<string> {
    const original = await this.get(id);
    if (!original) {
      throw new Error(`draft-storage/not-found`);
    }
    const { id: _id, createdAt: _c, updatedAt: _u, ...recordData } = original;
    return await withQuotaHandling(this.tableName, async () => {
      return await super.save({
        ...recordData,
        metadata: {
          ...recordData.metadata,
          isManuallyRenamed: false,
        },
      });
    });
  }

  /**
   * Exports drafts as a versioned JSON envelope. If ids omitted, exports all.
   */
  async export(ids?: string[]): Promise<string> {
    const records = ids
      ? await Promise.all(ids.map((id) => this.get(id))).then((rows) =>
          rows.filter((r): r is WizardDraftRecordPersisted => r != null)
        )
      : await this.getAll();
    const envelope = {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      drafts: records.map((r) => ({
        ...r,
        id: undefined,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
        metadata: {
          ...r.metadata,
          lastOpenedAt:
            r.metadata.lastOpenedAt instanceof Date
              ? r.metadata.lastOpenedAt.toISOString()
              : r.metadata.lastOpenedAt,
        },
      })),
    };
    return JSON.stringify(envelope, null, 2);
  }

  /**
   * Imports from a versioned JSON envelope. Creates new drafts with new IDs; does not merge.
   */
  async import(json: string): Promise<string[]> {
    let envelope: {
      schemaVersion?: string;
      drafts?: Array<Omit<WizardDraftRecordPersisted, 'id' | 'createdAt' | 'updatedAt'>>;
    };
    try {
      envelope = JSON.parse(json) as typeof envelope;
    } catch {
      throw new Error('draft-storage/import-invalid-json');
    }
    if (!envelope.schemaVersion || !envelope.drafts?.length) {
      throw new Error('draft-storage/import-invalid-envelope');
    }
    const ids: string[] = [];
    for (const d of envelope.drafts) {
      const metadata = {
        ...d.metadata,
        importSource: 'imported' as const,
        schemaVersion: envelope.schemaVersion ?? EXPORT_SCHEMA_VERSION,
        lastOpenedAt: d.metadata?.lastOpenedAt
          ? typeof d.metadata.lastOpenedAt === 'string'
            ? new Date(d.metadata.lastOpenedAt)
            : d.metadata.lastOpenedAt
          : undefined,
      };
      const id = await super.save({
        title: d.title || 'Imported',
        targetId: d.targetId,
        status: d.status ?? 'draft',
        currentStep: d.currentStep ?? 'asset',
        config: d.config,
        metadata,
      });
      ids.push(id);
    }
    return ids;
  }
}

export const wizardDraftStorage = new WizardDraftStorage();
