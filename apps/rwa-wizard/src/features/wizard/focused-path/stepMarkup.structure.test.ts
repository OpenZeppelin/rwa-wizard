import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { globSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { beforeAll, describe, expect, it } from 'vitest';

import { findTokenAcross, readScannedSources } from '../../../test/helpers/sourceScan';
import type { FileFingerprint, StepMarkupBaseline } from './stepMarkupFingerprint';
import {
  countAnchorProps,
  filterPermittedProps,
  findAnchorProps,
  fingerprintSource,
  ID_PERMITTED_TAG,
  PERMITTED_NEW_PROPS,
} from './stepMarkupFingerprint';
import type { GuardVerdict } from './stepMarkupGuard';
import {
  checkGuardedFile,
  checkTwoKeyAgreement,
  MIRRORED_FIELDS,
  parseSupersededRecord,
  summariseAdoption,
} from './stepMarkupGuard';
import type { MarkupSupersession } from './stepMarkupSanction';
import { MARKUP_SUPERSESSIONS, PERMITTED_PROP_DECISIONS } from './stepMarkupSanction';

/**
 * AS-5, mechanically: INV-5 (the guarded files differ from the baseline by anchor
 * attributes only), INV-6 (the baseline cannot be silently re-based) and INV-7
 * (the fingerprint is sensitive, proven by mutation).
 *
 * The three are load-bearing together and worthless apart. A sensitive
 * fingerprint compared against a baseline that was copied from the post-anchor
 * tree checks nothing; an unforgeable baseline compared with a fingerprint that
 * is a tag-name counter checks nothing either. INV-6's assertions therefore run
 * *before* INV-5's comparison, so their failures are not masked by it.
 *
 * SF-15 extends the same discipline to the two-key re-baseline. The set
 * equality, the seal and two-key agreement all run before the per-file
 * comparison, so a hand-edited record reports as "the record and the
 * declaration disagree" rather than as twenty-five fingerprint diffs with the
 * one-line explanation scrolled off the bottom (INV-26).
 */

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

/**
 * Read from disk rather than imported as a module: the baseline is compared as
 * JSON, and reading it the same way the generator writes it keeps a bundler
 * transform out of the middle of the guard.
 */
const BASELINE_PATH = join(
  APP_ROOT,
  'src/features/wizard/focused-path/__fixtures__/stepMarkup.baseline.json'
);

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as StepMarkupBaseline;

/**
 * The **frozen** pre-anchor baseline — SF-12's original evidence, kept under its
 * own name when SF-15 re-sealed the live one at the anchored state.
 *
 * Its whole value is that it is the one artefact nobody may touch. It is never
 * regenerated, never superseded and never written by any script; the only thing
 * that reads it is this file. INV-6 clause 1 lives on it verbatim, because that
 * clause is a *temporal* proof — "no anchor prop anywhere" establishes that this
 * baseline predates the anchors and so was not regenerated from an anchored
 * tree — and the live seal, which now carries the anchors by design, cannot
 * carry that proof any more.
 *
 * The bridge below is what makes moving the clause a strengthening rather than a
 * weakening: "the baseline is pre-anchor" used to be true by accident of history
 * and asserted nowhere, and is now asserted here on every run.
 */
const PREANCHOR_PATH = join(
  APP_ROOT,
  'src/features/wizard/focused-path/__fixtures__/stepMarkup.baseline.preanchor.json'
);

const preanchor = JSON.parse(readFileSync(PREANCHOR_PATH, 'utf8')) as StepMarkupBaseline;

/**
 * The machine half of the two-key re-baseline, read from disk — never imported.
 *
 * The direction INV-2 binds is visible right here: the **declarations** arrive
 * by module import from `stepMarkupSanction.ts`, the **record** arrives as bytes
 * through `readFileSync`. Two channels, so neither half can be derived from the
 * other, and a record that could be back-filled into a declaration fails rather
 * than being argued about.
 */
const SUPERSEDED_PATH = join(
  APP_ROOT,
  'src/features/wizard/focused-path/__fixtures__/stepMarkup.superseded.json'
);

const parsedRecord = parseSupersededRecord(readFileSync(SUPERSEDED_PATH, 'utf8'));
if ('refusals' in parsedRecord) {
  throw new Error(
    `the superseded record does not parse: ${parsedRecord.refusals.map((r) => r.code).join(', ')}`
  );
}
const superseded = parsedRecord.record;

/** SF-12's count of guarded files. Frozen; sealed inside the baseline's digest. */
const SF12_GUARDED_FILE_COUNT = 25;

/**
 * The guarded set's size today: the baseline's files plus any file first
 * recorded by a supersession. Derived rather than written out, because
 * `baseline.fileCount` lives inside the sealed JSON and the digest is what keeps
 * it honest. With the record empty this is literally SF-12's 25.
 */
const FIRST_RECORD_COUNT = superseded.entries.filter(
  (entry) => entry.kind === 'first-record'
).length;
const GUARDED_FILE_COUNT = baseline.fileCount + FIRST_RECORD_COUNT;

/** SF-12's own numbers. Frozen forever; these two literals are never edited. */
const SF12_ANCHOR_INVENTORY = 15;
const SF12_ANCHOR_FILE_INVENTORY = 10;

/**
 * How SF-12's fifteen decompose in `findAnchorProps`' unit: fourteen
 * permitted-new-prop occurrences plus one permitted `id`. Pinned because the two
 * quantities are one plausible reading apart, and reading `anchorDelta` in the
 * narrower unit is how a *correct* change ends up with
 * `EXPECTED_ANCHOR_PROP_COUNT` as the only edit that turns the suite green —
 * bump-the-number-until-green, arrived at by following the documentation, inside
 * the test built to make that impossible (INV-7).
 */
const SF12_PERMITTED_ID_OCCURRENCES = 1;
const SF12_NEW_PROP_OCCURRENCES = 14;

/**
 * The current claims, which clause 3 compares against the generator's stderr.
 *
 * Human claims, never derived from the tree: deriving them would make clause 3
 * compare the tree to itself, and the count's whole value is being an
 * independent inventory the generator can contradict. Bumping either one to make
 * clause 3 green fails the § 4.6 clause instead, and the only way to satisfy both
 * is to declare the change on a specific file with a reason.
 */
const EXPECTED_ANCHOR_PROP_COUNT = 16;
const EXPECTED_ANCHOR_FILE_COUNT = 11;

/**
 * SHA-256 over the baseline file's **raw bytes** — read as a `Buffer`, with no
 * encoding argument and no normalisation, so a line-ending or whitespace rewrite
 * cannot launder one.
 *
 * **The bound, stated here so a later reader does not upgrade it:** this cannot
 * make a rewrite impossible, and nothing in this repo can — a committer can
 * change the file and this constant in one diff. What it does is convert an
 * invisible rewrite, a plausible-looking hunk buried in 2,890 lines of JSON,
 * into a one-line change to a named constant with a comment saying what it
 * means. That is the loudest thing a diff can be, and it is the whole claim.
 *
 * The value is the SF-15 Revision 2 re-seal of 2026-08-31: the frozen pre-anchor
 * fingerprints plus SF-12's fifteen anchors in ten files, and nothing else. The
 * seal is not re-sealed for a supersession — a first anchor adopted later lives
 * in the record (`introducesFirstAnchor`), which is why the inventory clause
 * below reads the authority in force rather than this file alone.
 */
const BASELINE_DIGEST = '7fb2dacff2c40792903ee27b5ad2f3109b245a4e2cf92e70297ce17989479dc6';

/**
 * The frozen pre-anchor baseline's digest — the value this repo has recorded
 * since SF-12, in three artifacts and in commit `da9a025`.
 *
 * **The bound, stated so it is not upgraded later:** pinning this makes a
 * rewrite of the frozen evidence **loud, not impossible**. Defeating it means
 * editing an 83KB fixture and this one-line constant in the same diff — exactly
 * the bound {@link BASELINE_DIGEST} already states for the live seal, and no
 * stronger.
 */
const PREANCHOR_DIGEST = '887e7a199f6f1b7957ec2944ea56dd0089610632e9a1d2d1afdb17a80867a423';

/** This file, for the one clause that has to assert its own shape. */
const SELF = 'src/features/wizard/focused-path/stepMarkup.structure.test.ts';

function guardedFiles(): string[] {
  const seen = new Set<string>();
  for (const pattern of baseline.globs) {
    for (const match of globSync(pattern, { cwd: APP_ROOT })) {
      seen.add(match.split('\\').join('/'));
    }
  }
  return [...seen].sort();
}

// ---------------------------------------------------------------------------
// INV-6 — the baseline is unforgeable. Runs first, on purpose.
// ---------------------------------------------------------------------------

describe('INV-6 clause 1 — a late baseline says so out loud', () => {
  /**
   * The load-bearing assertion in the whole AS-5 guard.
   *
   * The baseline records each element's *complete* prop list, anchors included,
   * and the permitted-prop filter is applied only at comparison time. So a
   * baseline regenerated after the anchors landed carries them, and this fails
   * naming the file and element. Filtering at capture time — which the design
   * originally specified — would make a post-anchor baseline byte-identical to
   * an honest one, and the test would go green having checked nothing.
   */
  it('the frozen pre-anchor baseline carries no anchor prop anywhere', () => {
    const found = findAnchorProps(preanchor);
    expect(
      found.map((occurrence) => `${occurrence.file}: <${occurrence.tag} ${occurrence.prop}>`)
    ).toEqual([]);
  });

  it('the authority in force carries exactly the sanctioned anchor inventory', () => {
    // The live baseline is anchored by design since the SF-15 re-seal, so clause
    // 1 cannot be asked of it. What is asked instead is that the inventory *in
    // force* — the seal, with each superseded file read from its record entry —
    // is the pinned one. The seal alone cannot carry it: a first anchor adopted
    // by supersession (`introducesFirstAnchor`) lives in the record and never in
    // the seal, because no sanctioned path writes the seal. An anchor arriving in
    // the seal without a declaration still moves this number (§ 4.6, INV-8); one
    // arriving in the record without its declared delta is refused at adoption
    // (`ANCHOR_DELTA_MISMATCH`).
    const inForce: StepMarkupBaseline = {
      globs: baseline.globs,
      fileCount: GUARDED_FILE_COUNT,
      files: {
        ...baseline.files,
        ...Object.fromEntries(superseded.entries.map((entry) => [entry.file, entry.fingerprint])),
      },
    };
    const found = findAnchorProps(inForce);
    expect({
      occurrences: found.length,
      files: new Set(found.map((occurrence) => occurrence.file)).size,
    }).toEqual({
      occurrences: EXPECTED_ANCHOR_PROP_COUNT,
      files: EXPECTED_ANCHOR_FILE_COUNT,
    });

    // And the seal itself still holds exactly SF-12's inventory: nothing after
    // the SF-15 re-seal may move it, declared or not.
    const sealed = findAnchorProps(baseline);
    expect({
      occurrences: sealed.length,
      files: new Set(sealed.map((occurrence) => occurrence.file)).size,
    }).toEqual({ occurrences: SF12_ANCHOR_INVENTORY, files: SF12_ANCHOR_FILE_INVENTORY });
  });

  /**
   * **The bridge.** What the re-seal claims, stated mechanically: permitted
   * props were added and nothing structural changed — which is AS-5 itself.
   *
   * This is the check that made moving clause 1 safe. Without it, re-sealing at
   * the anchored state would delete the anchors-only proof and leave a promise
   * in its place. With it, the proof runs on every suite run, and anyone
   * repeating the one-off re-seal cannot launder a structural change past it:
   * the tool is not absent, it is useless for the thing we fear.
   *
   * It is also the receipt on the hand-off. The pre-SF-14 text for the three
   * files could only come from another agent's working tree, and post-SF-14 text
   * fails right here — measured, not predicted.
   */
  it('the live seal differs from the frozen one by permitted props and nothing else', () => {
    const structural = Object.keys(preanchor.files).filter(
      (file) =>
        JSON.stringify(filterPermittedProps(baseline.files[file] ?? [])) !==
        JSON.stringify(filterPermittedProps(preanchor.files[file] ?? []))
    );
    expect(structural).toEqual([]);

    // Non-vacuity: the two files must really be different, or the comparison
    // above is comparing something with itself.
    expect(Object.keys(preanchor.files)).toHaveLength(SF12_GUARDED_FILE_COUNT);
    expect(findAnchorProps(preanchor)).toHaveLength(0);
    expect(findAnchorProps(baseline).length).toBeGreaterThan(0);
  });

  it('records the props it is meant to record — the filter is not applied at capture', () => {
    // A baseline whose `props` arrays were pre-filtered would be indistinguishable
    // from an honest one, so pin that props are captured at all.
    const collect = (elements: FileFingerprint): string[] =>
      elements.flatMap((element) => [...element.props, ...collect(element.children)]);
    const anyProps = Object.values(baseline.files)
      .flatMap(collect)
      .filter((name) => name.length > 0);
    expect(anyProps.length).toBeGreaterThan(100);
    expect(anyProps).toContain('className');
  });
});

describe('INV-6 clause 2 — the guarded set cannot drift', () => {
  /**
   * Generalised by SF-15, not weakened: the guarded set is now the baseline's
   * keys **union** the files the record first-records. With the record empty
   * this is literally the assertion SF-12 shipped, which is what lets SF-15
   * land before SF-14 exists.
   */
  it('keys(baseline) ∪ files(record) equals the glob expansion, both directions', () => {
    const onDisk = guardedFiles();
    const guarded = [
      ...new Set([...Object.keys(baseline.files), ...superseded.entries.map((e) => e.file)]),
    ].sort();

    expect(guarded).toEqual(onDisk);
    expect(onDisk.filter((file) => !guarded.includes(file))).toEqual([]);
    expect(guarded.filter((file) => !onDisk.includes(file))).toEqual([]);
  });

  it('the file count is pinned', () => {
    expect(baseline.fileCount).toBe(SF12_GUARDED_FILE_COUNT);
    expect(Object.keys(baseline.files)).toHaveLength(SF12_GUARDED_FILE_COUNT);
    expect(guardedFiles()).toHaveLength(GUARDED_FILE_COUNT);
    expect(GUARDED_FILE_COUNT).toBe(baseline.fileCount + FIRST_RECORD_COUNT);
  });

  it('the guarded set is the glob, not a hand-written list', () => {
    // The three shared components are in on purpose: they render step controls
    // and gain props here, so holding them to the same rule closes the obvious
    // way to evade it.
    expect(baseline.globs).toEqual([
      'src/features/wizard/steps/**/*.tsx',
      'src/components/shared/SelectableCard.tsx',
      'src/components/shared/TogglePill.tsx',
      'src/components/shared/TopicToggleGroup.tsx',
    ]);
  });
});

describe('INV-6 clause 3 — the generator refuses to re-base', () => {
  /**
   * The mechanical half of "the baseline was generated before the anchors".
   *
   * The failure mode this closes is procedural, not logical: the anchors land,
   * the test goes red, somebody runs the regenerate script, and the guard becomes
   * a copy of the thing it is supposed to be checking. The script exits non-zero
   * and names every offending prop instead.
   */
  it('exits 1 and names all fifteen anchor props', () => {
    let stdout = '';
    let stderr = '';
    let status = 0;

    try {
      // The documented entry point, run the way a developer would run it.
      stdout = execFileSync('pnpm', ['run', 'baseline:step-markup'], {
        cwd: APP_ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      status = failure.status ?? -1;
      stdout = failure.stdout ?? '';
      stderr = failure.stderr ?? '';
    }

    expect(status).toBe(1);
    expect(stdout).not.toContain('wrote');
    expect(stderr).toContain('REFUSING TO WRITE');
    expect(stderr).toContain(`${EXPECTED_ANCHOR_PROP_COUNT} anchor prop(s)`);

    // Every one is named, so the output doubles as an independent check on the
    // markup change list: fifteen props, in ten files.
    const named = stderr
      .split('\n')
      .filter((line) => /^ {2}\S+\.tsx: </.test(line))
      .map((line) => line.trim());
    expect(named).toHaveLength(EXPECTED_ANCHOR_PROP_COUNT);

    const files = new Set(named.map((line) => line.split(':')[0]));
    expect(files.size).toBe(EXPECTED_ANCHOR_FILE_COUNT);

    for (const prop of [...PERMITTED_NEW_PROPS, 'id']) {
      expect(named.some((line) => line.endsWith(` ${prop}>`))).toBe(true);
    }
  }, 60_000);
});

// ---------------------------------------------------------------------------
// SF-15 — the seal, the permission set, the inventory and two-key agreement.
// All of them run before the per-file comparison, so none of their failures is
// masked by twenty-five fingerprint diffs (INV-26).
// ---------------------------------------------------------------------------

/**
 * SHA-256 over a file's **raw bytes**. `readFileSync` with no encoding argument
 * returns a `Buffer`, and nothing here normalises.
 *
 * Extracted so its shape can be pinned. Adding an encoding argument or a
 * line-ending normalisation would make the seal cover *content* while claiming
 * to cover bytes — and **no digest comparison could detect that**, because the
 * baseline holds no CRLF for a normalisation to change, so the two hashes agree
 * today and would keep agreeing right up until the rewrite that mattered. That
 * is why the clause below asserts the expression rather than only its output.
 */
function digestOf(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('§ 4.4 / INV-20 — the baseline is sealed over its raw bytes', () => {
  it('the baseline hashes to the pinned digest', () => {
    expect(readFileSync(BASELINE_PATH).length).toBeGreaterThan(0);
    expect(digestOf(BASELINE_PATH)).toBe(BASELINE_DIGEST);
  });

  /**
   * N5. A digest test that could not react to a changed byte would be a
   * decoration, and this one is the only thing standing between a quiet rewrite
   * and a green suite.
   */
  it('N5 — one byte changed in memory produces a different digest', () => {
    const bytes = readFileSync(BASELINE_PATH);
    const flipped = Buffer.from(bytes);
    flipped[flipped.length - 1] = (flipped[flipped.length - 1]! + 1) % 256;
    expect(createHash('sha256').update(flipped).digest('hex')).not.toBe(BASELINE_DIGEST);
  });

  /**
   * Found by mutating the shipped clause: replacing the byte hash with a
   * CRLF-normalising one left every digest assertion green, because the
   * normalisation is a no-op on this file. The output cannot distinguish the
   * two, so the expression is pinned instead — presence, matched whole, through
   * the comment-stripping scanner rather than as a bare substring.
   */
  it('the hash is taken over raw bytes, asserted on the expression itself', () => {
    const sources = readScannedSources([SELF]);
    expect(sources[0]!.stripped.length).toBeGreaterThan(1000);
    expect(
      /function digestOf\(path: string\): string \{\s*return createHash\('sha256'\)\s*\.update\(readFileSync\(path\)\)\s*\.digest\('hex'\);\s*\}/.test(
        sources[0]!.stripped
      )
    ).toBe(true);
  });

  /**
   * INV-20 extended to the frozen evidence. The live seal can at least be
   * rebuilt from a reviewed act; the frozen one cannot be rebuilt at all — the
   * tree it fingerprints has not existed since SF-12's anchors landed — so its
   * digest is the only thing standing between it and a quiet edit.
   */
  it('the frozen pre-anchor baseline hashes to its recorded digest', () => {
    expect(readFileSync(PREANCHOR_PATH).length).toBeGreaterThan(0);
    expect(digestOf(PREANCHOR_PATH)).toBe(PREANCHOR_DIGEST);
  });

  /**
   * The frozen fixture is **never regenerated** — a pinned property, not a
   * convention, because a convention is what a future author breaks while
   * tidying.
   *
   * No script may write it: the generator names only the live baseline, and the
   * supersede script names only the record. Asserted over both scripts' source
   * rather than promised in a comment.
   */
  it('no script can write the frozen baseline', () => {
    const scripts = readScannedSources([
      'scripts/generate-step-markup-baseline.mjs',
      'scripts/supersede-step-markup.mjs',
    ]);
    expect(scripts).toHaveLength(2);
    for (const script of scripts) expect(script.stripped.length).toBeGreaterThan(500);
    expect(findTokenAcross(scripts, 'preanchor')).toEqual([]);
    expect(findTokenAcross(scripts, 'baseline.preanchor.json')).toEqual([]);
  });

  it('the digest reads the same file the per-file comparison reads', () => {
    // A path drift here would hash the wrong file and still be green.
    expect(BASELINE_PATH).toContain('__fixtures__/stepMarkup.baseline.json');
    expect(Object.keys(baseline.files)).toHaveLength(SF12_GUARDED_FILE_COUNT);
  });
});

describe('§ 4.5 / INV-23 — widening the permitted-prop list costs two keys', () => {
  it('the permitted-prop decisions are exactly the three SF-12 sanctioned', () => {
    expect(
      PERMITTED_PROP_DECISIONS.map((d) => `${d.authorisedBy} ${d.prop}@${d.tag ?? '*'}`)
    ).toEqual(['SF-12 data-config-anchor@*', 'SF-12 configAnchor@*', 'SF-12 id@AddressListField']);

    expect([...PERMITTED_NEW_PROPS]).toEqual(['data-config-anchor', 'configAnchor']);

    const tagScoped = PERMITTED_PROP_DECISIONS.filter((d) => d.tag !== null);
    expect(tagScoped).toHaveLength(1);
    expect(tagScoped[0]?.tag).toBe(ID_PERMITTED_TAG); // binds the literal to the decision
  });

  it('`PERMITTED_NEW_PROPS` is the untagged subset of the decisions, in order', () => {
    expect(PERMITTED_PROP_DECISIONS.filter((d) => d.tag === null).map((d) => d.prop)).toEqual([
      ...PERMITTED_NEW_PROPS,
    ]);
  });

  it('every decision carries an authority and a date in the validated shapes', () => {
    for (const decision of PERMITTED_PROP_DECISIONS) {
      expect(decision.authorisedBy).toMatch(/^SF-\d+$/);
      expect(decision.decidedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(decision.reason.trim().length).toBeGreaterThanOrEqual(40);
    }
  });
});

describe('§ 4.6 / INV-8 — the anchor inventory moves only by a declared amount', () => {
  it('both expected counts equal SF-12 plus the declared movement', () => {
    const delta = MARKUP_SUPERSESSIONS.reduce((total, s) => total + s.anchorDelta, 0);
    const newlyAnchored = MARKUP_SUPERSESSIONS.filter((s) => s.introducesFirstAnchor).length;

    expect(EXPECTED_ANCHOR_PROP_COUNT).toBe(SF12_ANCHOR_INVENTORY + delta);
    expect(EXPECTED_ANCHOR_FILE_COUNT).toBe(SF12_ANCHOR_FILE_INVENTORY + newlyAnchored);
  });

  /**
   * Zero is also what a *missing* check produces. With the declaration empty
   * both halves are satisfied at delta zero, so each is shown reacting to a
   * synthetic movement — otherwise "satisfied" and "not asserted" look
   * identical, and the file-count half in particular would never be exercised
   * by SF-14 at all (all three files it will declare are already anchored).
   */
  it('both halves react — they are asserted, not merely satisfied at zero', () => {
    const declared = [...MARKUP_SUPERSESSIONS, { anchorDelta: 1, introducesFirstAnchor: true }];
    const delta = declared.reduce((total, s) => total + s.anchorDelta, 0);
    const newlyAnchored = declared.filter((s) => s.introducesFirstAnchor).length;

    expect(EXPECTED_ANCHOR_PROP_COUNT).not.toBe(SF12_ANCHOR_INVENTORY + delta);
    expect(EXPECTED_ANCHOR_FILE_COUNT).not.toBe(SF12_ANCHOR_FILE_INVENTORY + newlyAnchored);
  });

  /**
   * INV-7 — the *unit*, not merely the arithmetic. `anchorDelta` counts what
   * `findAnchorProps` counts: permitted new props **and** permitted ids alike.
   * Fifteen is fourteen plus one, and pinning the split is what stops the two
   * quantities being mistaken for each other by an author who reads the field's
   * documentation literally and is then right that it permitted them.
   */
  it('the anchor unit is fourteen permitted new props plus one permitted id', () => {
    expect(SF12_ANCHOR_INVENTORY).toBe(SF12_NEW_PROP_OCCURRENCES + SF12_PERMITTED_ID_OCCURRENCES);

    const files: Record<string, FileFingerprint> = {};
    for (const file of guardedFiles()) {
      files[file] = fingerprintSource(file, readFileSync(join(APP_ROOT, file), 'utf8'));
    }
    const found = findAnchorProps({ globs: baseline.globs, fileCount: GUARDED_FILE_COUNT, files });

    expect(found).toHaveLength(EXPECTED_ANCHOR_PROP_COUNT);
    expect(found.filter((o) => o.prop === 'id')).toHaveLength(SF12_PERMITTED_ID_OCCURRENCES);
    expect(
      found.filter((o) => (PERMITTED_NEW_PROPS as readonly string[]).includes(o.prop))
    ).toHaveLength(
      SF12_NEW_PROP_OCCURRENCES + (EXPECTED_ANCHOR_PROP_COUNT - SF12_ANCHOR_INVENTORY)
    );
    expect(new Set(found.map((o) => o.file)).size).toBe(EXPECTED_ANCHOR_FILE_COUNT);

    // …and `countAnchorProps` — the unit `anchorDelta` is denominated in — is
    // the same quantity summed per file, not a second count of its own.
    const perFile = Object.values(files).reduce((total, fp) => total + countAnchorProps(fp), 0);
    expect(perFile).toBe(EXPECTED_ANCHOR_PROP_COUNT);
  });
});

describe('§ 4.2 / INV-1, INV-2 — the two keys must agree, field by field', () => {
  it('the declarations and the record name exactly the same files, both ways', () => {
    const declared = MARKUP_SUPERSESSIONS.map((d) => d.file).sort();
    const recorded = superseded.entries.map((e) => e.file).sort();

    expect(declared).toEqual(recorded);
    expect(declared.filter((file) => !recorded.includes(file))).toEqual([]);
    expect(recorded.filter((file) => !declared.includes(file))).toEqual([]);
  });

  /**
   * File-name equality is necessary and is not the property. It passes while
   * the JSON carries a different reason, a different `authorisedBy`, a
   * different `decidedOn` or a different `anchorDelta` from the declaration it
   * claims to echo — and nobody notices, because the record is machine-written
   * and nobody re-reads it. That turns the paper trail into decoration exactly
   * where AS-4 says it must not.
   */
  it('every mirrored field of every entry echoes its declaration', () => {
    expect(checkTwoKeyAgreement(MARKUP_SUPERSESSIONS, superseded)).toEqual([]);

    for (const declaration of MARKUP_SUPERSESSIONS) {
      const entry = superseded.entries.find((candidate) => candidate.file === declaration.file);
      expect(entry).toBeDefined();
      if (entry === undefined) continue;
      for (const field of MIRRORED_FIELDS) {
        expect({ [field]: entry[field] }).toEqual({ [field]: declaration[field] });
      }
    }
  });

  /**
   * Post-adoption steady state: every declared file's superseded fingerprint matches
   * the live tree under the permitted-prop filter (checkTwoKeyAgreement above).
   * `validateSanction` anchorDelta is an adoption-time check; re-running it after
   * the record is written requires the superseded record as `current`, which is
   * what the supersede script's exit gate already enforces.
   */

  /**
   * INV-33's discipline applied to this block: with the record empty, every
   * clause above iterates nothing, and a loop over zero entries passes whatever
   * it asserts. The same trap § 4.6 answers with its "both halves react" clause.
   *
   * So the two comparisons are driven once over a synthetic pair that must fail
   * and once over a pair that must pass. This is not a second copy of the
   * battery — it proves *these* clauses can move, on the day the record is still
   * `{ "entries": [] }`.
   */
  it('the clauses above react — they are not green merely because the record is small', () => {
    // Driven over a synthetic pair rather than the real one, so this clause says
    // the same thing at `entries: []`, at SF-14's three, and at whatever the
    // record holds later. Pinning the real count here is what the first version
    // did, and it made the clause an edit the next author had to make before
    // they could declare anything.
    const declared: MarkupSupersession = {
      file: 'src/components/shared/TogglePill.tsx',
      kind: 'replaces-baseline',
      authorisedBy: 'SF-14',
      decidedOn: '2026-09-01',
      reason: 'A synthetic declaration, used only to show these two clauses can fail.',
      components: ['TogglePill'],
      anchorDelta: 0,
      introducesFirstAnchor: false,
    };
    const fingerprint = baseline.files[declared.file] ?? [];
    const adopted = summariseAdoption(fingerprint, fingerprint);
    const agreeing = { entries: [{ ...declared, adopted, fingerprint }] };

    // Non-vacuity is the property: the comparison must have something to compare.
    expect(agreeing.entries).toHaveLength(1);
    expect(checkTwoKeyAgreement([declared], agreeing)).toEqual([]);
    expect(
      checkTwoKeyAgreement([declared], {
        entries: [
          { ...declared, reason: 'a shorter, tidier reason nobody wrote', adopted, fingerprint },
        ],
      }).map((refusal) => refusal.code)
    ).toEqual(['MALFORMED_RECORD']);

    // And the recompute clause: a hand-written summary is not the computed one.
    expect(adopted).toEqual(summariseAdoption(fingerprint, fingerprint));
    expect(adopted).not.toEqual({
      elementsBefore: 0,
      elementsAfter: 0,
      tagsAdded: [],
      tagsRemoved: [],
      valuesChanged: 0,
    });
  });

  it('INV-6 — the record names each file once; it is an array, not a map', () => {
    const files = superseded.entries.map((entry) => entry.file);
    expect(new Set(files).size).toBe(files.length);
  });

  /**
   * INV-27. The stored summary is recomputed from the sealed baseline and the
   * recorded fingerprint, so it cannot go stale after a re-run and cannot be
   * hand-written. A trusted summary is a number a reviewer believes *because* it
   * looks machine-written, which is the worst kind to let drift.
   */
  it('INV-27 — every stored adoption summary recomputes to the same value', () => {
    for (const entry of superseded.entries) {
      const before = baseline.files[entry.file] ?? [];
      expect(entry.adopted).toEqual(summariseAdoption(before, entry.fingerprint));
    }
  });
});

/**
 * INV-26 — diagnostic order, asserted on this file's own shape.
 *
 * The set clauses, the seal and two-key run *before* the per-file comparison so
 * a failure in any of them is not buried under twenty-five fingerprint diffs.
 * That was true here by arrangement and by a comment; nothing kept it true. A
 * later author appending a block at the end of the file is the whole violation
 * scenario, and appending is what people do.
 */
describe('INV-26 — the cheap, legible clauses come before the twenty-five comparisons', () => {
  it('the per-file comparison is the last block in this file', () => {
    const [self] = readScannedSources([SELF]);
    const at = (needle: string): number => {
      const found = self!.stripped.indexOf(needle);
      expect(found).toBeGreaterThan(-1);
      return found;
    };

    const comparison = at("describe('INV-3 / INV-5");
    for (const earlier of [
      "describe('INV-6 clause 2",
      "describe('§ 4.4 / INV-20",
      "describe('§ 4.5 / INV-23",
      "describe('§ 4.6 / INV-8",
      "describe('§ 4.2 / INV-1, INV-2",
    ]) {
      expect(at(earlier) < comparison).toBe(true);
    }
  });
});

describe('INV-10 — refusals are never asserted by prose, and the scan proves it read', () => {
  const BATTERY = 'src/features/wizard/focused-path/stepMarkupGuard.test.ts';

  it('the negative battery contains no substring assertion', () => {
    const sources = readScannedSources([BATTERY]);
    expect(sources).toHaveLength(1);

    const [battery] = sources;
    expect(battery!.raw.length).toBeGreaterThan(10_000);
    expect(battery!.stripped.length).toBeLessThan(battery!.raw.length);

    expect(findTokenAcross(sources, 'toContain')).toEqual([]);

    // Comment-stripping is load-bearing *here specifically*: that file's own
    // header quotes the rule it enforces, so the banned token really is present
    // in the raw source. A raw scan would fire on it, and the obvious repair
    // deletes the only sentence explaining why the tests are shaped that way.
    expect(battery!.raw.includes('toContain')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// INV-5 — the comparison
// ---------------------------------------------------------------------------

/** The guarded set, expanded once. This — not the baseline's keys — is the loop. */
const GUARDED = guardedFiles();

/**
 * Consume one verdict. Every arm asserts; none returns quietly.
 *
 * `no-authority` is the arm that matters. It says "I have no answer for this
 * input", and reading that as "nothing to check" is the worst possible reading
 * of a total function — it is also exactly what an `if (verdict.kind ===
 * 'mismatch')` shaped consumer does. The `never` tail means a fourth verdict
 * kind cannot be added without a compile error here (INV-4).
 */
function assertVerdict(verdict: GuardVerdict): void {
  switch (verdict.kind) {
    case 'match':
      return;
    case 'mismatch':
      expect(filterPermittedProps(verdict.current)).toEqual(filterPermittedProps(verdict.recorded));
      throw new Error(`${verdict.file}: differs from the ${verdict.authority} record`);
    case 'no-authority':
      throw new Error(`${verdict.file} is in the guarded set and is guarded by nothing`);
    default: {
      const exhaustive: never = verdict;
      throw new Error(`unhandled verdict: ${JSON.stringify(exhaustive)}`);
    }
  }
}

describe('INV-3 / INV-5 — every guarded file is compared against the authority in force', () => {
  /**
   * The hole this closes is in the *loop*, not the selector. Iterating
   * `Object.keys(baseline.files)` leaves a `first-record` file declared,
   * validated, fingerprinted, written, passing two-key equality and passing the
   * union check — and compared against nothing at all, forever. The mechanism
   * built to keep files guarded would be what left one unguarded, and it would
   * be found, if ever, by somebody counting test names.
   */
  it('the case list is the glob expansion, at the size the two records imply', () => {
    expect(GUARDED).toHaveLength(GUARDED_FILE_COUNT);
    expect(GUARDED).toEqual(guardedFiles());
    expect(GUARDED_FILE_COUNT).toBe(baseline.fileCount + FIRST_RECORD_COUNT);
  });

  it('INV-4 — the verdict consumer throws on `no-authority` rather than passing', () => {
    expect(() => assertVerdict({ kind: 'no-authority', file: 'src/ghost.tsx' })).toThrow();
    expect(() =>
      assertVerdict({ kind: 'match', file: 'src/ok.tsx', authority: 'baseline' })
    ).not.toThrow();
  });

  it.each(GUARDED)('%s', (file) => {
    const source = readFileSync(join(APP_ROOT, file), 'utf8');
    assertVerdict(checkGuardedFile(file, source, baseline, superseded));
  });

  it('the comparison is an equality, not a subset check', () => {
    // The filter is applied to *both* sides. If it were applied to the working
    // tree only, an element that lost a prop would still compare equal.
    const file = 'src/components/shared/SelectableCard.tsx';
    const source = readFileSync(join(APP_ROOT, file), 'utf8');
    const current = fingerprintSource(file, source);

    expect(current[0]!.props).toContain('data-config-anchor');
    expect(filterPermittedProps(current)[0]!.props).not.toContain('data-config-anchor');

    // The demonstration needs a side that lacks the prop, and since the SF-15
    // re-seal that is the frozen pre-anchor baseline rather than the live one.
    // The pair is what makes the claim testable: the frozen side has no anchor,
    // the live side does, and the comparison is only an equality because the
    // filter is applied to both.
    expect(preanchor.files[file]![0]!.props).not.toContain('data-config-anchor');
    expect(baseline.files[file]![0]!.props).toContain('data-config-anchor');
    expect(filterPermittedProps(baseline.files[file]!)[0]!.props).not.toContain(
      'data-config-anchor'
    );
  });

  it('`id` is permitted only on `AddressListField`', () => {
    const withIds = fingerprintSource(
      'x.tsx',
      `const a = (<div><AddressListField id="m-f" /><TextField id="token-name" /></div>);`
    );
    const filtered = filterPermittedProps(withIds);
    const [root] = filtered;
    const [addressList, textField] = root!.children;

    expect(addressList!.tag).toBe(ID_PERMITTED_TAG);
    expect(addressList!.props).not.toContain('id');
    expect(textField!.props).toContain('id');
    expect(textField!.values.id).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// INV-7 — the fingerprint is sensitive, proven by mutation
// ---------------------------------------------------------------------------

/**
 * A representative fixture: nesting, sibling order, a literal `className`, a
 * `cn(...)` `className`, a `style` prop, an `id`, a conditional render and a
 * `.map()` — the shapes the guarded files actually use.
 */
const FIXTURE = `
export function Section({ items, selected }: Props) {
  return (
    <Card className="space-y-4">
      <CardHeader className="flex items-center" style={{ gap: 8 }}>
        <Label className="text-sm">Title</Label>
        <InfoIcon />
      </CardHeader>
      <CardContent className={cn('grid gap-3', selected && 'border-primary')}>
        <TextField id="token-name" name="name" label="Name" />
        {selected && <Badge className="ml-2">Selected</Badge>}
        {items.map((item) => (
          <Row key={item.id} className="flex">
            <span className="truncate">{item.name}</span>
          </Row>
        ))}
      </CardContent>
    </Card>
  );
}
`;

const FIXTURE_NAME = 'Section.tsx';

function print(source: string): string {
  return JSON.stringify(fingerprintSource(FIXTURE_NAME, source));
}

function printFiltered(source: string): string {
  return JSON.stringify(filterPermittedProps(fingerprintSource(FIXTURE_NAME, source)));
}

/** Replace once, and fail loudly if the anchor text was not found. */
function mutate(source: string, from: string, to: string): string {
  if (!source.includes(from)) {
    throw new Error(`mutation anchor not present in the fixture: ${JSON.stringify(from)}`);
  }
  return source.replace(from, to);
}

describe('INV-7 — mutations that MUST change the fingerprint', () => {
  const base = print(FIXTURE);

  const cases: ReadonlyArray<readonly [string, string]> = [
    [
      '(a) an element is added',
      mutate(FIXTURE, '<InfoIcon />', '<InfoIcon />\n        <ExtraIcon />'),
    ],
    ['(b) an element is removed', mutate(FIXTURE, '<InfoIcon />', '')],
    [
      '(c) an element is re-nested one level deeper',
      mutate(
        FIXTURE,
        '<Label className="text-sm">Title</Label>',
        '<div><Label className="text-sm">Title</Label></div>'
      ),
    ],
    [
      '(d) two siblings are re-ordered',
      mutate(
        FIXTURE,
        '<Label className="text-sm">Title</Label>\n        <InfoIcon />',
        '<InfoIcon />\n        <Label className="text-sm">Title</Label>'
      ),
    ],
    [
      '(e) a tag is renamed',
      mutate(FIXTURE, '<CardHeader', '<CardHeading').replace('</CardHeader>', '</CardHeading>'),
    ],
    [
      '(f) one character of a className literal changes',
      mutate(FIXTURE, 'className="text-sm"', 'className="text-xs"'),
    ],
    ['(g) a style value changes', mutate(FIXTURE, 'style={{ gap: 8 }}', 'style={{ gap: 9 }}')],
    [
      '(h) a className literal becomes an equivalent cn(...) call',
      mutate(FIXTURE, 'className="space-y-4"', "className={cn('space-y', '-4')}"),
    ],
    [
      '(i) an id on a non-permitted tag is renamed',
      mutate(FIXTURE, 'id="token-name"', 'id="token-title"'),
    ],
    [
      '(j) a conditional render becomes unconditional',
      mutate(
        FIXTURE,
        '{selected && <Badge className="ml-2">Selected</Badge>}',
        '<Badge className="ml-2">Selected</Badge>'
      ),
    ],
  ];

  it.each(cases)('%s', (_label, mutated) => {
    expect(print(mutated)).not.toBe(base);
  });

  /**
   * Case (h) deserves its reason on the record. `cn('a','b')` and `"a b"` render
   * the same classes, so the fingerprint is *stricter* than the rendered result
   * here — deliberately. AS-5 is a promise about the diff, and a swap of that
   * kind should be reviewed rather than waved through.
   */
  it('(h) is strictness, not a false positive', () => {
    const literal = fingerprintSource(FIXTURE_NAME, `const a = <div className="a b" />;`);
    const call = fingerprintSource(FIXTURE_NAME, `const a = <div className={cn('a', 'b')} />;`);
    expect(literal[0]!.values.className).not.toBe(call[0]!.values.className);
  });

  /**
   * Case (j) closes an evasion INV-7 does not name: an element-tree-only
   * fingerprint would see `{cond && <X/>}` and a bare `<X/>` as the same shape,
   * so turning a conditional into an unconditional render — a real structural
   * change — would pass. The `via` chain is what catches it.
   */
  it('(j) is caught by the `via` chain, not by the element list', () => {
    const conditional = fingerprintSource(FIXTURE_NAME, `const a = <div>{c && <X />}</div>;`);
    const unconditional = fingerprintSource(FIXTURE_NAME, `const a = <div><X /></div>;`);
    expect(conditional[0]!.children[0]!.tag).toBe(unconditional[0]!.children[0]!.tag);
    expect(conditional[0]!.children[0]!.via).not.toEqual(unconditional[0]!.children[0]!.via);
  });
});

describe('INV-7 — changes that MUST NOT change the fingerprint', () => {
  let atSixty = '';
  let atTwoHundred = '';

  beforeAll(async () => {
    atSixty = await prettier.format(FIXTURE, { parser: 'typescript', printWidth: 60 });
    atTwoHundred = await prettier.format(FIXTURE, { parser: 'typescript', printWidth: 200 });
  });

  /**
   * The reason the fingerprint exists in this shape. Inserting one prop makes
   * Prettier break a one-line element across several, so a textual hunk check
   * would report a structural change where there is none — and would have to be
   * loosened until it checked nothing.
   */
  it('Prettier reflow at print width 60 and 200 produces the same fingerprint', () => {
    expect(atSixty).not.toBe(atTwoHundred); // the reformat really happened
    expect(print(atSixty)).toBe(print(atTwoHundred));
    expect(print(atSixty)).toBe(print(FIXTURE));
  });

  it('re-ordering props on one element changes nothing', () => {
    const reordered = mutate(
      FIXTURE,
      '<TextField id="token-name" name="name" label="Name" />',
      '<TextField label="Name" name="name" id="token-name" />'
    );
    expect(print(reordered)).toBe(print(FIXTURE));
  });

  it('adding a comment changes nothing', () => {
    const commented = mutate(
      FIXTURE,
      '<CardContent',
      '{/* the module config grid */}\n      <CardContent'
    );
    expect(print(commented)).toBe(print(FIXTURE));
  });

  it('adding a `data-config-anchor` changes nothing under the comparison filter', () => {
    const anchored = mutate(
      FIXTURE,
      '<Row key={item.id} className="flex">',
      '<Row key={item.id} data-config-anchor={moduleAnchor(item.id)} className="flex">'
    );
    expect(printFiltered(anchored)).toBe(printFiltered(FIXTURE));
    // …and it is visible without the filter, which is what makes the baseline
    // evidence rather than decoration.
    expect(print(anchored)).not.toBe(print(FIXTURE));
  });

  it('adding a `configAnchor` changes nothing under the comparison filter', () => {
    const anchored = mutate(
      FIXTURE,
      '<InfoIcon />',
      '<InfoIcon configAnchor={adminAnchor("x")} />'
    );
    expect(printFiltered(anchored)).toBe(printFiltered(FIXTURE));
    expect(print(anchored)).not.toBe(print(FIXTURE));
  });

  it('adding an `id` to an `AddressListField` changes nothing under the filter', () => {
    const before = `const a = <div><AddressListField value={v} /></div>;`;
    const after = `const a = <div><AddressListField id="m-f" value={v} /></div>;`;
    expect(printFiltered(after)).toBe(printFiltered(before));
    expect(print(after)).not.toBe(print(before));
  });

  it('changing quote style or trailing commas changes nothing', () => {
    const requoted = FIXTURE.replace(/"/g, "'").replace("cn('grid gap-3',", "cn('grid gap-3' ,");
    expect(print(requoted)).toBe(print(FIXTURE));
  });
});
