import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { findTokenAcross, readScannedSources } from '../../../test/helpers/sourceScan';
import type {
  AdoptionSummary,
  FileFingerprint,
  JsxElementFingerprint,
  StepMarkupBaseline,
  SupersededMarkupEntry,
  SupersededMarkupRecord,
} from './stepMarkupFingerprint';
import { countAnchorProps, filterPermittedProps, fingerprintSource } from './stepMarkupFingerprint';
import type { GuardVerdict, SanctionRefusal, SanctionRefusalCode } from './stepMarkupGuard';
import {
  checkGuardedFile,
  checkTwoKeyAgreement,
  MIRRORED_FIELDS,
  parseSupersededRecord,
  SANCTION_REFUSAL_CODES,
  selectAuthority,
  summariseAdoption,
  validateSanction,
} from './stepMarkupGuard';
import type { MarkupSupersession } from './stepMarkupSanction';
import { MARKUP_SUPERSESSIONS, PERMITTED_PROP_DECISIONS } from './stepMarkupSanction';

/**
 * The negative battery for SF-15's two-key re-baseline, plus one test per input
 * for every decision function.
 *
 * **Two rules here are absolute, and both were bought the hard way.**
 *
 * 1. *Never assert a refusal by its prose.* `expect(stderr).toContain('REFUSING')`
 *    is the exact shape that has gone green twice in this initiative while the
 *    construct it banned was in the tree — once because the token was
 *    case-sensitive, once because `\b` needs a non-word character. Refusals are
 *    compared as `SanctionRefusalCode[]` by exact array equality, and stderr is
 *    parsed with an anchored pattern before the parsed *set* is compared. Exact
 *    equality is also what catches the case that matters most: a second,
 *    unexpected refusal firing alongside the expected one.
 * 2. *No bare substring scan of source.* The one genuine scan below goes through
 *    `sourceScan.ts` with comments stripped, and pins its file count and byte
 *    lengths — a scan that read nothing is indistinguishable from a clean
 *    result, and this repo has shipped that bug.
 *
 * Note what rule 1 costs this very file: the sentence above contains the token
 * its own scan forbids. Stripping comments is what lets the rule keep its
 * documentation instead of trading it for a green scan (INV-10, § 12.6).
 *
 * Everything is pure over in-memory fixtures and spawns nothing, except the
 * three runs of the sanctioned command at the bottom of this file (INV-28).
 * Code Draft shipped one — the successful adoption — and the Tests stage added
 * two, because three invariants had no behavioural witness without them and a
 * mutation of each stayed green across the whole suite: the record surviving a
 * *refusing* run byte-identical (INV-25), the sealed baseline surviving one
 * (INV-19 on the only path the shipped, empty declaration can take), and the
 * shipped command itself, which no test had ever executed. The count is pinned
 * below so a fourth cannot arrive quietly.
 */

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(MODULE_DIR, '../../../..');

// ---------------------------------------------------------------------------
// Fixtures. Synthetic on purpose: `NO_DIVERGENCE` makes the state N3 describes
// unwritable in the real record, so a synthetic fixture is the only guard that
// property will ever have (INV-18, INV-30).
// ---------------------------------------------------------------------------

function element(
  tag: string,
  props: readonly string[] = [],
  values: Readonly<Record<string, string>> = {},
  children: readonly JsxElementFingerprint[] = []
): JsxElementFingerprint {
  return { tag, props: [...props].sort(), values, via: [], children };
}

const REASON =
  'Separating existence from selection needs the chip body to become an activatable element.';

function declaration(over: Partial<MarkupSupersession> = {}): MarkupSupersession {
  return {
    file: 'src/a.tsx',
    kind: 'replaces-baseline',
    authorisedBy: 'SF-14',
    decidedOn: '2026-09-01',
    reason: REASON,
    components: ['A'],
    anchorDelta: 0,
    introducesFirstAnchor: false,
    ...over,
  };
}

function entry(
  from: MarkupSupersession,
  fingerprint: FileFingerprint,
  adopted: AdoptionSummary = {
    elementsBefore: 0,
    elementsAfter: 0,
    tagsAdded: [],
    tagsRemoved: [],
    valuesChanged: 0,
  }
): SupersededMarkupEntry {
  return { ...from, adopted, fingerprint };
}

function record(...entries: readonly SupersededMarkupEntry[]): SupersededMarkupRecord {
  return { entries };
}

function baselineOf(files: Readonly<Record<string, FileFingerprint>>): StepMarkupBaseline {
  return { globs: ['src/**/*.tsx'], fileCount: Object.keys(files).length, files };
}

/** Source whose fingerprint is one `<div className="a">` and nothing else. */
const SOURCE_A = 'const a = <div className="a" />;';
const SOURCE_B = 'const a = <section className="a" />;';
const FP_A: FileFingerprint = fingerprintSource('a.tsx', SOURCE_A);
const FP_B: FileFingerprint = fingerprintSource('a.tsx', SOURCE_B);

function codesOf(refusals: readonly SanctionRefusal[]): readonly SanctionRefusalCode[] {
  return refusals.map((refusal) => refusal.code);
}

// ---------------------------------------------------------------------------
// § 12.1 — `selectAuthority`, one test per input. Nine named cells.
// ---------------------------------------------------------------------------

