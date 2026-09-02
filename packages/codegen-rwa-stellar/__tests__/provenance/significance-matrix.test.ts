/**
 * SF-10 — what every marked entry in every generated tree must look like, and
 * the two named cases the fixture matrix would otherwise cover only by accident.
 * INV-1, INV-2, INV-12, INV-21, INV-24, INV-28 (attribution stability),
 * INV-34, plus AS-2 read on real output.
 * Category: Request/Response + Idempotency + Resource Limits + Re-usability.
 *
 * Code Draft verified several of these by dumping and reading the marked
 * attributions rather than by suite. Reading is how you find out; a test is how
 * it stays found. Everything Code Draft read is asserted here.
 */
import { describe, expect, it } from 'vitest';

import { isSecondaryAttribution } from '@openzeppelin/codegen-core';
import type { ProvenanceEntry, ProvenanceResult } from '@openzeppelin/codegen-core';

import { GENERATE_PATHS, generateRecorded, GOLDEN_FIXTURES, sliceRange } from './helpers';

type RangeEntry = Extract<ProvenanceEntry, { kind: 'range' }>;

const allEntries = (provenance: ProvenanceResult): [string, ProvenanceEntry][] =>
  Object.entries(provenance.files).flatMap(([filePath, file]) =>
    file.entries.map((entry): [string, ProvenanceEntry] => [filePath, entry])
  );

const markedRanges = (provenance: ProvenanceResult): [string, RangeEntry][] =>
  allEntries(provenance).filter(
    (pair): pair is [string, RangeEntry] =>
      pair[1].kind === 'range' && pair[1].secondaryPaths !== undefined
  );

/** `Object.hasOwn` is ES2022; the ES2020 spelling keeps this test runnable anywhere. */
const hasKey = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const BASELINE = GOLDEN_FIXTURES[0];
const GENERATE = GENERATE_PATHS[0];
if (BASELINE === undefined) throw new Error('expected at least one golden fixture');
if (GENERATE === undefined) throw new Error('expected at least one generate root');

describe('the canonical form holds for every entry of every fixture × root', () => {
  for (const path of GENERATE_PATHS) {
    for (const fixture of GOLDEN_FIXTURES) {
      it(`${fixture.name} × ${path.name}`, () => {
        const { provenance } = generateRecorded(path, fixture.config);
        const problems: string[] = [];
        const report = (filePath: string, problem: string): void => {
          problems.push(`${filePath}: ${problem}`);
        };

        for (const [filePath, entry] of allEntries(provenance)) {
          if (entry.kind !== 'range') {
            // INV-2: `file` and `created` never carry the key, not even when
            // every range that fed them was marked.
            if (hasKey(entry, 'secondaryPaths')) {
              report(filePath, `a ${entry.kind} entry carries secondaryPaths`);
            }
            continue;
          }
          if (!hasKey(entry, 'secondaryPaths')) continue;

          const secondary = entry.secondaryPaths;
          if (secondary === undefined) {
            // INV-1: absence is key-absence; `{ secondaryPaths: undefined }` is
            // a second spelling of one state and is never recorded.
            report(filePath, 'secondaryPaths is present but undefined');
            continue;
          }
          if (secondary.length === 0) report(filePath, '`[]` was recorded');
          if (secondary.length > entry.paths.length) report(filePath, 'more secondary than paths'); // INV-24
          if (entry.paths.length === 0) report(filePath, 'a mark on a pathless range'); // INV-21

          const sorted = [...secondary].sort();
          if (secondary.some((p, i) => p !== sorted[i]))
            report(filePath, 'secondaryPaths unsorted');
          if (new Set(secondary).size !== secondary.length) report(filePath, 'duplicates');

          const attributed = new Set(entry.paths);
          const stray = secondary.filter((p) => !attributed.has(p));
          if (stray.length > 0) report(filePath, `not a subset: ${stray.join(', ')}`);

          if (entry.paths === secondary) report(filePath, 'paths and secondaryPaths are one array');
        }

        expect(problems.join('\n'), 'canonical-form violations').toBe('');
      });
    }
  }
});

