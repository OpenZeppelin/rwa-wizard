/**
 * INV-23: creation and content attribution stay disjoint.
 *
 * A `created` entry names what the generator read to decide the file EXISTS.
 * The `file`/`range` entries name what shaped its CONTENT. Conflating them is
 * what makes a drawer claim that ticking one setting rewrites a whole document.
 */
import { describe, expect, it } from 'vitest';

import { generateUnderReviewModulesMd } from '../../src/templates/under-review-modules-md';
import { createValidConfig } from '../helpers/config';

import {
  GENERATE_PATHS,
  GOLDEN_FIXTURES,
  createdEntry,
  duplicateModuleConfig,
  entriesOf,
  fileEntry,
  generateRecorded,
  noModuleConfig,
  twoModuleConfig,
} from './helpers';

const identityPath = GENERATE_PATHS.find((p) => p.name === 'generate-with-identity-support');
const basePath = GENERATE_PATHS.find((p) => p.name === 'generate');
if (identityPath === undefined || basePath === undefined) {
  throw new Error('both generate paths must be present');
}

const DEMO_MINT = 'scripts/bootstrap-demo-mint.sh';

describe('scripts/bootstrap-demo-mint.sh — the reachable conditional file', () => {
  const emitting = GOLDEN_FIXTURES.filter(
    (fixture) => DEMO_MINT in identityPath.run(fixture.config).files
  );
  const notEmitting = GOLDEN_FIXTURES.filter(
    (fixture) => !(DEMO_MINT in identityPath.run(fixture.config).files)
  );

  it('is genuinely conditional across the fixture matrix', () => {
    expect(emitting.length).toBeGreaterThan(0);
    expect(notEmitting.length).toBeGreaterThan(0);
  });

  it.each(emitting)('records a created entry naming its readiness inputs: $name', (fixture) => {
    const { provenance } = generateRecorded(identityPath, fixture.config);

    const created = createdEntry(provenance, DEMO_MINT);
    expect(created).toBeDefined();
    expect(created?.paths.length).toBeGreaterThan(0);

    // The decision is about readiness: supply and the compliance/identity state
    // that gates a demo mint. It must never be an identity-MODE pseudo-path —
    // the entry point is not a config path (INV-23).
    for (const path of created?.paths ?? []) {
      expect(path).not.toMatch(/identitySupport|includeDemoAutoMint/);
    }
    expect(created?.paths.some((path) => path.startsWith('token.'))).toBe(true);
  });

  it('never emits the file, or a provenance key for it, on the base path', () => {
    for (const fixture of emitting) {
      const { files, provenance } = generateRecorded(basePath, fixture.config);

      expect(DEMO_MINT in files).toBe(false);
      expect(DEMO_MINT in provenance.files).toBe(false);
    }
  });
});

/**
 * Checkpoint 7's matrix: changing one module entry must change only that
 * module's files. These use provenance-only fixtures, because the golden matrix
 * has no duplicate-id case (invariants Open Question 5).
 */
describe.each(GENERATE_PATHS)('$name — per-module created identity', (path) => {
  const COUNTRY_ALLOW = 'contracts/modules/compliance-country-allow/src/contract.rs';

  it('names only the selecting module’s own occurrence', () => {
    const { files, provenance } = generateRecorded(path, twoModuleConfig());

    const modulePaths = Object.keys(files).filter((f) => f.startsWith('contracts/modules/'));
    expect(modulePaths.length).toBe(6); // two modules x three files

    for (const filePath of modulePaths) {
      const created = createdEntry(provenance, filePath);
      expect(created).toBeDefined();
      expect(created?.paths.length).toBeGreaterThan(0);
      // INV-19: exactly one module index, never a sibling's.
      expect(created?.paths.every((p) => p.startsWith('compliance.modules['))).toBe(true);
    }
  });

  it('gives two distinct modules disjoint created entries', () => {
    const { files, provenance } = generateRecorded(path, twoModuleConfig());

    const byModule = new Map<string, Set<string>>();
    for (const filePath of Object.keys(files).filter((f) => f.startsWith('contracts/modules/'))) {
      const crate = filePath.split('/')[2] ?? '';
      const paths = createdEntry(provenance, filePath)?.paths ?? [];
      byModule.set(crate, new Set([...(byModule.get(crate) ?? []), ...paths]));
    }

    const crates = [...byModule.keys()];
    expect(crates.length).toBe(2);
    const [first, second] = crates.map((crate) => byModule.get(crate) ?? new Set<string>());
    for (const p of first ?? []) expect(second?.has(p)).toBe(false);
  });

  /**
   * The design's Checkpoint 7 and Open Question 3 both assume a duplicate module
   * id reaches generation and must union its indices. It cannot: validation
   * rejects the config first (`validation/rules.ts` — "selected more than
   * once"), so generation never sees it. The de-duplication in the module loop
   * and in `getUniqueModuleSelections` is defensive code for a state the public
   * API refuses. Asserted here as the real behaviour rather than tested through
   * a path that throws.
   */
  it('never reaches generation with a duplicated module id — validation rejects it', () => {
    expect(() => path.run(duplicateModuleConfig(), { recordProvenance: true })).toThrow(
      /selected more than once/
    );
  });

  it('keeps module creation paths out of the content entry', () => {
    const { provenance } = generateRecorded(path, twoModuleConfig());

    // The module contract's CONTENT is descriptor-driven upstream text: it reads
    // no config, so its file entry is empty even though it has a created entry.
    expect(fileEntry(provenance, COUNTRY_ALLOW).paths).toEqual([]);
  });
});

describe('unconditional files carry no created entry', () => {
  const fixture = GOLDEN_FIXTURES[0];
  if (fixture === undefined) throw new Error('the golden fixture matrix is empty');

  it.each(GENERATE_PATHS)('$name', (path) => {
    const { provenance } = generateRecorded(path, fixture.config);

    for (const unconditional of ['Cargo.toml', 'README.md', 'config.json', 'scripts/deploy.sh']) {
      expect(entriesOf(provenance, unconditional).some((e) => e.kind === 'created')).toBe(false);
    }
  });
});

/**
 * `UNDER_REVIEW_MODULES.md` is unreachable with the shipped registry: every one
 * of the seven module descriptors is `review.state: 'stable'`, so no config can
 * make the file exist and no golden fixture emits it. Its creation wiring is
 * implemented (an observed decision feeding `createdBy`, identical in shape to
 * the demo-mint script proved above), but end-to-end attribution for it CANNOT
 * be exercised today. What is asserted here is the decision function's real
 * current behaviour — not a pretended range.
 */
describe('UNDER_REVIEW_MODULES.md — unreachable with the shipped registry', () => {
  it('returns null for every module the registry ships', () => {
    expect(generateUnderReviewModulesMd(noModuleConfig())).toBeNull();
    expect(
      generateUnderReviewModulesMd(
        createValidConfig({
          compliance: {
            modules: [
              { moduleId: 'supply-limit', config: { limit: 1_000_000 } },
              { moduleId: 'country-restrict', config: { restrictedCountries: ['US'] } },
            ],
          },
        })
      )
    ).toBeNull();
  });

  it('is emitted by no fixture on either generate path', () => {
    for (const path of GENERATE_PATHS) {
      for (const fixture of GOLDEN_FIXTURES) {
        expect('UNDER_REVIEW_MODULES.md' in path.run(fixture.config).files).toBe(false);
      }
    }
  });
});
