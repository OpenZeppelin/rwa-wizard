/**
 * The two properties that are not the wizard's to keep, asserted where they are
 * consumed. Written for SF-11's presentation layer, which was withdrawn; both
 * properties belong to the seam below it, so they are asserted here against
 * `groupFieldProvenance`'s own result rather than against a rendered list.
 *
 * INV-2: an attribution that declares no significance is PRIMARY, asserted end
 * to end — a generator double that declares `secondaryPaths` nowhere, driven
 * through the real `codegenLoader` narrowing and the real `groupFieldProvenance`.
 * Constructing a row by hand with `significance: 'primary'` would assert nothing
 * about the seam; the whole content of this invariant is that the default is
 * applied at core's single `return false` and nowhere else.
 *
 * INV-13: `groupFieldProvenance` still never throws — and the loader is the
 * NAMED reason. `isSecondaryAttribution` selects with `.filter`, so it parses
 * EVERY path of an entry, where `filterProvenanceByPath` short-circuits on the
 * first match with `.some`. An entry whose first path matches the query and
 * whose third path is malformed is survivable under the `.some` rule and would
 * raise a `RangeError` under the `.filter` one. The closure is `hasParsablePaths`, which parses the full
 * `entry.paths` and drops the entry whole on any failure. That dependency runs
 * across two files in two folders, so the regression test lives HERE, at the
 * consuming end, rather than only in SF-5's suite — an "optimisation" that stops
 * parsing eagerly must fail beside the code whose promise it breaks.
 *
 * INV-2, INV-13.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { filterProvenanceByPath, isSecondaryAttribution } from '@openzeppelin/codegen-core';
import type {
  FileTree,
  GenerateOptions,
  GenerationResult,
  ProvenanceEntry,
  ProvenanceResult,
} from '@openzeppelin/codegen-core';
import { logger } from '@openzeppelin/ui-utils';

import {
  ownershipAddressPath,
  roleAddressesPath,
  tokenPaths,
  trustedIssuerAddressPath,
  type ConfigPath,
} from '../../../features/wizard/config-path';
import { makeConfig } from '../../../test/fixtures/wizardFixtures';
import type { StructuralGeneratedFileKind } from '../../../types/wizard';
import { loadCodegenService } from '../../codegen/codegenLoader';
import { groupFieldProvenance } from './groupFieldProvenance';
import type { FieldProvenanceResult, PreviewProvenanceSource } from './types';

const { generateMock, generateZipMock } = vi.hoisted(() => ({
  generateMock: vi.fn<(config: unknown, options?: GenerateOptions) => GenerationResult>(),
  generateZipMock: vi.fn<
    (config: unknown, options?: GenerateOptions) => Promise<{ fileName: string; data: Blob }>
  >(async () => ({ fileName: 'test.zip', data: new Blob(['zip']) })),
}));

vi.mock('../../codegen/runtimeOptions', () => ({
  getCodegenRuntimeOptions: vi.fn(() => undefined),
}));

vi.mock('@openzeppelin/codegen-rwa-stellar', () => ({
  validate: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
  getAvailableModules: vi.fn(() => []),
  generate: generateMock,
  generateZip: generateZipMock,
  generateWithIdentitySupport: undefined,
  generateZipWithIdentitySupport: undefined,
  getEcosystemMetadata: undefined,
  getUpstreamSourceRevision: undefined,
  getUpstreamImportLinks: undefined,
  getGeneratedFileKind: undefined,
  getCodegenInfoBlurb: undefined,
  getDeployGuidance: undefined,
  getComplianceConfigWarnings: undefined,
  hasComplianceConfigBlockingIssues: undefined,
  isDemoAutoMintConfigReady: undefined,
  isComplianceConfigBlockingWarningId: undefined,
}));

const IDENTITY = 'hash|identity:0|service:svc-1';
const UNKNOWN_KIND = (): StructuralGeneratedFileKind => 'unknown';

const DEPLOY = 'scripts/deploy.sh';
const CONTRACT = 'contracts/src/lib.rs';
const CONFIG = 'config.json';

const OWNER = ownershipAddressPath({ type: 'single-owner', ownerAddress: '' });
const SYMBOL = tokenPaths.symbol;
const NAME = tokenPaths.name;

const FILES: FileTree = { [DEPLOY]: '', [CONTRACT]: '', [CONFIG]: '' };

/** File path and per-row significance — the whole of what the seam decides. */
function shape(result: FieldProvenanceResult): readonly (readonly [string, string])[] {
  return result.groups.flatMap((group) =>
    group.rows.map((row) => [group.path, row.significance] as const)
  );
}

