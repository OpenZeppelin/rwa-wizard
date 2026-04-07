import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import { createDefaultRwaConfig } from '../utils/defaultRwaConfig';
import { WizardDraftStorage } from './WizardDraftStorage';

function makeConfig(overrides: Partial<RWAConfig> = {}): RWAConfig {
  return { ...createDefaultRwaConfig(), ...overrides };
}

describe('WizardDraftStorage', () => {
  let storage: WizardDraftStorage;

  beforeEach(() => {
    storage = new WizardDraftStorage();
  });

  afterEach(async () => {
    const all = await storage.list();
    for (const item of all) {
      await storage.remove(item.id);
    }
  });

  describe('create', () => {
    it('creates a draft and returns an id', async () => {
      const id = await storage.create({
        title: 'My Token',
        targetId: 'stellar',
        config: makeConfig({ token: { ...createDefaultRwaConfig().token, name: 'MyToken' } }),
        metadata: { isManuallyRenamed: false, importSource: 'manual' },
      });
      expect(id).toBeTruthy();
    });

    it('trims whitespace from title', async () => {
      const id = await storage.create({
        title: '  Spaced  ',
        targetId: 'stellar',
        config: makeConfig(),
        metadata: { isManuallyRenamed: false, importSource: 'manual' },
      });
      const draft = await storage.get(id);
      expect(draft?.title).toBe('Spaced');
    });

    it('defaults empty title to Untitled', async () => {
      const id = await storage.create({
        title: '  ',
        targetId: 'stellar',
        config: makeConfig(),
        metadata: { isManuallyRenamed: false, importSource: 'manual' },
      });
      const draft = await storage.get(id);
      expect(draft?.title).toBe('Untitled');
    });
  });

  describe('list', () => {
    it('returns all drafts as lightweight items', async () => {
      await storage.create({
        title: 'A',
        targetId: 'stellar',
        config: makeConfig(),
        metadata: { isManuallyRenamed: false, importSource: 'manual' },
      });
      await storage.create({
        title: 'B',
        targetId: 'stellar',
        config: makeConfig(),
        metadata: { isManuallyRenamed: false, importSource: 'manual' },
      });
      const items = await storage.list();
      expect(items.length).toBe(2);
      expect(items[0]).toHaveProperty('id');
      expect(items[0]).toHaveProperty('title');
      expect(items[0]).toHaveProperty('targetId');
      expect(items[0]).toHaveProperty('status');
      expect(items[0]).toHaveProperty('updatedAt');
    });
  });

  describe('saveDraft', () => {
    it('updates a draft field', async () => {
      const id = await storage.create({
        title: 'Original',
        targetId: 'stellar',
        config: makeConfig(),
        metadata: { isManuallyRenamed: false, importSource: 'manual' },
      });
      await storage.saveDraft(id, { status: 'ready' });
      const draft = await storage.get(id);
      expect(draft?.status).toBe('ready');
    });

    it('rejects for unknown id', async () => {
      await expect(storage.saveDraft('nonexistent', { status: 'ready' })).rejects.toThrow(
        'draft-storage/not-found'
      );
    });
  });

  describe('rename', () => {
    it('renames a draft and marks as manually renamed', async () => {
      const id = await storage.create({
        title: 'Original',
        targetId: 'stellar',
        config: makeConfig(),
        metadata: { isManuallyRenamed: false, importSource: 'manual' },
      });
      await storage.rename(id, 'Renamed');
      const draft = await storage.get(id);
      expect(draft?.title).toBe('Renamed');
      expect(draft?.metadata.isManuallyRenamed).toBe(true);
    });
  });

  describe('remove', () => {
    it('deletes only the specified draft', async () => {
      const id1 = await storage.create({
        title: 'A',
        targetId: 'stellar',
        config: makeConfig(),
        metadata: { isManuallyRenamed: false, importSource: 'manual' },
      });
      const id2 = await storage.create({
        title: 'B',
        targetId: 'stellar',
        config: makeConfig(),
        metadata: { isManuallyRenamed: false, importSource: 'manual' },
      });
      await storage.remove(id1);
      const items = await storage.list();
      expect(items.length).toBe(1);
      expect(items[0].id).toBe(id2);
    });
  });

  describe('export / import', () => {
    it('round-trips drafts through export and import', async () => {
      await storage.create({
        title: 'Exported',
        targetId: 'stellar',
        config: makeConfig({ token: { ...createDefaultRwaConfig().token, name: 'Test' } }),
        metadata: { isManuallyRenamed: false, importSource: 'manual' },
      });
      const json = await storage.export();
      const ids = await storage.import(json);
      expect(ids.length).toBe(1);
      const imported = await storage.get(ids[0]);
      expect(imported?.title).toBe('Exported');
      expect(imported?.metadata.importSource).toBe('imported');
    });

    it('creates new ids on import', async () => {
      const originalId = await storage.create({
        title: 'Original',
        targetId: 'stellar',
        config: makeConfig(),
        metadata: { isManuallyRenamed: false, importSource: 'manual' },
      });
      const json = await storage.export();
      const ids = await storage.import(json);
      expect(ids[0]).not.toBe(originalId);
    });

    it('rejects invalid JSON', async () => {
      await expect(storage.import('not-json')).rejects.toThrow('draft-storage/import-invalid-json');
    });

    it('rejects envelopes without schema version', async () => {
      await expect(storage.import(JSON.stringify({ drafts: [] }))).rejects.toThrow(
        'draft-storage/import-invalid-envelope'
      );
    });
  });
});