describe('INV-34 — no template produces a mixed-significance entry, and that is asserted', () => {
  it('no entry anywhere in the matrix has a PROPER-subset secondaryPaths', () => {
    // A standing assertion, not a footnote. If one ever appears this fails, and
    // whoever made it appear must revisit D10 deliberately — which is the
    // correct trigger, and it is also what stops SF-11 building mixed-row
    // presentation against a case no fixture produces.
    const mixed: string[] = [];
    for (const path of GENERATE_PATHS) {
      for (const fixture of GOLDEN_FIXTURES) {
        const { provenance } = generateRecorded(path, fixture.config);
        for (const [filePath, entry] of markedRanges(provenance)) {
          if ((entry.secondaryPaths?.length ?? 0) < entry.paths.length) {
            mixed.push(
              `${fixture.name} × ${path.name} ${filePath} [${entry.range.start}-${entry.range.end}]`
            );
          }
        }
      }
    }
    expect(mixed.join('\n'), 'proper-subset marks produced by the generator').toBe('');
  });

  it('every marked entry is therefore fully secondary', () => {
    const { provenance } = generateRecorded(GENERATE, BASELINE.config);
    for (const [, entry] of markedRanges(provenance)) {
      expect(entry.secondaryPaths).toEqual(entry.paths);
    }
  });
});

describe('the inventory of marked attribution shapes is pinned', () => {
  /** Array indices collapsed, so the key is fixture-independent. */
  const shapeOf = (filePath: string, entry: RangeEntry): string =>
    `${filePath} :: ${[...new Set(entry.paths.map((p) => p.replace(/\[\d+\]/g, '[i]')))]
      .sort()
      .join(', ')}`;

  it('exactly these 17 shapes carry a mark, across every fixture × root', () => {
    // Code Draft dumped and read every marked attribution rather than trusting
    // a green suite. This is that read, frozen: a mark landing on a NEW
    // attribution shape, or an existing shape losing its mark, fails here with
    // the shape named — which no count and no biconditional would tell you.
    const shapes = new Set<string>();
    for (const path of GENERATE_PATHS) {
      for (const fixture of GOLDEN_FIXTURES) {
        const { provenance } = generateRecorded(path, fixture.config);
        for (const [filePath, entry] of markedRanges(provenance)) {
          shapes.add(shapeOf(filePath, entry));
        }
      }
    }

    expect([...shapes].sort()).toEqual([
      // SF-16 — the aggregate demo-issuer lines. They emitted every DEFINED
      // topic and now emit the selected ones, so deciding selection reads
      // `.selected` on every topic and the shape grows one segment.
      'scripts/bootstrap-demo-mint.sh :: identityVerification.claimTopics, identityVerification.claimTopics[i].id, identityVerification.claimTopics[i].selected',
      // LOAD-BEARING, and pinned verbatim: this is one `allow_key` block per
      // topic. Its disappearance is the signature of a detached-object
      // projection (`claimTopics.filter(isSelected)`, then indexing the filtered
      // array), which emits byte-correct output, passes every golden, passes the
      // byte-identity oracle AND passes the emitted-id-sequence check — while
      // attributing every claim-topic line to one read at the top of the file.
      // Only this row's absence says so.
      'scripts/bootstrap-demo-mint.sh :: identityVerification.claimTopics[i].id, identityVerification.claimTopics[i].name',
      'scripts/deploy.sh :: accessControl.ownership.address, accessControl.ownership.type',
      'scripts/deploy.sh :: accessControl.ownership.ownerAddress, accessControl.ownership.type',
      'scripts/deploy.sh :: compliance.modules, compliance.modules[i].moduleId',
      'scripts/deploy.sh :: compliance.modules[i].moduleId',
      'scripts/deploy.sh :: deployment.target.ecosystem, deployment.target.explorerUrl, deployment.target.kind, deployment.target.label, deployment.target.rpcUrl',
      'scripts/deploy.sh :: deployment.target.ecosystem, deployment.target.explorerUrl, deployment.target.kind, deployment.target.label, deployment.target.rpcUrl, token.name, token.symbol',
      'scripts/deploy.sh :: deployment.target.ecosystem, deployment.target.kind, deployment.target.networkId',
      'scripts/deploy.sh :: deployment.target.ecosystem, deployment.target.kind, deployment.target.networkId, token.name, token.symbol',
      // SF-16 — the `Claim Topics (N)` heading. Two rows of this inventory moved
      // and this is the second; the count stays 17 and the other fifteen rows
      // are byte-identical.
      //
      // Two segments, not one, and the second was measured rather than assumed:
      // `deploy.sh` needs BOTH walks in the one `observe` behind this heading —
      // indices to drive the `add_claim_topic` loop, ids to narrow each trusted
      // issuer's topic list. An indices walk records `claimTopics` plus
      // `[i].selected` for every topic; an ids walk adds `[i].id` for the
      // selected ones. Splitting them into two observes would attribute the ids
      // to the issuer lines and move a THIRD row instead.
      //
      // `.selected` appears here even though no fixture writes the field: a
      // recording reader records a read of an ABSENT key, so a selection walk
      // records one path per topic regardless. The omit-when-true write
      // discipline protects `config.json`'s bytes; it says nothing about
      // provenance output, and this row is why.
      //
      // The attribution is honest in the strongest available sense — mutating any
      // topic's `selected` changes this heading's number, so the determination
      // oracle confirms the range rather than merely tolerating it.
      'scripts/deploy.sh :: identityVerification.claimTopics, identityVerification.claimTopics[i].id, identityVerification.claimTopics[i].selected',
      // LOAD-BEARING, pinned verbatim — the `deploy.sh` half of the
      // detached-object signature described above.
      'scripts/deploy.sh :: identityVerification.claimTopics[i].id, identityVerification.claimTopics[i].name',
      'scripts/deploy.sh :: identityVerification.trustedIssuers',
      'scripts/deploy.sh :: identityVerification.trustedIssuers[i].address, identityVerification.trustedIssuers[i].claimTopics, identityVerification.trustedIssuers[i].claimTopics[i]',
      'scripts/deploy.sh :: token.decimals, token.initialSupply',
      'scripts/deploy.sh :: token.name, token.symbol',
    ]);
  });

  it('every marked shape lives in a shell script', () => {
    // The same boundedness INV-25 asserts, restated over the inventory so the
    // list above cannot quietly grow a `contract.rs` or `README.md` row.
    const { provenance } = generateRecorded(GENERATE, BASELINE.config);
    for (const [filePath] of markedRanges(provenance)) {
      expect(filePath.endsWith('.sh'), filePath).toBe(true);
    }
  });
});

