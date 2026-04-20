import { describe, expect, it } from 'vitest';

import { IDENTITY_CONTROLS_COPY } from './identity-controls';

describe('IDENTITY_CONTROLS_COPY', () => {
  it('covers the four standard identity-lifecycle capabilities', () => {
    expect(Object.keys(IDENTITY_CONTROLS_COPY).sort()).toEqual(
      [
        'identity.addressFreezing',
        'identity.partialTokenFreezing',
        'identity.recovery',
        'identity.forcedTransfers',
      ].sort()
    );
  });

  it('has non-empty description and infoCopy for every entry', () => {
    for (const entry of Object.values(IDENTITY_CONTROLS_COPY)) {
      expect(
        entry.description.trim().length,
        `missing description for ${entry.id}`
      ).toBeGreaterThan(0);
      expect(entry.infoCopy, `missing infoCopy for ${entry.id}`).toBeTruthy();
      expect(entry.infoCopy!.trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps infoCopy distinct from description (never duplicates)', () => {
    for (const entry of Object.values(IDENTITY_CONTROLS_COPY)) {
      expect(entry.infoCopy!.trim()).not.toBe(entry.description.trim());
    }
  });

  it('matches its own key as id', () => {
    for (const [key, entry] of Object.entries(IDENTITY_CONTROLS_COPY)) {
      expect(entry.id).toBe(key);
    }
  });
});