/** Drives the REAL loader: package output in, narrowed provenance out. */
async function narrow(files: Record<string, unknown>): Promise<ProvenanceResult | undefined> {
  generateMock.mockReturnValue({
    files: FILES,
    metadata: { configHash: 'h' },
    provenance: { files },
  } as unknown as GenerationResult);
  const service = await loadCodegenService('stellar');
  if (service === null) throw new Error('expected a service');
  const artifact = await service.generateFileTree(makeConfig(), { recordProvenance: true });
  return artifact.provenance;
}

function sourceFrom(provenance: ProvenanceResult): PreviewProvenanceSource {
  return { identity: IDENTITY, files: FILES, provenance, kindOf: UNKNOWN_KIND };
}

const hasKey = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

beforeEach(() => {
  generateMock.mockReset();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// INV-2: an undeclared attribution renders primary, through the real seam
// ---------------------------------------------------------------------------

describe('a generator that declares nothing produces one undifferentiated result (INV-2, AS-3, AS-5)', () => {
  /** Several files, many ranges, and the word `secondaryPaths` nowhere in the fixture. */
  const UNDECLARED: Record<string, unknown> = {
    [DEPLOY]: {
      entries: [
        { kind: 'range', range: { start: 3, end: 3 }, paths: [NAME] },
        { kind: 'range', range: { start: 9, end: 12 }, paths: [NAME, SYMBOL] },
        { kind: 'range', range: { start: 20, end: 24 }, paths: [NAME] },
      ],
    },
    [CONTRACT]: {
      entries: [
        { kind: 'range', range: { start: 4, end: 4 }, paths: [NAME] },
        { kind: 'range', range: { start: 11, end: 18 }, paths: [NAME] },
      ],
    },
    [CONFIG]: { entries: [{ kind: 'created', paths: [NAME] }] },
  };

  it('groups every matching file, in canonical order, with no group left out', async () => {
    const provenance = await narrow(UNDECLARED);
    expect(provenance).toBeDefined();
    if (provenance === undefined) return;

    const result = groupFieldProvenance(sourceFrom(provenance), NAME);

    expect(result.groups.map((g) => g.path)).toEqual([
      'config.json',
      'contracts/src/lib.rs',
      'scripts/deploy.sh',
    ]);
  });

  it('marks nothing secondary anywhere in the result', async () => {
    const provenance = await narrow(UNDECLARED);
    if (provenance === undefined) throw new Error('expected provenance');

    const result = groupFieldProvenance(sourceFrom(provenance), NAME);

    expect(shape(result).filter(([, significance]) => significance === 'secondary')).toEqual([]);
  });

  it('the default is applied at core, not on the wizard side: every row is primary', async () => {
    const provenance = await narrow(UNDECLARED);
    if (provenance === undefined) throw new Error('expected provenance');

    for (const g of groupFieldProvenance(sourceFrom(provenance), NAME).groups) {
      for (const row of g.rows) {
        expect(row.significance).toBe('primary');
      }
    }
    // And core itself is what said so, for every entry the query matched.
    const matched = filterProvenanceByPath(provenance, NAME);
    for (const file of Object.values(matched.files)) {
      for (const entry of file.entries) expect(isSecondaryAttribution(entry, NAME)).toBe(false);
    }
  });

  it('an entry reported with `secondaryPaths: []` loses the key and renders primary', async () => {
    // `[]` is not a spelling of "nothing is secondary": the canonical form is
    // key-absent. The loader tests emptiness BEFORE reference identity, so the
    // key is dropped rather than surviving as a trivially-identical repair —
    // which means every consumer reads a canonical form with no exception and
    // no code path anywhere needs to test for `[]`.
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const provenance = await narrow({
      [DEPLOY]: {
        entries: [
          { kind: 'range', range: { start: 3, end: 3 }, paths: [NAME], secondaryPaths: [] },
        ],
      },
    });
    if (provenance === undefined) throw new Error('expected provenance');

    const entry = provenance.files[DEPLOY]?.entries[0];
    expect(entry).toBeDefined();
    if (entry === undefined) return;
    expect(hasKey(entry, 'secondaryPaths')).toBe(false);

    expect(shape(groupFieldProvenance(sourceFrom(provenance), NAME))).toEqual([
      [DEPLOY, 'primary'],
    ]);
  });

  it('a mark the loader repairs away entirely also renders primary', async () => {
    // Fully disjoint mark: the repair is an intersection, so it can only ever
    // PROMOTE. No site is lost and nothing is demoted that the package did not
    // demote — the loader cannot invent a secondary row for the wizard to show.
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const provenance = await narrow({
      [DEPLOY]: {
        entries: [
          {
            kind: 'range',
            range: { start: 3, end: 3 },
            paths: [NAME],
            secondaryPaths: [SYMBOL],
          },
        ],
      },
    });
    if (provenance === undefined) throw new Error('expected provenance');

    expect(
      groupFieldProvenance(sourceFrom(provenance), NAME).groups[0]?.rows[0]?.significance
    ).toBe('primary');
  });

  it('a declared mark still reaches the seam — the fixtures above are not just inert', async () => {
    // Without this, every assertion in this block would also pass against a
    // wizard that ignored significance completely.
    const provenance = await narrow({
      [DEPLOY]: {
        entries: [
          { kind: 'range', range: { start: 3, end: 3 }, paths: [NAME] },
          { kind: 'range', range: { start: 9, end: 12 }, paths: [NAME], secondaryPaths: [NAME] },
        ],
      },
    });
    if (provenance === undefined) throw new Error('expected provenance');

    expect(shape(groupFieldProvenance(sourceFrom(provenance), NAME))).toEqual([
      [DEPLOY, 'primary'],
      [DEPLOY, 'secondary'],
    ]);
  });
});

// ---------------------------------------------------------------------------
// INV-13: the never-throws promise, and the loader property it now rests on
// ---------------------------------------------------------------------------

describe('groupFieldProvenance never throws, and names why (INV-13)', () => {
  /**
   * The shape that distinguishes the two matching functions: the FIRST path
   * matches the query, and a LATER path is malformed. `.some` stops at the
   * first match and never sees the bad one; `.filter` visits all three.
   *
   * The mark is load-bearing in this fixture and NOT decoration — see the
   * refinement test below. `isSecondaryAttribution` returns at
   * `secondaryPaths === undefined` BEFORE it filters, so an unmarked entry never
   * parses its later paths at all and this shape is survivable for it. The
   * hazard INV-13 names is therefore real but narrower than the invariant's
   * prose: it reaches marked entries only.
   */
  const FIRST_MATCHES_THIRD_MALFORMED = {
    kind: 'range',
    range: { start: 3, end: 3 },
    paths: [NAME, SYMBOL, 'a..b'],
    secondaryPaths: [SYMBOL],
  };

  it('the loader drops such an entry whole, and the seam returns without throwing', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const provenance = await narrow({
      [DEPLOY]: {
        entries: [
          FIRST_MATCHES_THIRD_MALFORMED,
          { kind: 'range', range: { start: 9, end: 12 }, paths: [NAME] },
        ],
      },
    });
    if (provenance === undefined) throw new Error('expected provenance');

    // Dropped per entry, keeping the rest — a malformed mark never costs the
    // user the whole affordance.
    expect(provenance.files[DEPLOY]?.entries).toHaveLength(1);

    expect(() => groupFieldProvenance(sourceFrom(provenance), NAME)).not.toThrow();
    const result = groupFieldProvenance(sourceFrom(provenance), NAME);
    expect(result.groups[0]?.rows).toEqual([
      { kind: 'range', range: { startLine: 9, endLine: 12 }, significance: 'primary' },
    ]);
  });

  it('the dependency itself: the same entry, loader-bypassed, throws in the NEW rule and not the old', () => {
    // This is the assertion that fails if someone "optimises" `hasParsablePaths`
    // to stop at the first parsable path. Without the loader in front of it, the
    // eager parse is a `RangeError` — so the guarantee is upstream, and this is
    // the test that says out loud which upstream property it is.
    const entry = FIRST_MATCHES_THIRD_MALFORMED as ProvenanceEntry;
    const bypassed: ProvenanceResult = { files: { [DEPLOY]: { entries: [entry] } } };

    // The `.some` rule short-circuits and survives.
    expect(() => filterProvenanceByPath(bypassed, NAME)).not.toThrow();
    // The `.filter` rule is eager and does not.
    expect(() => isSecondaryAttribution(entry, NAME)).toThrow(RangeError);
    // And so, without the loader, so does the seam.
    expect(() => groupFieldProvenance(sourceFrom(bypassed), NAME)).toThrow(RangeError);
  });

  it('the hazard reaches MARKED entries only — the early return on an absent mark is the boundary', () => {
    // Recorded because INV-13's prose is broader than the code: it says "an entry
    // that is survivable today would throw under the eager rule", without the
    // qualifier.
    // The qualifier is `isSecondaryAttribution`'s second line — it returns at
    // `secondaryPaths === undefined` before it filters, so an UNMARKED entry
    // never parses its later paths and the eager rule adds no parse for it at all.
    //
    // This is pinned rather than left implicit because the blast radius depends
    // on it. Move that early return below the filter — a plausible tidy-up, since
    // it reads as a redundant guard once `matching` is computed — and the hazard
    // widens from marked entries to EVERY entry in every generation, which is a
    // much larger surface for `hasParsablePaths` to be holding up.
    const unmarked: ProvenanceEntry = {
      kind: 'range',
      range: { start: 3, end: 3 },
      paths: [NAME, SYMBOL, 'a..b'],
    } as ProvenanceEntry;
    const marked = FIRST_MATCHES_THIRD_MALFORMED as ProvenanceEntry;

    expect(() => isSecondaryAttribution(unmarked, NAME)).not.toThrow();
    expect(() => isSecondaryAttribution(marked, NAME)).toThrow(RangeError);

    // The loader drops both regardless, which is why the user never sees either
    // — the narrower hazard does not make the loader property less load-bearing.
    expect(unmarked.kind === 'range' && unmarked.secondaryPaths).toBeUndefined();
  });

  it('the loader parses every path, not just the first — asserted by what it drops', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    // Malformed in first, second and third position: each must be dropped. A
    // loader that stopped after the first parsable path would keep the last two.
    const provenance = await narrow({
      [DEPLOY]: {
        entries: [
          { kind: 'range', range: { start: 1, end: 1 }, paths: ['a..b', NAME] },
          { kind: 'range', range: { start: 2, end: 2 }, paths: [NAME, 'a..b'] },
          { kind: 'range', range: { start: 3, end: 3 }, paths: [NAME, SYMBOL, 'a..b'] },
          { kind: 'range', range: { start: 4, end: 4 }, paths: [NAME] },
        ],
      },
    });

    expect(provenance?.files[DEPLOY]?.entries).toHaveLength(1);
    expect(provenance?.files[DEPLOY]?.entries[0]?.kind === 'range').toBe(true);
  });

  it.each([
    ['token.name', tokenPaths.name],
    ['token.decimals', tokenPaths.decimals],
    ['ownership address', OWNER],
    ['role addresses', roleAddressesPath(0)],
    ['trusted issuer address', trustedIssuerAddressPath(0)],
    ['a prefix query', 'token' as ConfigPath],
  ])('%s: total over a loader-narrowed result carrying marks', async (_name, query) => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const provenance = await narrow({
      [DEPLOY]: {
        entries: [
          { kind: 'range', range: { start: 3, end: 3 }, paths: [NAME, SYMBOL] },
          {
            kind: 'range',
            range: { start: 9, end: 12 },
            paths: [OWNER, SYMBOL],
            secondaryPaths: [SYMBOL],
          },
          { kind: 'file', paths: [NAME] },
          { kind: 'range', range: { start: 20, end: 24 }, paths: ['a..b'] },
        ],
      },
      [CONTRACT]: { entries: [{ kind: 'created', paths: [NAME] }] },
    });
    if (provenance === undefined) throw new Error('expected provenance');

    expect(() => groupFieldProvenance(sourceFrom(provenance), query)).not.toThrow();
  });
});