describe('the two Compliance sibling sites, named', () => {
  // They are exercised by only 2 of 32 fixture × root cells, and they are the
  // pair that survived Code Draft's first marking pass — caught only by
  // sweeping for siblings of an already-fixed shape. That is INV-31's violation
  // scenario B observed rather than hypothesised, so they get a case that a
  // future trim of the fixture matrix cannot silently delete.
  const FIXTURE = GOLDEN_FIXTURES.find((fixture) => fixture.name === 'compliance-all-modules');
  if (FIXTURE === undefined) throw new Error('expected the compliance-all-modules fixture');

  const HEADINGS = [
    ['Compliance Modules (', 'the deployment subsection in deploy-sh-deployments.ts'],
    ['Compliance Module Wiring (', 'the post-deploy subsection in deploy-sh-post-deploy.ts'],
  ] as const;

  for (const path of GENERATE_PATHS) {
    it.each(HEADINGS)(`%s is marked secondary on ${path.name} — %s`, (heading) => {
      const { files, provenance } = generateRecorded(path, FIXTURE.config);
      const content = files['scripts/deploy.sh'];
      if (typeof content !== 'string') throw new Error('deploy.sh is not text');

      const found = (provenance.files['scripts/deploy.sh']?.entries ?? []).filter(
        (entry): entry is RangeEntry =>
          entry.kind === 'range' &&
          sliceRange(content, entry.range).some((line) => line.includes(heading))
      );

      expect(found, `no range holds ${heading}`).toHaveLength(1);
      const [entry] = found;
      expect(entry?.secondaryPaths, `${heading} is not marked`).toBeDefined();
      expect(entry?.secondaryPaths).toEqual(entry?.paths);
      // Its attribution is the module ids it heads, so a query for a module
      // answers secondary here and primary at the invoke command below it.
      expect(entry?.paths.some((p) => p.startsWith('compliance.modules'))).toBe(true);
    });
  }

  it('both headings answer `isSecondaryAttribution` true for a module query', () => {
    const { files, provenance } = generateRecorded(GENERATE, FIXTURE.config);
    const content = files['scripts/deploy.sh'];
    if (typeof content !== 'string') throw new Error('deploy.sh is not text');

    const headings = (provenance.files['scripts/deploy.sh']?.entries ?? []).filter(
      (entry): entry is RangeEntry =>
        entry.kind === 'range' &&
        sliceRange(content, entry.range).some((line) => /Compliance Module/.test(line))
    );
    expect(headings).toHaveLength(2);
    for (const entry of headings) {
      expect(isSecondaryAttribution(entry, 'compliance.modules')).toBe(true);
    }
  });
});

