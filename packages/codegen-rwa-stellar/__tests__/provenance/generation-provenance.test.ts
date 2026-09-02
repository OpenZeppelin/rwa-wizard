/**
 * SF-3 acceptance spine: the properties that must hold for EVERY fixture on
 * BOTH generate paths, independent of which files have ranges yet.
 *
 * These are deliberately shape-and-coverage assertions, not attribution
 * assertions — byte identity and semantic attribution are separate proofs
 * (D10), and the semantic ones live in the per-shape suites that land with
 * their checkpoints.
 */
import { describe, expect, it } from 'vitest';

import { hasProvenance } from '@openzeppelin/codegen-core';

import {
  fileEntry,
  GENERATE_PATHS,
  generateRecorded,
  GOLDEN_FIXTURES,
  topicUnselectedConfig,
  wellFormedProblems,
} from './helpers';

/**
 * Configs the golden matrix does not carry (INV-10 forbids new golden
 * directories) but whose bytes must still be independent of recording. The
 * two `GenerateOptions` dimensions the matrix also lacks are not here on
 * purpose: `contractsLibraryPath` needs a local checkout on disk, and no
 * module in the registry is `under-review`, so `allowUnderReviewModules` has
 * nothing to change yet.
 */
const PROVENANCE_ONLY_CONFIGS = [
  { name: 'claim-topic-unselected', config: topicUnselectedConfig() },
];

describe.each(GENERATE_PATHS)('$name — provenance acceptance', (path) => {
  describe.each(GOLDEN_FIXTURES)('$name', (fixture) => {
    // INV-3: total and exact in both directions.
    it('records exactly one provenance key per emitted file, and no orphans', () => {
      const { files, provenance } = generateRecorded(path, fixture.config);

      expect(Object.keys(provenance.files).sort()).toEqual(Object.keys(files).sort());
    });

    // INV-4: every entry well-formed and in range against the FINAL text.
    it('records only well-formed, in-range entries', () => {
      const { files, provenance } = generateRecorded(path, fixture.config);

      expect(wellFormedProblems(provenance, files)).toEqual([]);
    });

    // INV-1: the flag changes no byte and no hash.
    it('returns identical files and configHash whether or not recording is on', () => {
      const off = path.run(fixture.config);
      const explicitlyOff = path.run(fixture.config, { recordProvenance: false });
      const on = path.run(fixture.config, { recordProvenance: true });

      expect(on.files).toEqual(off.files);
      expect(explicitlyOff.files).toEqual(off.files);
      expect(on.metadata.configHash).toBe(off.metadata.configHash);
      expect(explicitlyOff.metadata.configHash).toBe(off.metadata.configHash);
      expect(on.metadata.fileCount).toBe(off.metadata.fileCount);
    });

    // INV-2: absence of the key, not an undefined value.
    it('has no own provenance property unless recording was requested', () => {
      const off = path.run(fixture.config);
      const explicitlyOff = path.run(fixture.config, { recordProvenance: false });
      const on = path.run(fixture.config, { recordProvenance: true });

      expect(Object.prototype.hasOwnProperty.call(off, 'provenance')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(explicitlyOff, 'provenance')).toBe(false);
      expect('provenance' in off).toBe(false);
      expect(hasProvenance(off)).toBe(false);
      expect(hasProvenance(explicitlyOff)).toBe(false);
      expect(hasProvenance(on)).toBe(true);
    });

    // INV-12: two identical calls agree deeply.
    it('is deterministic across repeated generations', () => {
      const first = generateRecorded(path, fixture.config);
      const second = generateRecorded(path, fixture.config);

      expect(second.provenance).toEqual(first.provenance);
    });
  });
});

describe.each(GENERATE_PATHS)('$name — scope boundary', (path) => {
  const baseline = GOLDEN_FIXTURES[0];
  if (baseline === undefined) throw new Error('the golden fixture matrix is empty');

  /**
   * INV-15. `config.json` is excepted by construction: it serialises the whole
   * config, so it depends on every leaf honestly. Every other file must be
   * clean — a locked control leaking onto a contract or script means validation
   * or hashing ran inside a file scope.
   */
  it.each([
    'token.administrativeControls.burnable',
    'token.administrativeControls.mintable',
    'token.administrativeControls.pausable',
  ])('does not attribute the locked control %s to any file but config.json', (locked) => {
    const { provenance } = generateRecorded(path, baseline.config);

    const claiming = Object.entries(provenance.files)
      .filter(([filePath]) => filePath !== 'config.json')
      .filter(([, file]) => file.entries.some((entry) => entry.paths.includes(locked)))
      .map(([filePath]) => filePath);

    expect(claiming).toEqual([]);
  });

  // INV-16: config.json's dependency is honest — it really does read the config.
  it('attributes config.json to the config it serialises', () => {
    const { provenance } = generateRecorded(path, baseline.config);

    expect(fileEntry(provenance, 'config.json').paths.length).toBeGreaterThan(0);
  });
});

describe.each(GENERATE_PATHS)('$name — recording is byte-neutral off the golden matrix', (path) => {
  describe.each(PROVENANCE_ONLY_CONFIGS)('$name', (fixture) => {
    it('returns identical files and configHash whether or not recording is on', () => {
      const off = path.run(fixture.config);
      const on = path.run(fixture.config, { recordProvenance: true });

      expect(on.files).toEqual(off.files);
      expect(on.metadata.configHash).toBe(off.metadata.configHash);
    });

    it('records exactly one provenance key per emitted file', () => {
      const { files, provenance } = generateRecorded(path, fixture.config);

      expect(Object.keys(provenance.files).sort()).toEqual(Object.keys(files).sort());
    });
  });
});
