/**
 * INV-31, in reverse: the oracle must still FAIL when it should.
 *
 * `display-significance.test.ts` asserts the sweep finds nothing. That is worth
 * exactly as much as the sweep's ability to find something, and a green
 * assertion cannot tell the two apart. Code Draft ran the oracle against zero
 * marks before placing the first one and watched it fail all 32 fixture × root
 * cells; that run is not reproducible from a finished tree, so this file
 * reconstructs both failure directions from the real provenance and keeps them
 * permanently exercised.
 *
 * A single fixture would do for the mechanics, so the corruption sweeps run
 * over the whole matrix instead — the same reason INV-31 quantifies universally
 * rather than pinning one fixture's counts.
 */
import { describe, expect, it } from 'vitest';

import { GENERATE_PATHS, generateRecorded, GOLDEN_FIXTURES } from './helpers';
import {
  markEveryRange,
  marksOutsideShell,
  shellCensus,
  stripAllMarks,
  type Divergence,
} from './significance-oracle';

const BASELINE = GOLDEN_FIXTURES[0];
const GENERATE = GENERATE_PATHS[0];
if (BASELINE === undefined) throw new Error('expected at least one golden fixture');
if (GENERATE === undefined) throw new Error('expected at least one generate root');
const RICHEST =
  GOLDEN_FIXTURES.find((fixture) => fixture.name === 'compliance-all-modules') ?? BASELINE;

describe('the forward direction is live — zero marks fails every cell', () => {
  for (const path of GENERATE_PATHS) {
    for (const fixture of GOLDEN_FIXTURES) {
      it(`${fixture.name} × ${path.name}: stripping every mark reports promotion drift`, () => {
        const { files, provenance } = generateRecorded(path, fixture.config);
        const { findings, marked, primary } = shellCensus(files, stripAllMarks(provenance));

        // This is the state the oracle was written against, before the first
        // mark existed: every display-only range named, with its file, range,
        // paths and offending line. That failure list was the worklist.
        expect(findings.length).toBeGreaterThan(0);
        expect(findings.every((finding) => finding.direction === 'promotion drift')).toBe(true);

        // And the non-vacuity floor catches the same corruption independently,
        // which is the point of having it: marking removed wholesale fails here
        // even if someone were to weaken the biconditional.
        expect(marked).toBe(0);
        expect(primary).toBeGreaterThan(0);
      });
    }
  }
});

describe('the reverse direction is live — marking everything fails every cell', () => {
  for (const path of GENERATE_PATHS) {
    for (const fixture of GOLDEN_FIXTURES) {
      it(`${fixture.name} × ${path.name}: marking every range reports silent demotion`, () => {
        const { files, provenance } = generateRecorded(path, fixture.config);
        const { findings, primary } = shellCensus(files, markEveryRange(provenance));

        // The failure this sub-feature is rated High for: a range holding a
        // `stellar contract deploy` declared secondary. Invisible to the
        // goldens, which see only bytes.
        expect(findings.length).toBeGreaterThan(0);
        expect(findings.every((finding) => finding.direction === 'silent demotion')).toBe(true);
        expect(primary).toBe(0);

        // The report names the determining line, not merely the range.
        const [first] = findings;
        expect(first?.firstLine.length ?? 0).toBeGreaterThan(0);
      });
    }
  }
});

describe('the two directions fail independently', () => {
  it('one demoted determining range is caught while every other range stays conformant', () => {
    // The realistic mistake, not the wholesale one: a template author marks an
    // `emitEcho` that happens to share a range with a deploy command.
    const { files, provenance } = generateRecorded(GENERATE, BASELINE.config);
    expect(shellCensus(files, provenance).findings).toHaveLength(0);

    const deployShell = Object.keys(provenance.files).find((key) => key.endsWith('deploy.sh'));
    if (deployShell === undefined) throw new Error('expected a deploy.sh');

    // Find one genuinely determining, currently-primary range and demote it.
    const victim = (provenance.files[deployShell]?.entries ?? []).find(
      (entry) => entry.kind === 'range' && entry.secondaryPaths === undefined
    );
    if (victim === undefined || victim.kind !== 'range') {
      throw new Error('expected a primary range to demote');
    }

    const corrupted = {
      files: {
        ...provenance.files,
        [deployShell]: {
          entries: (provenance.files[deployShell]?.entries ?? []).map((entry) =>
            entry === victim ? { ...victim, secondaryPaths: [...victim.paths] } : entry
          ),
        },
      },
    };

    const { findings } = shellCensus(files, corrupted);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.direction).toBe('silent demotion');
    expect(findings[0]?.filePath).toBe(deployShell);
    expect(findings[0]?.range).toBe(`${victim.range.start}-${victim.range.end}`);
  });

  it('one un-marked display range is caught the same way', () => {
    const { files, provenance } = generateRecorded(GENERATE, RICHEST.config);

    const shellKey = Object.keys(provenance.files).find(
      (key) =>
        key.endsWith('.sh') &&
        (provenance.files[key]?.entries ?? []).some(
          (entry) => entry.kind === 'range' && entry.secondaryPaths !== undefined
        )
    );
    if (shellKey === undefined) throw new Error('expected a marked shell file');

    const entries = provenance.files[shellKey]?.entries ?? [];
    const marked = entries.find((entry) => entry.kind === 'range' && entry.secondaryPaths);
    if (marked === undefined || marked.kind !== 'range') throw new Error('expected a marked range');

    const corrupted = {
      files: {
        ...provenance.files,
        [shellKey]: {
          entries: entries.map((entry) => {
            if (entry !== marked) return entry;
            const { secondaryPaths: _dropped, ...rest } = marked;
            return rest;
          }),
        },
      },
    };

    const { findings } = shellCensus(files, corrupted);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.direction).toBe('promotion drift');
  });
});

describe('the allowlist mechanism works, which is why an empty one means something', () => {
  it('an entry silences exactly its own divergence and nothing else', () => {
    const { files, provenance } = generateRecorded(GENERATE, BASELINE.config);
    const { findings } = shellCensus(files, stripAllMarks(provenance));
    const [first] = findings;
    if (first === undefined) throw new Error('expected findings to allowlist');

    const allowlist: readonly Divergence[] = [
      { filePath: first.filePath, firstLine: first.firstLine, why: 'meta-test only' },
    ];
    const narrowed = shellCensus(files, stripAllMarks(provenance), allowlist);

    expect(narrowed.findings.length).toBeLessThan(findings.length);
    expect(
      narrowed.findings.some(
        (finding) => finding.filePath === first.filePath && finding.firstLine === first.firstLine
      )
    ).toBe(false);
  });
});

describe('the outside-`.sh` prohibition is live', () => {
  it('a mark planted on a contract range is reported', () => {
    const { files, provenance } = generateRecorded(GENERATE, BASELINE.config);
    expect(marksOutsideShell(files, provenance)).toEqual([]);

    // `markEveryRange` marks non-shell ranges too, which is exactly the
    // "someone adds significance to patch-builder for symmetry" scenario.
    const planted = marksOutsideShell(files, markEveryRange(provenance));
    expect(planted.length).toBeGreaterThan(0);
    expect(planted.every((line) => !line.startsWith('scripts/') || !line.includes('.sh'))).toBe(
      true
    );
  });
});
