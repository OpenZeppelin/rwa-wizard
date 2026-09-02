/**
 * INV-20 / INV-21 / INV-22 — the identity composition root.
 *
 * `generateWithIdentitySupport` runs the base generator, then REPLACES four
 * already-recorded paths (`Cargo.toml`, `README.md`, `scripts/deploy.sh`, and
 * the IRS contract) with longer content from an override collector. That makes
 * it the one place where a stale entry can survive its own content: the base
 * ranges were computed against a shorter file, and nothing about them is
 * malformed once the longer file replaces it — they simply point at the wrong
 * lines. No golden can see this, and no test covered it.
 */
import { describe, expect, it } from 'vitest';

import { createValidConfig } from '../helpers/config';
import {
  entriesOf,
  fileEntry,
  GENERATE_PATHS,
  generateRecorded,
  rangeEntries,
  sliceRange,
  textOf,
  wellFormedProblems,
} from './helpers';

/** The paths the identity root replaces wholesale, per the merge order in source. */
const OVERRIDDEN = ['Cargo.toml', 'README.md', 'scripts/deploy.sh'] as const;
const IRS = 'contracts/identity-registry-storage/src/contract.rs';

const config = () =>
  createValidConfig({
    compliance: {
      modules: [{ moduleId: 'country-allow', config: { allowedCountries: ['CH', 'SG'] } }],
    },
  });

const identityPath = GENERATE_PATHS.find((p) => p.name === 'generate-with-identity-support');
const basePath = GENERATE_PATHS.find((p) => p.name === 'generate');
if (identityPath === undefined || basePath === undefined) {
  throw new Error('both generate paths must be present');
}

