import { migrateRwaConfig } from '@openzeppelin/rwa-config';
import { EntityStorage, withQuotaHandling } from '@openzeppelin/ui-storage';

import type {
  CreateDraftInput,
  DraftListItem,
  SaveDraftPatch,
  WizardDraftRecord,
  WizardDraftStatus,
  WizardStepId,
} from '../types/wizard';
import { WIZARD_DRAFT_STATUSES, WIZARD_STEP_IDS } from '../types/wizard';
import { db, WIZARD_DRAFTS_TABLE_NAME } from './database';

const EXPORT_SCHEMA_VERSION = '1.0';

/** Major versions this build knows how to import. */
const SUPPORTED_IMPORT_MAJORS = new Set(['1']);

const VALID_STATUSES: ReadonlySet<WizardDraftStatus> = new Set(WIZARD_DRAFT_STATUSES);
const VALID_STEPS: ReadonlySet<WizardStepId> = new Set(WIZARD_STEP_IDS);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

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
   * Returns a draft with forward-compatible config migrations applied.
   */
  override async get(id: string): Promise<WizardDraftRecordPersisted | undefined> {
    const record = await super.get(id);
    if (!record) {
      return undefined;
    }

    const migratedConfig = migrateRwaConfig(record.config);
    if (migratedConfig === record.config) {
      return record;
    }

    return { ...record, config: migratedConfig };
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
      drafts: records.map((r) => {
        // Strip id/createdAt/updatedAt — importer assigns fresh values.
        const { id: _id, createdAt, updatedAt, metadata, ...rest } = r;
        return {
          ...rest,
          createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
          updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt,
          metadata: {
            ...metadata,
            lastOpenedAt:
              metadata.lastOpenedAt instanceof Date
                ? metadata.lastOpenedAt.toISOString()
                : metadata.lastOpenedAt,
          },
        };
      }),
    };
    return JSON.stringify(envelope, null, 2);
  }

  /**
   * Imports from a versioned JSON envelope. Creates new drafts with new IDs; does not merge.
   *
   * Performs strict validation so a hand-crafted or truncated payload cannot
   * silently write malformed rows into IndexedDB.
   */
  async import(json: string): Promise<string[]> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new Error('draft-storage/import-invalid-json');
    }

    if (!isRecord(parsed)) {
      throw new Error('draft-storage/import-invalid-envelope');
    }

    const schemaVersion = parsed['schemaVersion'];
    const drafts = parsed['drafts'];
    if (typeof schemaVersion !== 'string' || !Array.isArray(drafts) || drafts.length === 0) {
      throw new Error('draft-storage/import-invalid-envelope');
    }

    const major = schemaVersion.split('.')[0];
    if (!SUPPORTED_IMPORT_MAJORS.has(major)) {
      throw new Error('draft-storage/import-unsupported-version');
    }

    const sanitizedDrafts = drafts.map((raw, index) =>
      sanitizeImportDraft(raw, index, schemaVersion)
    );
    const ids: string[] = [];
    for (const draft of sanitizedDrafts) {
      const id = await super.save(draft);
      ids.push(id);
    }
    return ids;
  }
}

type SanitizedImportDraft = Omit<WizardDraftRecordPersisted, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Validates a single draft entry from an import envelope and returns a
 * sanitized record suitable for `super.save`. Throws with a diagnostic
 * message when a required field is missing or malformed.
 */
function sanitizeImportDraft(
  raw: unknown,
  index: number,
  schemaVersion: string
): SanitizedImportDraft {
  if (!isRecord(raw)) {
    throw new Error(`draft-storage/import-invalid-draft:${index}:not-an-object`);
  }
  const { title, targetId, config, status, currentStep, metadata } = raw;

  if (typeof targetId !== 'string' || !targetId) {
    throw new Error(`draft-storage/import-invalid-draft:${index}:missing-target`);
  }
  if (!isRecord(config) || !isRecord((config as Record<string, unknown>)['token'])) {
    throw new Error(`draft-storage/import-invalid-draft:${index}:invalid-config`);
  }

  const resolvedStatus: WizardDraftStatus =
    typeof status === 'string' && VALID_STATUSES.has(status as WizardDraftStatus)
      ? (status as WizardDraftStatus)
      : 'draft';

  const resolvedStep: WizardStepId =
    typeof currentStep === 'string' && VALID_STEPS.has(currentStep as WizardStepId)
      ? (currentStep as WizardStepId)
      : 'asset';

  const incomingMetadata = isRecord(metadata) ? metadata : {};
  const lastOpenedAtRaw = incomingMetadata['lastOpenedAt'];
  const sanitizedMetadata = {
    isManuallyRenamed: Boolean(incomingMetadata['isManuallyRenamed']),
    importSource: 'imported' as const,
    schemaVersion,
    lastOpenedAt:
      typeof lastOpenedAtRaw === 'string'
        ? new Date(lastOpenedAtRaw)
        : lastOpenedAtRaw instanceof Date
          ? lastOpenedAtRaw
          : undefined,
  };

  return {
    title: typeof title === 'string' && title.trim() ? title : 'Imported',
    targetId,
    status: resolvedStatus,
    currentStep: resolvedStep,
    config: migrateRwaConfig(config as unknown as WizardDraftRecordPersisted['config']),
    metadata: sanitizedMetadata,
  };
}

export const wizardDraftStorage = new WizardDraftStorage();