describe('AS-2 read on real output, not constructed', () => {
  it('`ADMIN="…"` is primary while the line printing the same address is secondary', () => {
    // The row Code Draft would show a reviewer, and the reason a per-LINE
    // significance would have been wrong immediately rather than eventually.
    const { files, provenance } = generateRecorded(GENERATE, BASELINE.config);
    const content = files['scripts/deploy.sh'];
    if (typeof content !== 'string') throw new Error('deploy.sh is not text');

    const rangeHolding = (needle: string): RangeEntry => {
      const found = (provenance.files['scripts/deploy.sh']?.entries ?? []).filter(
        (entry): entry is RangeEntry =>
          entry.kind === 'range' &&
          sliceRange(content, entry.range).some((line) => line.includes(needle))
      );
      const [entry] = found;
      if (entry === undefined) throw new Error(`no range holds ${needle}`);
      return entry;
    };

    const assignment = rangeHolding('ADMIN="');
    const example = rangeHolding('Example: export STELLAR_ACCOUNT=');

    // Same config path, same file, opposite answers — which is precisely what a
    // per-attribution significance buys and a per-entry flag cannot express.
    const query = 'accessControl.ownership.type';
    expect(assignment.paths).toContain(query);
    expect(example.paths).toContain(query);
    expect(isSecondaryAttribution(assignment, query)).toBe(false);
    expect(isSecondaryAttribution(example, query)).toBe(true);

    // And the address itself, printed on both lines.
    expect(sliceRange(content, assignment.range).join('\n')).toContain('GCEXAMPLEOWNER');
    expect(sliceRange(content, example.range).join('\n')).toContain('GCEXAMPLEOWNER');
  });

  it('`token.name` holds both determining and display-only ranges in every fixture', () => {
    for (const path of GENERATE_PATHS) {
      for (const fixture of GOLDEN_FIXTURES) {
        const { provenance } = generateRecorded(path, fixture.config);
        const ranges = (provenance.files['scripts/deploy.sh']?.entries ?? []).filter(
          (entry): entry is RangeEntry => entry.kind === 'range'
        );
        const label = `${fixture.name} × ${path.name}`;
        const secondary = ranges.filter((entry) => isSecondaryAttribution(entry, 'token.name'));
        const primary = ranges.filter(
          (entry) =>
            entry.paths.includes('token.name') && !isSecondaryAttribution(entry, 'token.name')
        );
        expect(secondary.length, `${label}: no secondary token.name range`).toBeGreaterThan(0);
        expect(primary.length, `${label}: no primary token.name range`).toBeGreaterThan(0);
      }
    }
  });

  it('a prefix query answers per attribution across four descendants with different verdicts', () => {
    const { provenance } = generateRecorded(GENERATE, BASELINE.config);
    const ranges = (provenance.files['scripts/deploy.sh']?.entries ?? []).filter(
      (entry): entry is RangeEntry => entry.kind === 'range'
    );
    const answers = ranges
      .filter((entry) => entry.paths.some((p) => p.startsWith('token')))
      .map((entry) => isSecondaryAttribution(entry, 'token'));

    // Both verdicts occur under one prefix query, so `token` is not answered by
    // a single flag on the file — which is the shape SF-11 renders.
    expect(new Set(answers)).toEqual(new Set([true, false]));
  });
});

describe('INV-12 — the whole recorded result, marks included, is deterministic', () => {
  for (const path of GENERATE_PATHS) {
    for (const fixture of GOLDEN_FIXTURES) {
      it(`${fixture.name} × ${path.name}: two runs are toStrictEqual`, () => {
        const first = generateRecorded(path, fixture.config).provenance;
        const second = generateRecorded(path, fixture.config).provenance;
        expect(first).toStrictEqual(second);

        // Equal in content, and not the same objects — no cross-run state.
        const a = markedRanges(first)[0]?.[1];
        const b = markedRanges(second)[0]?.[1];
        expect(a?.secondaryPaths).toEqual(b?.secondaryPaths);
        expect(a?.secondaryPaths).not.toBe(b?.secondaryPaths);
      });
    }
  }
});

describe('INV-28 — the recorded range set is what it was before marking', () => {
  for (const path of GENERATE_PATHS) {
    for (const fixture of GOLDEN_FIXTURES) {
      it(`${fixture.name} × ${path.name}: stripping the marks leaves only pre-SF-10 members`, () => {
        // The pre-change recording cannot be re-derived from a finished tree, so
        // what is asserted is the shape of the delta: after stripping, every
        // entry has EXACTLY the members it had before SF-10, and no range's
        // `paths` or `(start, end)` was touched. SF-3's and SF-4's suites,
        // running unmodified, pin the values themselves.
        const { provenance } = generateRecorded(path, fixture.config);
        for (const [filePath, entry] of allEntries(provenance)) {
          const members = new Set(Object.keys(entry));
          members.delete('secondaryPaths');
          const expected =
            entry.kind === 'range'
              ? new Set(['kind', 'paths', 'range'])
              : new Set(['kind', 'paths']);
          expect(members, `${filePath} (${entry.kind})`).toEqual(expected);
        }
      });
    }
  }
});