describe('INV-18 / § 12.1 — authority is selected by declaration, never by match', () => {
  const baseline = baselineOf({ 'src/a.tsx': FP_A, 'src/b.tsx': FP_A });
  const declaresA = record(entry(declaration({ file: 'src/a.tsx' }), FP_B));

  it('(a1) file varied — a declared file resolves to the superseded record', () => {
    expect(selectAuthority('src/a.tsx', baseline, declaresA)).toEqual({
      authority: 'superseded',
      recorded: FP_B,
    });
  });

  it('(a2) file varied — an undeclared baseline file resolves to the baseline', () => {
    expect(selectAuthority('src/b.tsx', baseline, declaresA)).toEqual({
      authority: 'baseline',
      recorded: FP_A,
    });
  });

  it('(a3) file varied — a file in neither record resolves to nothing', () => {
    expect(selectAuthority('src/nowhere.tsx', baseline, declaresA)).toBeNull();
  });

  it('(b1) baseline varied — the key is present and undeclared', () => {
    expect(selectAuthority('src/b.tsx', baselineOf({ 'src/b.tsx': FP_A }), record())).toEqual({
      authority: 'baseline',
      recorded: FP_A,
    });
  });

  it('(b2) baseline varied — the key is absent and the file is undeclared', () => {
    expect(selectAuthority('src/b.tsx', baselineOf({}), record())).toBeNull();
  });

  it('(b3) baseline varied — the key is absent but the record declares it (first-record)', () => {
    const firstRecord = record(
      entry(declaration({ file: 'src/new.tsx', kind: 'first-record' }), FP_B)
    );
    expect(selectAuthority('src/new.tsx', baselineOf({}), firstRecord)).toEqual({
      authority: 'superseded',
      recorded: FP_B,
    });
  });

  it('(c1) record varied — it declares the file', () => {
    expect(selectAuthority('src/a.tsx', baseline, declaresA)?.authority).toBe('superseded');
  });

  it('(c2) record varied — it declares a different file', () => {
    const declaresB = record(entry(declaration({ file: 'src/b.tsx' }), FP_B));
    expect(selectAuthority('src/a.tsx', baseline, declaresB)?.authority).toBe('baseline');
  });

  it('(c3) record varied — it is empty', () => {
    expect(selectAuthority('src/a.tsx', baseline, record())?.authority).toBe('baseline');
  });

  /**
   * N3. A try-baseline-then-fall-back implementation — the natural shape if you
   * write the comparison before the selector — passes N1 and N2 and is still a
   * hole: a superseded file that silently reverted to its pre-supersession
   * markup would match the baseline, the fallback would report `match`, and the
   * guard would call the file fine while the deliberate change was undone.
   *
   * `NO_DIVERGENCE` makes this state unwritable in the real record, so this
   * synthetic fixture is the only guard the property will ever have. That is a
   * reason to keep it, not to consider it unreachable and delete it.
   */
  it('N3 — a declared file whose baseline WOULD have matched still uses the superseded record', () => {
    const declared = record(entry(declaration({ file: 'src/a.tsx' }), FP_B));
    const selected = selectAuthority('src/a.tsx', baseline, declared);

    expect(selected).toEqual({ authority: 'superseded', recorded: FP_B });
    // The baseline holds the *matching* fingerprint and is still not consulted.
    expect(baseline.files['src/a.tsx']).toEqual(FP_A);
    expect(checkGuardedFile('src/a.tsx', SOURCE_A, baseline, declared).kind).toBe('mismatch');
  });

  it('the selector cannot see the source text at all', () => {
    // Match-driven selection is unexpressible rather than merely absent: the
    // signature has no `sourceText` parameter to reach for.
    expect(selectAuthority.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// § 12.2 — `checkGuardedFile`, one test per input, plus N1 and N2.
// ---------------------------------------------------------------------------

describe('§ 12.2 — checkGuardedFile, one test per input', () => {
  const baseline = baselineOf({ 'src/a.tsx': FP_A, 'src/b.tsx': FP_A });

  it('(a) file varied — the verdict is for the file asked about, and is a real verdict', () => {
    // Asserting only `.file` passes against a function that answers
    // `no-authority` for everything, so the whole verdict is pinned.
    expect(checkGuardedFile('src/b.tsx', SOURCE_A, baseline, record())).toEqual({
      kind: 'match',
      file: 'src/b.tsx',
      authority: 'baseline',
    });
  });

  it('(b1) sourceText varied — identical source matches', () => {
    expect(checkGuardedFile('src/a.tsx', SOURCE_A, baseline, record())).toEqual({
      kind: 'match',
      file: 'src/a.tsx',
      authority: 'baseline',
    });
  });

  it('(b2) sourceText varied — an anchor-only difference still matches', () => {
    const anchored = 'const a = <div data-config-anchor="x" className="a" />;';
    expect(checkGuardedFile('src/a.tsx', anchored, baseline, record()).kind).toBe('match');
  });

  it('(b3) sourceText varied — a structural difference mismatches', () => {
    const verdict = checkGuardedFile('src/a.tsx', SOURCE_B, baseline, record());
    expect(verdict.kind).toBe('mismatch');
    if (verdict.kind !== 'mismatch') return;
    expect(verdict.authority).toBe('baseline');
    expect(filterPermittedProps(verdict.recorded)).toEqual(filterPermittedProps(FP_A));
  });

  it('(c) baseline varied — a file the baseline no longer holds has no authority', () => {
    expect(checkGuardedFile('src/a.tsx', SOURCE_A, baselineOf({}), record())).toEqual({
      kind: 'no-authority',
      file: 'src/a.tsx',
    });
  });

  it('(d) record varied — declaring the file moves the authority', () => {
    const declared = record(entry(declaration({ file: 'src/a.tsx' }), FP_B));
    const verdict = checkGuardedFile('src/a.tsx', SOURCE_B, baseline, declared);
    expect(verdict).toEqual({ kind: 'match', file: 'src/a.tsx', authority: 'superseded' });
  });

  /**
   * N1 — P7, the re-freeze is real. A superseded file is guarded again from the
   * moment it is recorded, which is what makes supersession cost the guard
   * nothing permanent and makes deleting the file from the guarded set the
   * strictly worse answer it is.
   */
  it('N1 — a superseded file that drifts from its superseded fingerprint mismatches', () => {
    const declared = record(entry(declaration({ file: 'src/a.tsx' }), FP_B));
    const drifted = 'const a = <section className="b" />;';
    const verdict = checkGuardedFile('src/a.tsx', drifted, baseline, declared);

    expect(verdict.kind).toBe('mismatch');
    if (verdict.kind !== 'mismatch') return;
    expect(verdict.authority).toBe('superseded');
  });

  /**
   * N2 — AS-2, head-on, at the real arithmetic.
   *
   * SF-14's named set is exactly three of the guard's twenty-five files, so the
   * obligation is concrete: three declared, **twenty-two** still compared
   * against their original baseline fingerprint and still failing on any
   * element, nesting, class or style change. A two-file fixture cannot tell
   * "the undeclared file was compared against the baseline" apart from "the
   * loop only had one authority available", so this one is the full twenty-five.
   */
  describe('N2 — the freeze survives for undeclared files while the record is non-empty', () => {
    const DECLARED = [
      'src/components/shared/TogglePill.tsx',
      'src/components/shared/TopicToggleGroup.tsx',
      'src/features/wizard/steps/identity/TrustedIssuersSection.tsx',
    ] as const;

    const files: Record<string, FileFingerprint> = {};
    for (const name of DECLARED) files[name] = FP_A;
    for (let index = 0; index < 22; index += 1) {
      files[`src/features/wizard/steps/other/File${index}.tsx`] = FP_A;
    }
    const wideBaseline = baselineOf(files);
    const wideRecord = record(...DECLARED.map((file) => entry(declaration({ file }), FP_B)));

    it('the fixture is 25 = 3 declared + 22 undeclared', () => {
      expect(Object.keys(files)).toHaveLength(25);
      expect(wideRecord.entries).toHaveLength(3);
    });

    it('one of the other twenty-two diverges and fails against the BASELINE', () => {
      const victim = 'src/features/wizard/steps/other/File7.tsx';
      const verdict = checkGuardedFile(victim, SOURCE_B, wideBaseline, wideRecord);

      expect(verdict.kind).toBe('mismatch');
      if (verdict.kind !== 'mismatch') return;
      expect(verdict.authority).toBe('baseline');
    });

    it('all twenty-two undeclared files resolve to the baseline, and all three declared do not', () => {
      const byAuthority = Object.keys(files).map(
        (file) => selectAuthority(file, wideBaseline, wideRecord)?.authority
      );
      expect(byAuthority.filter((authority) => authority === 'baseline')).toHaveLength(22);
      expect(byAuthority.filter((authority) => authority === 'superseded')).toHaveLength(3);
    });
  });

  /**
   * INV-3's hole, at the unit. A `first-record` file is declared, validated,
   * fingerprinted, written, and passes two-key equality and the union check —
   * and if the comparison loop iterates the baseline's keys it is compared
   * against nothing at all, forever. This asserts the verdict exists; the suite
   * asserts the loop visits it.
   */
  it('INV-3 — a first-record file (absent from the baseline) is compared, not skipped', () => {
    const firstRecord = record(
      entry(declaration({ file: 'src/new.tsx', kind: 'first-record' }), FP_B)
    );
    const verdict = checkGuardedFile('src/new.tsx', SOURCE_A, baselineOf({}), firstRecord);

    expect(verdict.kind).toBe('mismatch');
    if (verdict.kind !== 'mismatch') return;
    expect(verdict.authority).toBe('superseded');
  });

  /**
   * INV-4. A verdict that says "I have no answer for this input" must not be
   * read as "nothing to check" — that is the worst possible reading of a total
   * function, and it is the reading a `switch` arm that returns without
   * asserting produces.
   */
  it('INV-4 — a file in neither record yields `no-authority`, which is a failure, not a skip', () => {
    const verdict: GuardVerdict = checkGuardedFile(
      'src/ghost.tsx',
      SOURCE_A,
      baselineOf({}),
      record()
    );
    expect(verdict).toEqual({ kind: 'no-authority', file: 'src/ghost.tsx' });

    // Differential: `no-authority` is also what an inert implementation returns
    // for every input, so the same file with an authority present must not
    // produce it.
    const held = checkGuardedFile(
      'src/ghost.tsx',
      SOURCE_A,
      baselineOf({ 'src/ghost.tsx': FP_A }),
      record()
    );
    expect(held.kind).toBe('match');
  });
});

// ---------------------------------------------------------------------------
// INV-9 / INV-10 — the refusal surface.
// ---------------------------------------------------------------------------

describe('INV-9 — the refusal-code union is pinned exhaustively', () => {
  it('the codes are exactly these eleven', () => {
    expect([...SANCTION_REFUSAL_CODES].sort()).toEqual([
      'ALREADY_BASELINED',
      'ANCHOR_DELTA_MISMATCH',
      'DUPLICATE_FILE',
      'EMPTY_DECLARATION',
      'MALFORMED_AUTHORITY',
      'MALFORMED_RECORD',
      'MISSING_REASON',
      'NOT_BASELINED',
      'NO_DIVERGENCE',
      'STALE_ADOPTION',
      'UNKNOWN_FILE',
    ]);
  });

  it('the pinned array has no duplicates', () => {
    expect(new Set(SANCTION_REFUSAL_CODES).size).toBe(SANCTION_REFUSAL_CODES.length);
  });
});

// ---------------------------------------------------------------------------
// § 12.3 — `validateSanction`: one test per input, one test per refusal code.
// ---------------------------------------------------------------------------

const GUARDED = ['src/a.tsx', 'src/b.tsx'] as const;
const BASELINE = baselineOf({ 'src/a.tsx': FP_A, 'src/b.tsx': FP_A });

function validate(over: {
  declarations?: readonly MarkupSupersession[];
  guardedFiles?: readonly string[];
  baseline?: StepMarkupBaseline;
  record?: SupersededMarkupRecord;
  current?: Readonly<Record<string, FileFingerprint>>;
}): readonly SanctionRefusal[] {
  return validateSanction({
    declarations: over.declarations ?? [declaration()],
    guardedFiles: over.guardedFiles ?? GUARDED,
    baseline: over.baseline ?? BASELINE,
    record: over.record ?? record(),
    current: over.current ?? { 'src/a.tsx': FP_B },
  });
}

describe('§ 12.3 — validateSanction, one test per input', () => {
  it('the all-clear case refuses nothing', () => {
    expect(codesOf(validate({}))).toEqual([]);
  });

  it('(a) declarations varied', () => {
    expect(codesOf(validate({ declarations: [] }))).toEqual(['EMPTY_DECLARATION']);
  });

  it('(b) guardedFiles varied', () => {
    expect(codesOf(validate({ guardedFiles: ['src/b.tsx'] }))).toEqual(['UNKNOWN_FILE']);
  });

  it('(c) baseline varied', () => {
    expect(codesOf(validate({ baseline: baselineOf({ 'src/b.tsx': FP_A }) }))).toEqual([
      'NOT_BASELINED',
    ]);
  });

  it('(d) record varied — the in-force authority moves with it', () => {
    const prior = record(entry(declaration(), FP_B));
    // Current equals the record *and* the declaration echoes it — carry-forward
    // (SF-17), not a speculative hole. Prove the authority still moves by
    // changing the declaration without a markup divergence → NO_DIVERGENCE.
    expect(codesOf(validate({ record: prior }))).toEqual([]);
    expect(
      codesOf(
        validate({
          record: prior,
          declarations: [declaration({ decidedOn: '2026-10-01' })],
          current: { 'src/a.tsx': FP_B },
        })
      )
    ).toEqual(['NO_DIVERGENCE']);
  });

  it('(e) current varied', () => {
    expect(codesOf(validate({ current: { 'src/a.tsx': FP_A } }))).toEqual(['NO_DIVERGENCE']);
  });
});

describe('INV-9 — every code has a test whose input triggers exactly that one code', () => {
  it('EMPTY_DECLARATION', () => {
    expect(codesOf(validate({ declarations: [] }))).toEqual(['EMPTY_DECLARATION']);
  });

  it('UNKNOWN_FILE', () => {
    expect(codesOf(validate({ declarations: [declaration({ file: 'src/typo.tsx' })] }))).toEqual([
      'UNKNOWN_FILE',
    ]);
  });

  it('DUPLICATE_FILE', () => {
    const twice = [declaration(), declaration()];
    expect(codesOf(validate({ declarations: twice }))).toEqual(['DUPLICATE_FILE']);
  });

  it('MISSING_REASON', () => {
    expect(codesOf(validate({ declarations: [declaration({ reason: 'TODO' })] }))).toEqual([
      'MISSING_REASON',
    ]);
  });

  it('MALFORMED_AUTHORITY', () => {
    expect(codesOf(validate({ declarations: [declaration({ authorisedBy: 'me' })] }))).toEqual([
      'MALFORMED_AUTHORITY',
    ]);
  });

  it('NO_DIVERGENCE', () => {
    expect(codesOf(validate({ current: { 'src/a.tsx': FP_A } }))).toEqual(['NO_DIVERGENCE']);
  });

  it('ALREADY_BASELINED', () => {
    expect(codesOf(validate({ declarations: [declaration({ kind: 'first-record' })] }))).toEqual([
      'ALREADY_BASELINED',
    ]);
  });

  it('NOT_BASELINED', () => {
    expect(codesOf(validate({ baseline: baselineOf({ 'src/b.tsx': FP_A }) }))).toEqual([
      'NOT_BASELINED',
    ]);
  });

  it('ANCHOR_DELTA_MISMATCH', () => {
    const anchored = fingerprintSource('a.tsx', 'const a = <div data-config-anchor="x" />;');
    expect(
      codesOf(
        validate({
          declarations: [declaration({ anchorDelta: 0 })],
          current: { 'src/a.tsx': anchored },
        })
      )
    ).toEqual(['ANCHOR_DELTA_MISMATCH']);
  });

  it('STALE_ADOPTION', () => {
    const prior = record(entry(declaration({ decidedOn: '2026-09-01' }), FP_A));
    expect(codesOf(validate({ record: prior }))).toEqual(['STALE_ADOPTION']);
  });

  it('MALFORMED_RECORD', () => {
    const parsed = parseSupersededRecord('{ not json');
    expect('refusals' in parsed ? codesOf(parsed.refusals) : []).toEqual(['MALFORMED_RECORD']);
  });
});

describe('INV-11 — every refusal is reported, not the first', () => {
  it('one declaration with three problems returns exactly three codes', () => {
    const broken = declaration({ file: 'src/typo.tsx', reason: 'TBD', authorisedBy: 'nobody' });
    expect([...codesOf(validate({ declarations: [broken], current: {} }))].sort()).toEqual([
      'MALFORMED_AUTHORITY',
      'MISSING_REASON',
      'UNKNOWN_FILE',
    ]);
  });

  it('three declarations with one problem each name three different files', () => {
    const refusals = validate({
      declarations: [
        declaration({ file: 'src/a.tsx', reason: 'TODO' }),
        declaration({ file: 'src/b.tsx', authorisedBy: 'x' }),
        declaration({ file: 'src/typo.tsx' }),
      ],
      current: { 'src/a.tsx': FP_B, 'src/b.tsx': FP_B, 'src/typo.tsx': FP_B },
    });
    expect(new Set(refusals.map((refusal) => refusal.file)).size).toBe(3);
  });

  it('the order is deterministic across shuffled input', () => {
    const one = [
      declaration({ file: 'src/b.tsx', reason: 'TODO' }),
      declaration({ file: 'src/a.tsx', authorisedBy: 'x' }),
    ];
    const other = [one[1]!, one[0]!];
    const current = { 'src/a.tsx': FP_B, 'src/b.tsx': FP_B };
    // Two empty lists are also equal, so the comparison is only meaningful once
    // there is something to order.
    expect(validate({ declarations: one, current })).toHaveLength(2);
    expect(validate({ declarations: one, current })).toEqual(
      validate({ declarations: other, current })
    );
  });

  /**
   * The documented order itself — by file, then by code — and not merely "the
   * same order twice".
   *
   * Found by mutation: reversing both comparators is *also* deterministic, so
   * the shuffle test above stays green while the CLI prints its refusals
   * backwards. Two runs being equal is the same shape as two runs being empty —
   * self-consistency is not the property. This pins the sequence a reader of the
   * output actually depends on, with two codes on one file so the tie-break is
   * exercised rather than assumed.
   */
  it('the order is the documented one — by file, then by code within a file', () => {
    const refusals = validate({
      declarations: [
        declaration({ file: 'src/c.tsx', anchorDelta: 5 }),
        declaration({ file: 'src/a.tsx', reason: 'TODO', authorisedBy: 'nobody' }),
        declaration({ file: 'src/b.tsx', kind: 'first-record', anchorDelta: 9 }),
      ],
      baseline: baselineOf({ 'src/b.tsx': FP_A, 'src/c.tsx': FP_A }),
      guardedFiles: ['src/b.tsx', 'src/c.tsx'],
      current: { 'src/b.tsx': FP_B, 'src/c.tsx': FP_B },
    });

    expect(refusals.map((refusal) => [refusal.file, refusal.code])).toEqual([
      ['src/a.tsx', 'MALFORMED_AUTHORITY'],
      ['src/a.tsx', 'MISSING_REASON'],
      ['src/a.tsx', 'UNKNOWN_FILE'],
      ['src/b.tsx', 'ALREADY_BASELINED'],
      ['src/b.tsx', 'ANCHOR_DELTA_MISMATCH'],
      ['src/c.tsx', 'ANCHOR_DELTA_MISMATCH'],
    ]);
  });

  it('a set-level refusal carries a null file; a per-file refusal names the file', () => {
    expect(validate({ declarations: [] })[0]?.file).toBeNull();
    expect(validate({ declarations: [declaration({ file: 'src/typo.tsx' })] })[0]?.file).toBe(
      'src/typo.tsx'
    );
  });
});

describe('INV-5 — kind determines baseline membership exactly, four cells', () => {
  const absentBaseline = baselineOf({ 'src/b.tsx': FP_A });

  it('replaces-baseline + present = admissible', () => {
    expect(codesOf(validate({ declarations: [declaration()] }))).toEqual([]);
  });

  it('replaces-baseline + absent = NOT_BASELINED', () => {
    expect(codesOf(validate({ baseline: absentBaseline }))).toEqual(['NOT_BASELINED']);
  });

  it('first-record + absent = admissible', () => {
    expect(
      codesOf(
        validate({
          declarations: [declaration({ kind: 'first-record' })],
          baseline: absentBaseline,
        })
      )
    ).toEqual([]);
  });

  it('first-record + present = ALREADY_BASELINED', () => {
    expect(codesOf(validate({ declarations: [declaration({ kind: 'first-record' })] }))).toEqual([
      'ALREADY_BASELINED',
    ]);
  });
});

describe('INV-13 — MISSING_REASON is a stated heuristic, tested at both boundaries', () => {
  it('39 characters refuses and 40 passes', () => {
    expect(codesOf(validate({ declarations: [declaration({ reason: 'x'.repeat(39) })] }))).toEqual([
      'MISSING_REASON',
    ]);
    expect(codesOf(validate({ declarations: [declaration({ reason: 'x'.repeat(40) })] }))).toEqual(
      []
    );
  });

  it.each(['TODO', 'TBD', 'see above', 'n/a', 'todo', 'N/A'])(
    'the placeholder %s refuses however it is cased',
    (reason) => {
      expect(codesOf(validate({ declarations: [declaration({ reason })] }))).toEqual([
        'MISSING_REASON',
      ]);
    }
  );

  it('forty spaces refuses — the floor is applied after trimming', () => {
    expect(codesOf(validate({ declarations: [declaration({ reason: ' '.repeat(45) })] }))).toEqual([
      'MISSING_REASON',
    ]);
  });

  /**
   * A guard that fires on ordinary English gets deleted, and this initiative has
   * already lost one that way. The placeholder match is on the whole trimmed
   * reason, never a substring.
   */
  it('a placeholder embedded in a genuine sentence PASSES', () => {
    const genuine =
      "The dev's TODO list for SF-14 named this component, and the chip body must become activatable.";
    expect(codesOf(validate({ declarations: [declaration({ reason: genuine })] }))).toEqual([]);
  });
});

describe('INV-14 — ANCHOR_DELTA_MISMATCH withholds the correct number, by decision', () => {
  it('the detail names the file and contains no digit-sequence equal to the true delta', () => {
    const anchored = fingerprintSource(
      'a.tsx',
      'const a = <div data-config-anchor="x"><span configAnchor="y" /></div>;'
    );
    // Computed from the fixture, never written as a literal.
    const trueDelta = countAnchorProps(anchored) - countAnchorProps(FP_A);
    const refusals = validate({
      declarations: [declaration({ anchorDelta: 0 })],
      current: { 'src/a.tsx': anchored },
    });

    expect(codesOf(refusals)).toEqual(['ANCHOR_DELTA_MISMATCH']);
    expect(refusals[0]?.file).toBe('src/a.tsx');
    expect(trueDelta).toBeGreaterThan(0);
    const digits = refusals[0]?.detail.match(/\d+/g) ?? [];
    expect(digits.filter((digit) => digit === String(trueDelta))).toEqual([]);
  });

  it('a correctly declared delta passes', () => {
    const anchored = fingerprintSource('a.tsx', 'const a = <div data-config-anchor="x" />;');
    const trueDelta = countAnchorProps(anchored) - countAnchorProps(FP_A);
    expect(
      codesOf(
        validate({
          declarations: [declaration({ anchorDelta: trueDelta })],
          current: { 'src/a.tsx': anchored },
        })
      )
    ).toEqual([]);
  });

  /**
   * INV-8 — the delta is denominated against the **seal**, not the record entry
   * in force. A recorded first anchor re-validated against its own entry reads 0
   * forever, so the first re-run after adopting one would refuse on a file nobody
   * touched — and with it every later declaration set. Found on the first real
   * `introducesFirstAnchor: true` adoption (SF-14 post-core, DocumentManager).
   */
  it('a recorded first anchor carried forward re-validates against the seal, not its own entry', () => {
    const anchored = fingerprintSource('a.tsx', 'const a = <div data-config-anchor="x" />;');
    const trueDelta = countAnchorProps(anchored) - countAnchorProps(FP_A);
    expect(trueDelta).toBeGreaterThan(0);
    const declared = declaration({ anchorDelta: trueDelta, introducesFirstAnchor: true });
    const prior = record(entry(declared, anchored));
    expect(
      codesOf(
        validate({ declarations: [declared], record: prior, current: { 'src/a.tsx': anchored } })
      )
    ).toEqual([]);
  });
});

describe('INV-15 — divergence is measured against the authority in force', () => {
  it('no prior entry — the comparison is against the baseline', () => {
    expect(codesOf(validate({ record: record(), current: { 'src/a.tsx': FP_A } }))).toEqual([
      'NO_DIVERGENCE',
    ]);
  });

  it('a prior entry equal to current with an echoing declaration — carry-forward, not NO_DIVERGENCE', () => {
    // SF-17 subset re-supersession: an unchanged sibling stays declared so the
    // two-key set does not drop it. Echoing the prior entry is retention, not a
    // speculative new hole.
    const prior = record(entry(declaration(), FP_B));
    expect(codesOf(validate({ record: prior, current: { 'src/a.tsx': FP_B } }))).toEqual([]);
  });

  it('a prior entry equal to current but the declaration moved — NO_DIVERGENCE', () => {
    // Metadata-only "re-adoption" without a markup divergence is still refused.
    const prior = record(entry(declaration({ decidedOn: '2026-08-01' }), FP_B));
    expect(
      codesOf(
        validate({
          record: prior,
          declarations: [declaration({ decidedOn: '2026-10-01' })],
          current: { 'src/a.tsx': FP_B },
        })
      )
    ).toEqual(['NO_DIVERGENCE']);
  });

  /**
   * The failure this closes: `NO_DIVERGENCE` always comparing against the
   * baseline. After a supersession every declared file differs from the
   * baseline forever — that is what a supersession *is* — so the refusal would
   * be permanently inert for exactly the files it constrains, and
   * `supersede:step-markup` would become a command that always succeeds.
   */
  it('a prior entry different from current — the baseline is NOT what is compared', () => {
    const prior = record(entry(declaration({ decidedOn: '2026-08-01' }), FP_B));
    const current = { 'src/a.tsx': FP_A };

    // `not.toEqual([...])` would also be satisfied by the empty list an inert
    // validator returns, so this asserts the exact outcome and then shows it
    // moving with the only input that is varied.
    expect(codesOf(validate({ record: prior, current }))).toEqual([]);
    expect(codesOf(validate({ record: record(), current }))).toEqual(['NO_DIVERGENCE']);
  });

  it('a first-record declaration with no prior entry is exempt by its kind', () => {
    expect(
      codesOf(
        validate({
          declarations: [declaration({ kind: 'first-record' })],
          baseline: baselineOf({ 'src/b.tsx': FP_A }),
          current: { 'src/a.tsx': FP_A },
        })
      )
    ).toEqual([]);
  });
});

describe('INV-16 — STALE_ADOPTION: a second adoption costs what the first one cost', () => {
  const prior = record(entry(declaration({ decidedOn: '2026-09-01' }), FP_A));
  const current = { 'src/a.tsx': FP_B };

  it('prior entry, current differs, decidedOn unchanged — refuses', () => {
    expect(
      codesOf(
        validate({
          record: prior,
          declarations: [declaration({ decidedOn: '2026-09-01' })],
          current,
        })
      )
    ).toEqual(['STALE_ADOPTION']);
  });

  it('prior entry, current differs, decidedOn advanced — passes', () => {
    expect(
      codesOf(
        validate({
          record: prior,
          declarations: [declaration({ decidedOn: '2026-10-15' })],
          current,
        })
      )
    ).toEqual([]);
  });

  it('prior entry, current differs, decidedOn moved backwards — refuses', () => {
    expect(
      codesOf(
        validate({
          record: prior,
          declarations: [declaration({ decidedOn: '2026-08-01' })],
          current,
        })
      )
    ).toEqual(['STALE_ADOPTION']);
  });

  it('no prior entry — not applicable, so the first adoption is untouched', () => {
    expect(codesOf(validate({ record: record(), current }))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// INV-1 / INV-2 — two-key agreement.
// ---------------------------------------------------------------------------

describe('INV-1 — two-key agreement is field-by-field, not file-name-set equality', () => {
  const declared = declaration();
  const agreeing = record(entry(declared, FP_B));

  /**
   * The standing rule, applied to the sixth decision function: one test per
   * input, varying only that input. `checkTwoKeyAgreement` had thorough cases
   * and no per-input cells, and the two inputs are exactly what a regression
   * varies — the half a reader trusts (the declaration) and the half nobody
   * re-reads (the record).
   */
  it('(a) declarations varied — same record, three declaration sets, three answers', () => {
    const fingerprint = FP_A;
    const adopted = summariseAdoption(FP_A, FP_A);
    const only = { entries: [{ ...declaration(), adopted, fingerprint }] };

    expect(codesOf(checkTwoKeyAgreement([declaration()], only))).toEqual([]);
    expect(codesOf(checkTwoKeyAgreement([], only))).toEqual(['UNKNOWN_FILE']);
    expect(
      codesOf(checkTwoKeyAgreement([declaration(), declaration({ file: 'src/b.tsx' })], only))
    ).toEqual(['UNKNOWN_FILE']);
  });

  it('(b) record varied — same declaration, three records, three answers', () => {
    const declared = declaration();
    const adopted = summariseAdoption(FP_A, FP_A);
    const agreeing = { entries: [{ ...declared, adopted, fingerprint: FP_A }] };

    expect(codesOf(checkTwoKeyAgreement([declared], agreeing))).toEqual([]);
    expect(codesOf(checkTwoKeyAgreement([declared], record()))).toEqual(['UNKNOWN_FILE']);
    expect(
      codesOf(
        checkTwoKeyAgreement([declared], {
          entries: [{ ...declared, adopted, fingerprint: FP_A, anchorDelta: 3 }],
        })
      )
    ).toEqual(['MALFORMED_RECORD']);
  });

  it('a matching pair agrees', () => {
    expect(codesOf(checkTwoKeyAgreement([declared], agreeing))).toEqual([]);
  });

  it('N9a — a file in the record only fails', () => {
    expect(codesOf(checkTwoKeyAgreement([], agreeing))).toEqual(['UNKNOWN_FILE']);
  });

  it('N9b — a file in the declaration only fails', () => {
    expect(codesOf(checkTwoKeyAgreement([declared], record()))).toEqual(['UNKNOWN_FILE']);
  });

  it('a duplicated declaration fails', () => {
    expect(codesOf(checkTwoKeyAgreement([declared, declared], agreeing))).toEqual([
      'DUPLICATE_FILE',
    ]);
  });

  it('a duplicated record entry fails — the record is an array, so uniqueness is not free', () => {
    const twice = record(entry(declared, FP_B), entry(declared, FP_B));
    expect(codesOf(checkTwoKeyAgreement([declared], twice))).toEqual(['DUPLICATE_FILE']);
  });

  /**
   * The eight cases that matter. File-name equality passes while the JSON
   * carries a different reason, a different `authorisedBy`, a different
   * `decidedOn` or a different `anchorDelta` from the declaration it claims to
   * echo — and the failure is invisible, because the record is machine-written
   * and nobody re-reads it. One case per mirrored field, so no field is covered
   * only by its neighbours.
   */
  const DISAGREEMENTS: ReadonlyArray<readonly [string, Partial<MarkupSupersession>]> = [
    ['anchorDelta', { anchorDelta: 3 }],
    ['authorisedBy', { authorisedBy: 'SF-99' }],
    ['components', { components: ['B'] }],
    ['decidedOn', { decidedOn: '2020-01-01' }],
    ['file', { file: 'src/b.tsx' }],
    ['introducesFirstAnchor', { introducesFirstAnchor: true }],
    ['kind', { kind: 'first-record' }],
    ['reason', { reason: `${REASON} And a tidier sentence nobody wrote.` }],
  ];

  it('MIRRORED_FIELDS covers every declaration field, and every one has a case', () => {
    expect([...MIRRORED_FIELDS].sort()).toEqual(DISAGREEMENTS.map(([name]) => name).sort());
  });

  it.each(DISAGREEMENTS)('a record entry disagreeing on `%s` fails', (_name, over) => {
    const drifted = record(entry({ ...declared, ...over }, FP_B));
    expect(codesOf(checkTwoKeyAgreement([declared], drifted)).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// § 12.4 — `summariseAdoption`, one test per output field.
// ---------------------------------------------------------------------------

describe('§ 12.4 — summariseAdoption, one test per field', () => {
  const before: FileFingerprint = [element('div', ['className'], { className: 'Str("a")' })];

  it('identity is all zero', () => {
    expect(summariseAdoption(before, before)).toEqual({
      elementsBefore: 1,
      elementsAfter: 1,
      tagsAdded: [],
      tagsRemoved: [],
      valuesChanged: 0,
    });
  });

  it('an element added moves elementsAfter and tagsAdded', () => {
    const after: FileFingerprint = [...before, element('span')];
    const summary = summariseAdoption(before, after);
    expect(summary.elementsAfter).toBe(2);
    expect(summary.tagsAdded).toEqual(['span']);
    expect(summary.tagsRemoved).toEqual([]);
  });

  it('an element removed moves elementsBefore and tagsRemoved', () => {
    const after: FileFingerprint = [];
    const summary = summariseAdoption(before, after);
    expect(summary.elementsBefore).toBe(1);
    expect(summary.elementsAfter).toBe(0);
    expect(summary.tagsRemoved).toEqual(['div']);
  });

  it('a renamed tag appears in both lists', () => {
    const after: FileFingerprint = [element('section', ['className'], { className: 'Str("a")' })];
    const summary = summariseAdoption(before, after);
    expect(summary.tagsAdded).toEqual(['section']);
    expect(summary.tagsRemoved).toEqual(['div']);
  });

  it('a className change moves valuesChanged only', () => {
    const after: FileFingerprint = [element('div', ['className'], { className: 'Str("b")' })];
    const summary = summariseAdoption(before, after);
    expect(summary.valuesChanged).toBe(1);
    expect(summary.tagsAdded).toEqual([]);
    expect(summary.tagsRemoved).toEqual([]);
  });

  it('tags carry multiplicity and are sorted', () => {
    const after: FileFingerprint = [...before, element('b'), element('a'), element('b')];
    expect(summariseAdoption(before, after).tagsAdded).toEqual(['a', 'b', 'b']);
  });

  it('a first-record adoption summarises against the empty fingerprint', () => {
    expect(summariseAdoption([], before).elementsBefore).toBe(0);
    expect(summariseAdoption([], before).tagsAdded).toEqual(['div']);
  });

  it('nested elements are counted', () => {
    const nested: FileFingerprint = [element('div', [], {}, [element('span')])];
    expect(summariseAdoption([], nested).elementsAfter).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// § 12.5 — `parseSupersededRecord`, the single `unknown` boundary.
// ---------------------------------------------------------------------------

describe('§ 12.5 / INV-12 — parseSupersededRecord is total', () => {
  it('a valid record parses', () => {
    const declared = declaration();
    const json = JSON.stringify({ entries: [entry(declared, FP_B)] });
    const parsed = parseSupersededRecord(json);
    expect('record' in parsed).toBe(true);
    if (!('record' in parsed)) return;
    expect(parsed.record.entries).toHaveLength(1);
  });

  it('an empty record is success, not a refusal — that is the shipped state', () => {
    const parsed = parseSupersededRecord('{ "entries": [] }');
    expect('record' in parsed && parsed.record.entries).toEqual([]);
  });

  it('invalid JSON refuses MALFORMED_RECORD with a null file', () => {
    const parsed = parseSupersededRecord('{ nope');
    expect('refusals' in parsed ? codesOf(parsed.refusals) : []).toEqual(['MALFORMED_RECORD']);
    expect('refusals' in parsed ? parsed.refusals[0]?.file : undefined).toBeNull();
  });

  it('valid JSON of the wrong shape refuses', () => {
    expect(codesFromParse('[]')).toEqual(['MALFORMED_RECORD']);
    expect(codesFromParse('{}')).toEqual(['MALFORMED_RECORD']);
    expect(codesFromParse('{"entries":{}}')).toEqual(['MALFORMED_RECORD']);
  });

  it('a wrong field type refuses and names the entry', () => {
    const declared = declaration();
    const json = JSON.stringify({
      entries: [{ ...entry(declared, FP_B), anchorDelta: 'zero' }],
    });
    const parsed = parseSupersededRecord(json);
    expect('refusals' in parsed ? codesOf(parsed.refusals) : []).toEqual(['MALFORMED_RECORD']);
    expect('refusals' in parsed ? parsed.refusals[0]?.file : undefined).toBe('src/a.tsx');
  });

  it.each(['', 'null', '[]', '"x"', '{"entries":[null]}', '{"entries":[{}]}'])(
    'never throws on %j',
    (json) => {
      expect(() => parseSupersededRecord(json)).not.toThrow();
    }
  );
});

function codesFromParse(json: string): readonly SanctionRefusalCode[] {
  const parsed = parseSupersededRecord(json);
  return 'refusals' in parsed ? codesOf(parsed.refusals) : [];
}

// ---------------------------------------------------------------------------
// INV-22 / N4 — one permission set, and it is live rather than decorative.
// ---------------------------------------------------------------------------

describe('INV-22 — the comparison filter and the anchor detector are the same set', () => {
  /**
   * Driven by the decisions list, so a fourth decision is covered without
   * editing this body. A hand-written pair list would leave the next decision
   * covered by nothing.
   */
  it('a prop is dropped by the filter iff it is counted by the detector', () => {
    const probes = [
      ...PERMITTED_PROP_DECISIONS.map((d) => ({ prop: d.prop, tag: d.tag ?? 'div' })),
      ...PERMITTED_PROP_DECISIONS.map((d) => ({ prop: `${d.prop}s`, tag: d.tag ?? 'div' })),
      ...PERMITTED_PROP_DECISIONS.filter((d) => d.tag !== null).map((d) => ({
        prop: d.prop,
        tag: 'SomeOtherTag',
      })),
      { prop: 'ConfigAnchor', tag: 'div' },
      { prop: 'id', tag: 'div' },
      { prop: 'className', tag: 'div' },
    ];

    const droppedBy: string[] = [];
    const countedBy: string[] = [];
    for (const { prop, tag } of probes) {
      const label = `${prop}@${tag}`;
      const fingerprint: FileFingerprint = [element(tag, [prop])];
      if (!filterPermittedProps(fingerprint)[0]?.props.includes(prop)) droppedBy.push(label);
      if (countAnchorProps(fingerprint) === 1) countedBy.push(label);
    }

    expect(droppedBy).toEqual(countedBy);
    expect(droppedBy.length).toBeGreaterThan(0);
  });

  /**
   * N4. If `filterPermittedProps` stayed hard-coded while
   * `PERMITTED_PROP_DECISIONS` became decoration, the pinned § 4.5 clause would
   * still pass and the derivation would be a lie. So this shows the filter's
   * *behaviour* changing when a decision is appended — and the detector's along
   * with it, which is the half INV-22 is actually about.
   */
  it('N4 — appending a decision changes both the filter and the detector', async () => {
    const probe: FileFingerprint = [element('div', ['data-selected'])];

    expect(filterPermittedProps(probe)[0]?.props).toEqual(['data-selected']);
    expect(countAnchorProps(probe)).toBe(0);

    vi.resetModules();
    vi.doMock('./stepMarkupSanction', async () => {
      const actual =
        await vi.importActual<typeof import('./stepMarkupSanction')>('./stepMarkupSanction');
      return {
        ...actual,
        PERMITTED_PROP_DECISIONS: [
          ...actual.PERMITTED_PROP_DECISIONS,
          {
            prop: 'data-selected',
            tag: null,
            authorisedBy: 'SF-99',
            decidedOn: '2026-09-02',
            reason: 'A synthetic fourth decision, used only to prove the derivation is live.',
          },
        ],
      };
    });

    try {
      const widened = await import('./stepMarkupFingerprint');
      expect(widened.filterPermittedProps(probe)[0]?.props).toEqual([]);
      expect(widened.countAnchorProps(probe)).toBe(1);
    } finally {
      vi.doUnmock('./stepMarkupSanction');
      vi.resetModules();
    }
  });
});

// ---------------------------------------------------------------------------
// INV-30 / INV-6 — the DI seam and the type discipline, asserted over source.
// ---------------------------------------------------------------------------

describe('INV-30 — the guard modules can reach nothing', () => {
  const MODULES = [
    'src/features/wizard/focused-path/stepMarkupGuard.ts',
    'src/features/wizard/focused-path/stepMarkupSanction.ts',
  ] as const;

  it('the scan read both files, and the stripper ran', () => {
    const sources = readScannedSources(MODULES);
    expect(sources).toHaveLength(2);
    for (const source of sources) {
      expect(source.raw.length).toBeGreaterThan(1000);
      expect(source.stripped.length).toBeLessThan(source.raw.length);
    }
    // A token that lives only in prose: present raw, gone stripped.
    expect(findTokenAcross(sources, 'auto-updating-golden')).toEqual([]);
    expect(sources.some((source) => source.raw.includes('auto-updating-golden'))).toBe(true);
  });

  it.each(['node:fs', 'readFileSync', 'writeFileSync', 'process.', 'console.'])(
    'neither module reaches `%s`',
    (token) => {
      expect(findTokenAcross(readScannedSources(MODULES), token)).toEqual([]);
    }
  );

  it('no `any`, and exactly one `unknown` — the JSON boundary', () => {
    const sources = readScannedSources(MODULES);
    expect(findTokenAcross(sources, ': any')).toEqual([]);
    expect(findTokenAcross(sources, 'unknown')).toHaveLength(1);
  });

  it('the sanction module has zero imports, so it can never cycle', () => {
    const [sanction] = readScannedSources([MODULES[1]]);
    expect(findTokenAcross([sanction!], 'import ')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// INV-29 / INV-32 — the boundary. Neither had a test before this stage.
// ---------------------------------------------------------------------------

/**
 * Both properties are true today and nothing asserted them, which is the
 * weakest position a property can be in: it holds by everyone's good intentions
 * and its violation ships silently. INV-32's violation is a bundle regression —
 * a guard module and the whole `typescript` compiler it pulls in, reachable from
 * app code — and the reflex that causes it is adding an export to the barrel
 * because that is where the neighbours are.
 *
 * The shape is the one `configPath.boundary.test.ts` already uses for the same
 * job (§ II).
 */
describe('INV-29 / INV-32 — the guard modules stay out of the app', () => {
  const GUARD_MODULES = ['stepMarkupGuard', 'stepMarkupSanction', 'stepMarkupFingerprint'] as const;

  /** Every `.ts`/`.tsx` under `src/`, with its text. */
  function appSources(): ReadonlyArray<{ path: string; source: string }> {
    const found: Array<{ path: string; source: string }> = [];
    const walk = (dir: string): void => {
      for (const item of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, item.name);
        if (item.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(item.name)) continue;
        found.push({ path: full.slice(APP_ROOT.length + 1), source: readFileSync(full, 'utf8') });
      }
    };
    walk(join(APP_ROOT, 'src'));
    return found;
  }

  it('the walk read the app, so a clean result is a real one', () => {
    const sources = appSources();
    expect(sources.length).toBeGreaterThan(100);
    expect(sources.some((entry) => entry.path.endsWith('WizardPage.tsx'))).toBe(true);
  });

  it('INV-32 — the barrel re-exports neither module, so app code cannot reach one', () => {
    const barrel = readFileSync(join(MODULE_DIR, 'index.ts'), 'utf8');
    for (const module of GUARD_MODULES) expect(barrel.includes(module)).toBe(false);
  });

  it('INV-32 — every importer lives in `focused-path/`, and the list is named', () => {
    const importers = appSources()
      .filter((entry) => GUARD_MODULES.some((module) => entry.source.includes(`./${module}`)))
      .map((entry) => entry.path.split('\\').join('/'))
      .sort();

    // Named rather than counted: a new importer has to be added here, and
    // whoever adds it has to say it belongs inside the guard.
    expect(importers).toEqual([
      // `focusedPathSource.test.ts` is absent by design: it pins the module
      // *list* by reading the directory, and imports neither.
      'src/features/wizard/focused-path/stepMarkup.structure.test.ts',
      'src/features/wizard/focused-path/stepMarkupFingerprint.ts',
      'src/features/wizard/focused-path/stepMarkupGuard.test.ts',
      'src/features/wizard/focused-path/stepMarkupGuard.ts',
      // Added by SF-14 Tests, and the decision this list asks for is made
      // here rather than inherited. `stepMarkupSanction.sf14.test.ts` asserts
      // SF-14's own half of the handshake — that it declares exactly three
      // files, at `anchorDelta: 0`, adding nothing to `PERMITTED_NEW_PROPS`.
      // That is a claim about *SF-14's content*, which SF-15's machinery
      // tests cannot make and would happily accept a different answer for, so
      // it belongs beside the component change rather than inside SF-15's
      // suite. It reads the declaration and the sealed baseline and asserts
      // over them; it is inside `focused-path/`, adds no app-code reach into
      // the guard, and the barrel still re-exports neither module.
      'src/features/wizard/focused-path/stepMarkupSanction.sf14.test.ts',
      'src/features/wizard/focused-path/stepMarkupSanction.sf17.test.ts',
    ]);
  });

  it('INV-29 — neither module imports the copy package; the reason prose stays in source', () => {
    const sources = readScannedSources([
      'src/features/wizard/focused-path/stepMarkupGuard.ts',
      'src/features/wizard/focused-path/stepMarkupSanction.ts',
    ]);
    expect(findTokenAcross(sources, 'rwa-wizard-copy')).toEqual([]);
    expect(findTokenAcross(sources, 'useCopy')).toEqual([]);

    // D-9: the reasons are prose about this repo's own source, written by the
    // author of the change and read by a reviewer — not user-facing copy. They
    // live in the declaration, and that is the point being pinned.
    expect(PERMITTED_PROP_DECISIONS.every((decision) => decision.reason.length > 40)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// INV-19 / INV-24 — the sanctioned script, by scan and (N7) by behaviour.
// ---------------------------------------------------------------------------

const SCRIPT = 'scripts/supersede-step-markup.mjs';

describe('INV-19 / INV-24 — the sanctioned script has no path to the sealed baseline', () => {
  it('exactly one write call, and it is not on a line naming the baseline', () => {
    const sources = readScannedSources([SCRIPT]);
    expect(sources[0]!.raw.length).toBeGreaterThan(500);

    expect(findTokenAcross(sources, 'writeFileSync(')).toHaveLength(1);
    for (const call of ['appendFileSync(', 'rmSync(', 'renameSync(', 'createWriteStream(']) {
      expect(findTokenAcross(sources, call)).toEqual([]);
    }

    const writeLines = findTokenAcross(sources, 'writeFileSync(');
    expect(writeLines.filter((line) => line.includes('BASELINE'))).toEqual([]);
  });

  it('INV-24 — the script re-declares no glob of its own', () => {
    const sources = readScannedSources([SCRIPT]);
    expect(findTokenAcross(sources, 'src/features/wizard/steps/**')).toEqual([]);
    expect(findTokenAcross(sources, 'GUARDED_GLOBS')).toEqual([]);
  });

  /**
   * The seam N7 needs, pinned so it stays a seam. AS-1's target is a flag that
   * makes a refusal disappear; this one moves the root and every path under it
   * keeps a constant basename. One flag, and the test says so — a second one
   * cannot arrive quietly.
   */
  it('the script recognises exactly one argument, and it moves the root', () => {
    const sources = readScannedSources([SCRIPT]);
    expect(sources[0]!.stripped.match(/'--[a-z][a-z-]*'/g) ?? []).toEqual(["'--root'"]);
    // The write target's basename is a constant, not derived from the argument.
    expect(findTokenAcross(sources, 'stepMarkup.superseded.json')).toHaveLength(1);
  });

  it('INV-2 — the script never spreads the existing record into an entry', () => {
    const sources = readScannedSources([SCRIPT]);
    for (const token of ['...existing', '...prior', 'Object.assign']) {
      expect(findTokenAcross(sources, token)).toEqual([]);
    }
  });
});

/**
 * INV-28 — the spawn budget, asserted rather than described.
 *
 * The invariant's own test line asked for this scan and it was never written,
 * so the bound existed only in prose while the cost it guards is the reason
 * somebody eventually marks a file `.skip`. Eleven refusal cases written as
 * eleven script runs is the failure it names; this makes a fourth run cost an
 * edit here, with a sentence saying why the run has to be a run.
 */
describe('INV-28 — the suite spawns exactly the runs it can justify', () => {
  const UNIT_TESTS = [
    'src/features/wizard/focused-path/stepMarkupGuard.test.ts',
    'src/features/wizard/focused-path/stepMarkup.structure.test.ts',
    'src/features/wizard/focused-path/focusedPathSource.test.ts',
  ] as const;

  it('there are two spawn call sites in the unit, and four runs through them', () => {
    const sources = readScannedSources(UNIT_TESTS);
    expect(sources).toHaveLength(3);
    for (const source of sources) expect(source.stripped.length).toBeGreaterThan(1000);

    // The scan's own assertions name the tokens they look for, so its plumbing
    // lines match too — the self-reference this file's header describes, in the
    // one place a scan can be written to hide it. They are excluded by name
    // rather than by deleting the sentence that explains the rule.
    const plumbing = (line: string): boolean =>
      line.includes('findTokenAcross') || line.includes('import');

    // Two call sites: clause 3's `execFileSync` of the generator, and this
    // file's one `spawnSync` helper.
    const callSites = [
      ...findTokenAcross(sources, 'execFileSync('),
      ...findTokenAcross(sources, 'spawnSync('),
      ...findTokenAcross(sources, 'execSync('),
    ].filter((line) => !plumbing(line));
    expect(callSites).toHaveLength(2);

    // Three runs through the helper — the successful adoption, the refusing
    // re-run and the shipped command — plus clause 3's generator refusal, for
    // four in the unit. Each is a path no in-memory fixture can reach.
    const runs = findTokenAcross(sources, 'runSupersede(').filter(
      (line) => !plumbing(line) && !line.includes('function ')
    );
    expect(runs).toHaveLength(3);
  });
});

/**
 * The end-to-end runs. Three, and the reason for each is stated (INV-28).
 *
 * A refusing run and a successful run take different paths through the script,
 * and only the successful one was covered when this file arrived. That gap was
 * not theoretical: with the shipped declaration empty, **the refusing path is
 * the only path this repo can currently take**, and a mutation moving the single
 * write above the refusal guard — a partial adoption nobody approved, INV-25's
 * violation scenario exactly — passed all 196 tests.
 *
 * The seam moves the **root**, never a file name, so every path the script
 * derives keeps a constant basename and no value of it aims the writer at a
 * baseline. Both files it could reach are re-hashed after every run.
 */

/** One run of the sanctioned command, with both streams and the exit status. */
function runSupersede(args: readonly string[] = []): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync('pnpm', ['run', 'supersede:step-markup', '--', ...args], {
    cwd: APP_ROOT,
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

/**
 * The refusal codes a run printed, parsed from the stable machine line.
 *
 * Anchored, and the parsed *set* is what gets compared — never a substring of
 * the human detail beneath it (INV-10). The count of matched lines is returned
 * as the array itself, so a run that printed nothing is an empty array rather
 * than a silent pass.
 */
function printedCodes(stderr: string): readonly string[] {
  return [...stderr.matchAll(/^REFUSED ([A-Z_]+)$/gm)].map((match) => match[1]!);
}

function digestOf(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Neither stream may carry a refusal line — the successful path prints none. */
function refusedAnywhere(run: { stdout: string; stderr: string }): boolean {
  return /^REFUSED /m.test(run.stdout) || /^REFUSED /m.test(run.stderr);
}

const SOURCE_C = 'const a = <article className="a" />;';
const FP_C: FileFingerprint = fingerprintSource('a.tsx', SOURCE_C);

const ALPHA = 'src/components/shared/Alpha.tsx';
const WIDGET = 'src/components/shared/Widget.tsx';

/**
 * N7 — a successful adoption, then a refusing re-run over the same tree.
 *
 * **Two files, declared in the order a human would write them and not the order
 * they must land in.** One file cannot witness a sort: removing the writer's
 * `.sort()` entirely left every test green while the record held a single
 * entry, and SF-14 will declare three (INV-17).
 *
 * The prior record seeds `Widget` with mirrored fields that all *disagree* with
 * its declaration, so a successful run proves every field came from the
 * declaration rather than being carried forward from the record — INV-2's
 * behavioural half, driven by `MIRRORED_FIELDS` so a twelfth field is covered
 * the day it is added rather than the day somebody remembers this test.
 * `Alpha` has no prior entry, so both authority routes run in one spawn.
 */
describe('N7 — a successful supersede run writes the record and not the baseline', () => {
  let root = '';
  let paths = { baseline: '', record: '', alpha: '', widget: '' };
  let adoption: ReturnType<typeof runSupersede>;
  let baselineAfterAdoption = '';
  let recordAfterAdoption = '';

  const declarations = [
    declaration({
      file: WIDGET,
      authorisedBy: 'SF-15',
      decidedOn: '2026-08-31',
      components: ['Widget'],
    }),
    declaration({
      file: ALPHA,
      authorisedBy: 'SF-15',
      decidedOn: '2026-08-31',
      components: ['Alpha'],
    }),
  ] as const;

  function sanctionModule(decls: readonly MarkupSupersession[]): string {
    return `export const MARKUP_SUPERSESSIONS = ${JSON.stringify(decls, null, 2)};\n`;
  }

  beforeAll(() => {
    root = mkdtempSync(join(APP_ROOT, '.supersede-e2e-'));
    const guardDir = join(root, 'src/features/wizard/focused-path');
    const fixtures = join(guardDir, '__fixtures__');
    mkdirSync(fixtures, { recursive: true });
    mkdirSync(join(root, 'src/components/shared'), { recursive: true });

    paths = {
      baseline: join(fixtures, 'stepMarkup.baseline.json'),
      record: join(fixtures, 'stepMarkup.superseded.json'),
      alpha: join(root, ALPHA),
      widget: join(root, WIDGET),
    };

    writeFileSync(paths.alpha, SOURCE_B, 'utf8');
    writeFileSync(paths.widget, SOURCE_B, 'utf8');

    const syntheticBaseline: StepMarkupBaseline = {
      globs: ['src/components/shared/*.tsx'],
      fileCount: 2,
      files: { [ALPHA]: FP_A, [WIDGET]: FP_A },
    };
    writeFileSync(paths.baseline, `${JSON.stringify(syntheticBaseline, null, 2)}\n`, 'utf8');

    const stalePrior = {
      entries: [
        entry(
          declaration({
            file: WIDGET,
            authorisedBy: 'SF-01',
            decidedOn: '2020-01-01',
            reason: 'A prior reason that the successful run must not carry forward anywhere.',
            components: ['Stale'],
            anchorDelta: 7,
            introducesFirstAnchor: true,
          }),
          FP_A
        ),
      ],
    };
    writeFileSync(paths.record, `${JSON.stringify(stalePrior, null, 2)}\n`, 'utf8');
    writeFileSync(join(guardDir, 'stepMarkupSanction.ts'), sanctionModule(declarations), 'utf8');

    adoption = runSupersede(['--root', root]);
    baselineAfterAdoption = digestOf(paths.baseline);
    recordAfterAdoption = digestOf(paths.record);
  }, 120_000);

  afterAll(() => {
    if (root !== '') rmSync(root, { recursive: true, force: true });
  });

  it('succeeds, prints no refusal on either stream, and leaves the baseline byte-identical', () => {
    // The exit status is the assertion, and both streams are read. Checking
    // stdout alone for a refusal line cannot fail: refusals print to stderr.
    expect({ status: adoption.status, refused: refusedAnywhere(adoption) }).toEqual({
      status: 0,
      refused: false,
    });
    expect(printedCodes(adoption.stderr)).toEqual([]);
    expect(baselineAfterAdoption).toBe(digestOf(paths.baseline));
  });

  it('INV-17 — the entries are sorted by file, not left in declaration order', () => {
    const written = JSON.parse(readFileSync(paths.record, 'utf8')) as SupersededMarkupRecord;

    expect(declarations.map((d) => d.file)).toEqual([WIDGET, ALPHA]);
    expect(written.entries.map((e) => e.file)).toEqual([ALPHA, WIDGET]);

    // The bytes, not just the parse: 2-space indent and a trailing newline, so a
    // re-run with nothing changed cannot produce a diff (INV-17).
    const raw = readFileSync(paths.record, 'utf8');
    expect(raw.endsWith('}\n')).toBe(true);
    expect(raw.includes('\n  "entries": [')).toBe(true);
    expect(raw.indexOf('Alpha.tsx') < raw.indexOf('Widget.tsx')).toBe(true);
  });

  it('INV-2 — every mirrored field comes from the declaration, never from the record', () => {
    const written = JSON.parse(readFileSync(paths.record, 'utf8')) as SupersededMarkupRecord;

    for (const declared of declarations) {
      const found = written.entries.find((candidate) => candidate.file === declared.file);
      expect(found).toBeDefined();
      if (found === undefined) continue;
      for (const field of MIRRORED_FIELDS) {
        expect({ [field]: found[field] }).toEqual({ [field]: declared[field] });
      }
      expect(found.fingerprint).toEqual(FP_B);
    }
  });

  it('INV-27 — the stored adoption summary is the computed one, not a hand-written shape', () => {
    const written = JSON.parse(readFileSync(paths.record, 'utf8')) as SupersededMarkupRecord;
    const expected = summariseAdoption(FP_A, FP_B);

    // Non-trivial on this fixture — `div` becomes `section` — so a summary of
    // zeroes is a failure rather than an accident of the data.
    expect(expected).toEqual({
      elementsBefore: 1,
      elementsAfter: 1,
      tagsAdded: ['section'],
      tagsRemoved: ['div'],
      valuesChanged: 0,
    });
    for (const found of written.entries) expect(found.adopted).toEqual(expected);
  });

  /**
   * INV-25, and the reason this run exists.
   *
   * `Alpha`'s markup moves again while its `decidedOn` stays where it was, so
   * the run refuses `STALE_ADOPTION`. `Widget` is untouched and its declaration
   * still echoes the prior entry — that is carry-forward (SF-17), not
   * `NO_DIVERGENCE`. The entries the writer *would* have produced for `Alpha`
   * differ from the ones on disk — so a write that ran before the refusal guard
   * changes the file's bytes and this goes red.
   *
   * Both files the script can reach are re-hashed: a refusing run may write
   * neither.
   */
  it('INV-25 / INV-19 — a refusing re-run leaves both files byte-identical', () => {
    writeFileSync(paths.alpha, SOURCE_C, 'utf8');
    const refusing = runSupersede(['--root', root]);

    expect(refusing.status).toBe(1);
    // Only Alpha is stale; Widget carry-forwards. Sorted by file (INV-11).
    expect(printedCodes(refusing.stderr)).toEqual(['STALE_ADOPTION']);
    expect(digestOf(paths.record)).toBe(recordAfterAdoption);
    expect(digestOf(paths.baseline)).toBe(baselineAfterAdoption);

    // The refusing run adopted nothing: the record still holds `Alpha`'s
    // previous fingerprint, not the one it now has on disk.
    const written = JSON.parse(readFileSync(paths.record, 'utf8')) as SupersededMarkupRecord;
    expect(written.entries.find((e) => e.file === ALPHA)?.fingerprint).toEqual(FP_B);
    expect(FP_C).not.toEqual(FP_B);
  }, 120_000);
});

/**
 * N10 — the shipped command, against the real tree, exactly as documented.
 *
 * No seam, no synthetic root, nothing rewritten: `pnpm supersede:step-markup` as
 * a reader of `package.json` would run it today. Until the Tests stage no test
 * had ever executed it.
 *
 * **Its assertions are derived from the declaration, never hard-coded.** The
 * first version pinned `['EMPTY_DECLARATION']`, which was true of the shipped
 * state and false the moment SF-14 declared its three files — a test that had to
 * be edited by the next author to say what it already meant. The contract below
 * holds in every declaration state, and each state's extra assertions are
 * spelled out rather than skipped, so no branch is silently unasserted.
 */
describe('N10 — the shipped command never writes the seal, whatever it is asked to do', () => {
  it('runs, prints only real codes, and leaves the sealed baseline byte-identical', () => {
    const fixtures = join(MODULE_DIR, '__fixtures__');
    const baselinePath = join(fixtures, 'stepMarkup.baseline.json');
    const recordPath = join(fixtures, 'stepMarkup.superseded.json');

    const before = { baseline: digestOf(baselinePath), record: digestOf(recordPath) };
    const run = runSupersede();
    const codes = printedCodes(run.stderr);

    // 1. Whatever it printed is a pinned code — never prose, never an unknown
    //    string (INV-9, INV-10).
    const pinned: readonly string[] = SANCTION_REFUSAL_CODES;
    expect(codes.filter((code) => !pinned.includes(code))).toEqual([]);

    // 2. The seal survives every run, refusing or succeeding. This is the half
    //    that must never depend on what is declared (INV-19).
    expect(digestOf(baselinePath)).toBe(before.baseline);

    // 3. The run either succeeded or refused; a crash is neither.
    expect([0, 1]).toEqual(expect.arrayContaining([run.status]));

    if (run.status === 0) {
      // A successful run wrote the record, so the two halves must now agree —
      // the whole point of writing it (INV-1).
      expect(codes).toEqual([]);
      const parsed = parseSupersededRecord(readFileSync(recordPath, 'utf8'));
      expect('record' in parsed).toBe(true);
      if ('record' in parsed) {
        expect(checkTwoKeyAgreement(MARKUP_SUPERSESSIONS, parsed.record)).toEqual([]);
      }
      return;
    }

    // A refusing run adopted nothing: the record is byte-identical and no
    // success line was printed (INV-25).
    expect(codes.length).toBeGreaterThan(0);
    expect(digestOf(recordPath)).toBe(before.record);
    expect(run.stdout.includes('[supersede:step-markup]')).toBe(false);

    // The one state-specific assertion, and it is derived: with nothing
    // declared the only possible refusal is the set-level one, and it must be
    // exactly that — not merely among the codes printed.
    if (MARKUP_SUPERSESSIONS.length === 0) expect(codes).toEqual(['EMPTY_DECLARATION']);
  }, 120_000);
});
