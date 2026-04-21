import { afterEach, describe, expect, it } from 'vitest';

import { db } from './database';

describe('RwaWizard IndexedDB schema', () => {
  afterEach(async () => {
    await db.close();
  });

  it('includes wizardDrafts and aliases stores (v2 migration)', async () => {
    await db.open();
    const names = db.tables.map((t) => t.name).sort();
    expect(names).toContain('aliases');
    expect(names).toContain('wizardDrafts');
  });
});
