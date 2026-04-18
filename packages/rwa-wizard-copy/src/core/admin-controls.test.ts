import { describe, expect, it } from 'vitest';

import { ADMIN_CONTROLS_COPY } from './admin-controls';

describe('ADMIN_CONTROLS_COPY', () => {
  it('covers the three standard administrative capabilities', () => {
    expect(Object.keys(ADMIN_CONTROLS_COPY).sort()).toEqual(
      ['admin.burnable', 'admin.mintable', 'admin.pausable'].sort()
    );
  });

  it('has non-empty description and infoCopy for every entry', () => {
    for (const entry of Object.values(ADMIN_CONTROLS_COPY)) {
      expect(
        entry.description.trim().length,
        `missing description for ${entry.id}`
      ).toBeGreaterThan(0);
      expect(entry.infoCopy, `missing infoCopy for ${entry.id}`).toBeTruthy();
      expect(entry.infoCopy!.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps infoCopy distinct from description (never duplicates)', () => {
    for (const entry of Object.values(ADMIN_CONTROLS_COPY)) {
      expect(entry.infoCopy!.trim()).not.toBe(entry.description.trim());
    }
  });

  it('matches its own key as id', () => {
    for (const [key, entry] of Object.entries(ADMIN_CONTROLS_COPY)) {
      expect(entry.id).toBe(key);
    }
  });
});