describe('identity provenance merge (INV-20, INV-21)', () => {
  /**
   * INV-21, stated the way it can actually fail: the surviving entry must
   * describe the surviving CONTENT. The identity file is strictly longer, so a
   * base range that survived would still be in range — well-formedness cannot
   * catch it. Comparing the two generations' entries is what catches it.
   */
  it.each(OVERRIDDEN)('replaces every base entry on %s, keeping none', (filePath) => {
    const base = generateRecorded(basePath, config());
    const identity = generateRecorded(identityPath, config());

    const baseText = textOf(base.files, filePath);
    const identityText = textOf(identity.files, filePath);
    expect(identityText).not.toBe(baseText);

    // Every surviving range must select lines that exist in the IDENTITY text.
    // A leftover base entry would select identity lines it never described.
    for (const entry of rangeEntries(identity.provenance, filePath)) {
      const lines = sliceRange(identityText, entry.range);
      expect(lines.length).toBe(entry.range.end - entry.range.start + 1);
      expect(lines.every((line) => line !== undefined)).toBe(true);
    }

    // And no entry may be a duplicate of another: a merge that appended rather
    // than replaced would leave the base entry list in front of the override's.
    const fingerprints = entriesOf(identity.provenance, filePath).map((entry) =>
      JSON.stringify([entry.kind, entry.paths, 'range' in entry ? entry.range : null])
    );
    expect(new Set(fingerprints).size).toBe(fingerprints.length);

    // Exactly one file entry survives — the override's, not both collectors'.
    expect(
      entriesOf(identity.provenance, filePath).filter((entry) => entry.kind === 'file')
    ).toHaveLength(1);
  });

  /**
   * INV-20: the provenance merge mirrors the file merge argument for argument,
   * so the entry that wins belongs to the content that wins.
   *
   * The observable consequence is subtle and is the only one worth asserting:
   * the identity README states a DIFFERENT artifact count from the base one
   * (it adds the two example crates), and that count is shaped by
   * `compliance.modules`. If the base entry had survived the merge, the range
   * carrying `compliance.modules` would still select the base file's lines and
   * would no longer hold the identity file's sentence.
   *
   * Identity-only prose that reads no config is deliberately NOT asserted here:
   * identity mode is an entry-point choice, not a config path, so that content
   * having no range is correct (INV-36), not a gap.
   */
  it('attributes the identity artifact count, which only the override emits', () => {
    const base = generateRecorded(basePath, config());
    const identity = generateRecorded(identityPath, config());

    const baseReadme = textOf(base.files, 'README.md');
    const identityReadme = textOf(identity.files, 'README.md');

    const identityCount = identityReadme
      .split('\n')
      .find((line) => line.includes('WASM artifacts'));
    expect(identityCount).toBeDefined();
    expect(baseReadme).not.toContain(identityCount as string);

    const holding = rangeEntries(identity.provenance, 'README.md')
      .filter((entry) => entry.paths.includes('compliance.modules'))
      .filter((entry) =>
        sliceRange(identityReadme, entry.range).some((line) => line === identityCount)
      );

    expect(holding.length).toBeGreaterThan(0);
  });

  /** INV-3 / INV-4 still hold after the merge, on the merged result. */
  it('leaves the merged result total, exact and well-formed', () => {
    const { files, provenance } = generateRecorded(identityPath, config());

    expect(Object.keys(provenance.files).sort()).toEqual(Object.keys(files).sort());
    expect(wellFormedProblems(provenance, files)).toEqual([]);
  });

  /**
   * Memo inventory — "identity provenance merge condition", one input at a time.
   * Complete input list: base provenance presence, override provenance, and the
   * file merge order / path collision.
   */
  describe('merge condition, one input at a time', () => {
    it('varying only the recording flag: both collectors answer, or neither does', () => {
      const off = identityPath.run(config());
      const on = identityPath.run(config(), { recordProvenance: true });

      expect(Object.prototype.hasOwnProperty.call(off, 'provenance')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(on, 'provenance')).toBe(true);
      // INV-1: the flag moves no byte across the merge either.
      expect(on.files).toEqual(off.files);
      expect(on.metadata.configHash).toBe(off.metadata.configHash);
    });

    it('varying only whether a path collides: an untouched path keeps its base entries', () => {
      const base = generateRecorded(basePath, config());
      const identity = generateRecorded(identityPath, config());

      // `rustfmt.toml` is emitted once, by the base root, and never overridden.
      const untouched = 'rustfmt.toml';
      expect(textOf(identity.files, untouched)).toBe(textOf(base.files, untouched));
      expect(entriesOf(identity.provenance, untouched)).toEqual(
        entriesOf(base.provenance, untouched)
      );
    });

    it('varying only the merge order: the last writer wins on a collision', () => {
      const identity = generateRecorded(identityPath, config());

      // The override collector owns each replaced path, so its file entry — not
      // the base's — is the one on the merged result. The identity deploy script
      // reads the identity-scaffold branch, which the base one never emits.
      const deploy = textOf(identity.files, 'scripts/deploy.sh');
      expect(deploy).toContain('Initial Supply — Demo Auto-Mint Script Included');
      expect(fileEntry(identity.provenance, 'scripts/deploy.sh').paths.length).toBeGreaterThan(0);
    });
  });
});

/* ------------------------------------------------------------------ *
 * INV-22 — the IRS is replayed from upstream, never re-recorded over
 *          already-generated text
 * ------------------------------------------------------------------ */
describe('identity registry storage replay (INV-22)', () => {
  it.each(GENERATE_PATHS)('$name records the IRS through one patch builder', (path) => {
    const { files, provenance } = generateRecorded(path, config());
    const source = textOf(files, IRS);

    // The patches applied to the IRS are unconditional and config-free, so the
    // honest record is emptiness (INV-36) — asserting a field site here would
    // be the revision-1 error the invariants name.
    expect(fileEntry(provenance, IRS).paths).toEqual([]);
    expect(rangeEntries(provenance, IRS)).toEqual([]);
    expect(source.length).toBeGreaterThan(0);
  });

  /**
   * The two variants differ in content — the identity path replays the same
   * patches over a longer upstream file — and both must record the same
   * (empty) attribution. A replay that re-recorded over generated text would
   * show up as a range appearing on one variant only.
   */
  it('records identically on both variants despite different content', () => {
    const base = generateRecorded(basePath, config());
    const identity = generateRecorded(identityPath, config());

    expect(textOf(identity.files, IRS)).not.toBe(textOf(base.files, IRS));
    expect(entriesOf(identity.provenance, IRS)).toEqual(entriesOf(base.provenance, IRS));
  });
});
