import { expect } from 'vitest';

import type { ConceptDictionary } from '../types';

/**
 * Shared assertions for a category dictionary. Every category requires
 * the same structural invariants — matching ids, non-empty descriptions
 * (or placeholders), distinct infoCopy — so rather than repeat the same
 * four `describe` blocks in every test file, we centralise them here.
 *
 * Use `requireInfoCopy: false` for categories where a tooltip is optional
 * (e.g. sections use only `infoCopy`, field helpers use only `description`).
 */
export function assertDictionaryShape(
  dict: ConceptDictionary,
  options: {
    expectedIds: readonly string[];
    requireDescription?: boolean;
    requireInfoCopy?: boolean;
  }
) {
  const { expectedIds, requireDescription = true, requireInfoCopy = false } = options;

  expect(Object.keys(dict).sort()).toEqual([...expectedIds].sort());

  for (const [key, entry] of Object.entries(dict)) {
    expect(entry.id, `id mismatch for ${key}`).toBe(key);
    if (requireDescription) {
      expect(
        entry.description.trim().length,
        `missing description for ${entry.id}`
      ).toBeGreaterThan(0);
    }
    if (requireInfoCopy) {
      expect(entry.infoCopy, `missing infoCopy for ${entry.id}`).toBeTruthy();
      expect(entry.infoCopy!.trim().length).toBeGreaterThan(0);
    }
    if (entry.infoCopy && entry.description) {
      expect(entry.infoCopy.trim(), `infoCopy duplicates description for ${entry.id}`).not.toBe(
        entry.description.trim()
      );
    }
  }
}
