import type {
  AdoptionSummary,
  FileFingerprint,
  JsxElementFingerprint,
  StepMarkupBaseline,
  SupersededMarkupEntry,
  SupersededMarkupRecord,
} from './stepMarkupFingerprint';
import { countAnchorProps, filterPermittedProps, fingerprintSource } from './stepMarkupFingerprint';
import type { MarkupSupersession } from './stepMarkupSanction';

/**
 * The logic half of the two-key re-baseline (SF-15). Pure over its inputs.
 *
 * Every function here takes its records as parameters — no module-level read of
 * the baseline or the record, no file I/O, no printing, no memo, no module
 * state. That is not tidiness: the states the negatives describe are unwritable
 * in the real record by construction (`NO_DIVERGENCE` forbids the one N3 needs),
 * so a module that read its own records could not be tested against them at all
 * and three of the load-bearing properties would ship unproven (INV-30).
 *
 * Nothing here throws. Refusals are returned as a list of typed codes, and the
 * parse boundary returns them too. Tests compare codes by exact array equality —
 * never a substring of a message (INV-10).
 */

/** Which record a guarded file's truth is being read from. */
export type GuardAuthority = 'baseline' | 'superseded';

/**
 * The whole answer for one guarded file.
 *
 * `no-authority` is a real arm rather than a throw or an absent case: a total
 * function that says "I have no answer for this input" is only safe if the
 * caller treats that as a failure. The suite's consumer fails the file by name
 * on it (INV-4) — a `switch` arm that returns without asserting is the same hole
 * with a type-checked face.
 */
export type GuardVerdict =
  | { readonly kind: 'match'; readonly file: string; readonly authority: GuardAuthority }
  | {
      readonly kind: 'mismatch';
      readonly file: string;
      readonly authority: GuardAuthority;
      readonly current: FileFingerprint;
      readonly recorded: FileFingerprint;
    }
  | { readonly kind: 'no-authority'; readonly file: string };

export type SanctionRefusalCode =
  | 'ALREADY_BASELINED'
  | 'ANCHOR_DELTA_MISMATCH'
  | 'DUPLICATE_FILE'
  | 'EMPTY_DECLARATION'
  | 'MALFORMED_AUTHORITY'
  | 'MALFORMED_RECORD'
  | 'MISSING_REASON'
  | 'NOT_BASELINED'
  | 'NO_DIVERGENCE'
  | 'STALE_ADOPTION'
  | 'UNKNOWN_FILE';

/**
 * Every refusal this unit can produce, sorted. Pinned by exact array equality in
 * the suite, so a twelfth code cannot arrive without editing the expectation and
 * writing its test (INV-9).
 */
export const SANCTION_REFUSAL_CODES = [
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
] as const satisfies readonly SanctionRefusalCode[];

type Expect<T extends true> = T;

/**
 * The other direction of INV-9's binding, at compile time.
 *
 * `satisfies` above proves every *array element* is a real code. This proves
 * every *union member* is in the array — the direction a test cannot cover,
 * because a code missing from the pinned array is also missing from the pinned
 * expectation, so the equality test stays green while the new refusal ships
 * untested. It fails to compile instead.
 */
export type EveryRefusalCodeIsPinned = Expect<
  Exclude<SanctionRefusalCode, (typeof SANCTION_REFUSAL_CODES)[number]> extends never ? true : false
>;

export interface SanctionRefusal {
  readonly code: SanctionRefusalCode;
  /** The file at fault, or `null` for a refusal about the declaration set as a whole. */
  readonly file: string | null;
  /**
   * Human detail for the CLI. **Never** the subject of an assertion identifying
   * which refusal fired — tests compare `code` (INV-10). The single exception is
   * `ANCHOR_DELTA_MISMATCH`, whose detail is inspected for what it must *not*
   * say (INV-14).
   */
  readonly detail: string;
}

/**
 * The declaration fields a record entry echoes, and the whole surface two-key
 * agreement compares. Sorted so the comparison and its failure output are
 * stable.
 */
export const MIRRORED_FIELDS = [
  'anchorDelta',
  'authorisedBy',
  'components',
  'decidedOn',
  'file',
  'introducesFirstAnchor',
  'kind',
  'reason',
] as const satisfies readonly (keyof MarkupSupersession)[];

/**
 * Two-key agreement is only as wide as this list, so the list may not fall
 * behind the type. A field added to `MarkupSupersession` and not added here
 * would be echoed into the record and never compared — the record could carry a
 * different value for it forever, which is exactly the decoration INV-1 exists
 * to prevent. This fails to compile the day that happens.
 */
export type EveryDeclarationFieldIsMirrored = Expect<
  Exclude<keyof MarkupSupersession, (typeof MIRRORED_FIELDS)[number]> extends never ? true : false
>;

/** The authority in force for one file, and which record it came from. */
export interface SelectedAuthority {
  readonly authority: GuardAuthority;
  readonly recorded: FileFingerprint;
}

export type ParseSupersededResult =
  | { readonly record: SupersededMarkupRecord }
  | { readonly refusals: readonly SanctionRefusal[] };

export interface ValidateSanctionInput {
  readonly declarations: readonly MarkupSupersession[];
  /** The glob expansion, from the sealed baseline's own glob list (INV-24). */
  readonly guardedFiles: readonly string[];
  readonly baseline: StepMarkupBaseline;
  /**
   * The **committed** record, before this run. Divergence is measured against
   * the authority currently in force rather than always against the baseline,
   * or `NO_DIVERGENCE` is permanently inert for every declared file and the
   * sanctioned command becomes one that always succeeds (INV-15).
   */
  readonly record: SupersededMarkupRecord;
  /** Current fingerprints, keyed by file, for the declared files. */
  readonly current: Readonly<Record<string, FileFingerprint>>;
}

// ---------------------------------------------------------------------------
// Shared shapes and predicates.
// ---------------------------------------------------------------------------

/** `SF-<n>`. Validated, not trusted — an unattributed supersession is rot. */
const AUTHORISED_BY_SHAPE = /^SF-\d+$/;

/**
 * `YYYY-MM-DD`. Validating the shape is what makes a *lexical* comparison a date
 * comparison, which is the whole mechanism behind `STALE_ADOPTION` (INV-16).
 */
const DECIDED_ON_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The reason floor, in characters after trimming. Arbitrary within an order of
 * magnitude: chosen to admit one real sentence and reject `TODO`.
 *
 * **The bound, stated so the check is not mistaken for more:** forty characters
 * of nonsense passes, and no machine can check that a reason is a good one. The
 * floor stops the empty string and the reflexive placeholder; review does the
 * rest (INV-13).
 */
const REASON_FLOOR = 40;

/**
 * Matched against the **whole trimmed reason**, never as a substring.
 *
 * A substring match refuses a genuine sentence that happens to contain "TODO",
 * and the author — correct and blocked — shortens the reason until the check
 * passes, so the prose gets worse to satisfy a check meant to make it better.
 * This initiative has already lost one guard that way.
 *
 * Note the honest redundancy: every placeholder here is shorter than
 * {@link REASON_FLOOR}, so today the floor catches all four first and this list
 * never fires on its own. It is kept because it is the half that still bites if
 * the floor is ever lowered, and deleting it would make that lowering silent.
 */
const REASON_PLACEHOLDERS: readonly string[] = ['todo', 'tbd', 'see above', 'n/a'];

function refuse(code: SanctionRefusalCode, file: string | null, detail: string): SanctionRefusal {
  return { code, file, detail };
}

/**
 * Deterministic refusal order — by file, then by code — so the CLI's output and
 * the tests' arrays are stable and a shuffled declaration set cannot change
 * either. Set-level refusals carry a `null` file and sort first.
 */
function sortRefusals(refusals: readonly SanctionRefusal[]): readonly SanctionRefusal[] {
  return [...refusals].sort((left, right) => {
    const byFile = (left.file ?? '').localeCompare(right.file ?? '');
    return byFile !== 0 ? byFile : left.code.localeCompare(right.code);
  });
}

/**
 * The comparison, reused whole from SF-12: `filterPermittedProps` on both sides,
 * so INV-7's proven sensitivity carries to both authorities for free and nothing
 * about it is re-derived here.
 */
function sameUnderFilter(left: FileFingerprint, right: FileFingerprint): boolean {
  return JSON.stringify(filterPermittedProps(left)) === JSON.stringify(filterPermittedProps(right));
}

function statesAReason(reason: string): boolean {
  const trimmed = reason.trim();
  if (trimmed.length < REASON_FLOOR) return false;
  return !REASON_PLACEHOLDERS.includes(trimmed.toLowerCase());
}

function duplicatesOf(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated].sort();
}

// ---------------------------------------------------------------------------
// The JSON boundary — the single `unknown` in this unit.
// ---------------------------------------------------------------------------

/**
 * The record's shape *as claimed by the file*, before any of it is believed.
 *
 * Every field below is a claim to be checked, not a fact: the annotations say
 * what a well-formed record would carry, and {@link parseSupersededRecord}
 * re-checks each one at run time before the value escapes as a
 * `SupersededMarkupRecord`. Declaring the shape is what lets the single
 * `unknown` narrow through an explicit type rather than through a cascade of
 * further `unknown`s (INV-6).
 */
interface ClaimedRecord {
  readonly entries?: readonly ClaimedEntry[];
}

interface ClaimedEntry {
  readonly file?: string;
  readonly kind?: string;
  readonly authorisedBy?: string;
  readonly decidedOn?: string;
  readonly reason?: string;
  readonly components?: readonly string[];
  readonly anchorDelta?: number;
  readonly introducesFirstAnchor?: boolean;
  readonly adopted?: ClaimedAdoption;
  readonly fingerprint?: FileFingerprint;
}

interface ClaimedAdoption {
  readonly elementsBefore?: number;
  readonly elementsAfter?: number;
  readonly tagsAdded?: readonly string[];
  readonly tagsRemoved?: readonly string[];
  readonly valuesChanged?: number;
}

function isStringArray(value: readonly string[] | undefined): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function claimedAdoptionOf(claimed: ClaimedAdoption | undefined): AdoptionSummary | null {
  if (claimed === null || typeof claimed !== 'object' || Array.isArray(claimed)) return null;
  const { elementsBefore, elementsAfter, tagsAdded, tagsRemoved, valuesChanged } = claimed;
  if (typeof elementsBefore !== 'number' || typeof elementsAfter !== 'number') return null;
  if (typeof valuesChanged !== 'number') return null;
  if (!isStringArray(tagsAdded) || !isStringArray(tagsRemoved)) return null;
  return { elementsBefore, elementsAfter, tagsAdded, tagsRemoved, valuesChanged };
}

/**
 * Parse a superseded record from JSON text. Total: never throws for any input.
 *
 * A valid record with `entries: []` is **success**, not a refusal —
 * `EMPTY_DECLARATION` is a property of the declaration, not of the record, and
 * the shipped state is an empty record beside an empty declaration.
 *
 * The `fingerprint` tree is checked to be an array and no deeper. Bounding
 * recursion over a maliciously nested fingerprint is out of scope by design: the
 * input is a reviewed, checked-in file written by somebody who already has
 * commit access, and the per-file comparison is what actually reads it.
 */
export function parseSupersededRecord(json: string): ParseSupersededResult {
  const parsed: unknown = safeParse(json);

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { refusals: [refuse('MALFORMED_RECORD', null, 'the record is not a JSON object')] };
  }

  const claimed = parsed as ClaimedRecord;
  if (!Array.isArray(claimed.entries)) {
    return { refusals: [refuse('MALFORMED_RECORD', null, '`entries` is missing or not an array')] };
  }

  const entries: SupersededMarkupEntry[] = [];
  for (const claimedEntry of claimed.entries) {
    if (claimedEntry === null || typeof claimedEntry !== 'object') {
      return { refusals: [refuse('MALFORMED_RECORD', null, 'an entry is not an object')] };
    }
    const entry = entryOf(claimedEntry);
    if (entry === null) {
      const named = typeof claimedEntry.file === 'string' ? claimedEntry.file : null;
      return {
        refusals: [
          refuse('MALFORMED_RECORD', named, 'an entry has a missing or wrong-typed field'),
        ],
      };
    }
    entries.push(entry);
  }

  return { record: { entries } };
}

/** `JSON.parse`, with a syntax error turned into a value rather than a throw. */
function safeParse(json: string): ReturnType<typeof JSON.parse> | null {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function entryOf(claimed: ClaimedEntry): SupersededMarkupEntry | null {
  const {
    file,
    kind,
    authorisedBy,
    decidedOn,
    reason,
    components,
    anchorDelta,
    introducesFirstAnchor,
    fingerprint,
  } = claimed;

  if (typeof file !== 'string' || typeof authorisedBy !== 'string') return null;
  if (typeof decidedOn !== 'string' || typeof reason !== 'string') return null;
  if (typeof anchorDelta !== 'number' || typeof introducesFirstAnchor !== 'boolean') return null;
  if (kind !== 'replaces-baseline' && kind !== 'first-record') return null;
  if (!isStringArray(components)) return null;
  if (!Array.isArray(fingerprint)) return null;

  const adopted = claimedAdoptionOf(claimed.adopted);
  if (adopted === null) return null;

  // Rebuilt field by field rather than spread, so an unexpected key in the JSON
  // cannot ride into a typed value that claims not to have one.
  return {
    file,
    kind,
    authorisedBy,
    decidedOn,
    reason,
    components,
    anchorDelta,
    introducesFirstAnchor,
    adopted,
    fingerprint,
  };
}

// ---------------------------------------------------------------------------
// Two-key agreement — INV-1, INV-2.
// ---------------------------------------------------------------------------

/**
 * The declarations and the written record must name exactly the same files, in
 * both directions, **and agree on every mirrored field**.
 *
 * Sorted file-name equality is necessary and is asserted here, but it is not the
 * property: it passes while the JSON carries a different `reason`, a different
 * `authorisedBy`, a different `decidedOn` or a different `anchorDelta` from the
 * declaration it claims to echo. The record is machine-written and nobody
 * re-reads it, so that failure is invisible — and the paper trail becomes
 * decoration exactly where AS-4 says it must not (INV-1).
 *
 * The direction is bound by what this function is *given*: declarations arrive
 * by module import, the record by `readFileSync`, and nothing here writes back
 * (INV-2).
 */
export function checkTwoKeyAgreement(
  declarations: readonly MarkupSupersession[],
  record: SupersededMarkupRecord
): readonly SanctionRefusal[] {
  const refusals: SanctionRefusal[] = [];
  const declaredFiles = declarations.map((declaration) => declaration.file);
  const recordedFiles = record.entries.map((entry) => entry.file);

  for (const file of duplicatesOf(declaredFiles)) {
    refusals.push(refuse('DUPLICATE_FILE', file, `${file} is declared more than once`));
  }
  // The record is an array, not a map, so uniqueness is not free (INV-6).
  for (const file of duplicatesOf(recordedFiles)) {
    refusals.push(refuse('DUPLICATE_FILE', file, `${file} appears twice in the record`));
  }

  for (const file of recordedFiles) {
    if (declaredFiles.includes(file)) continue;
    refusals.push(refuse('UNKNOWN_FILE', file, `${file} is in the record with no declaration`));
  }
  for (const file of declaredFiles) {
    if (recordedFiles.includes(file)) continue;
    refusals.push(refuse('UNKNOWN_FILE', file, `${file} is declared with no record entry`));
  }

  for (const declaration of declarations) {
    const entry = record.entries.find((candidate) => candidate.file === declaration.file);
    if (entry === undefined) continue;
    for (const field of MIRRORED_FIELDS) {
      if (JSON.stringify(entry[field]) === JSON.stringify(declaration[field])) continue;
      refusals.push(
        refuse(
          'MALFORMED_RECORD',
          declaration.file,
          `${declaration.file}: the record's \`${field}\` does not echo the declaration`
        )
      );
    }
  }

  return sortRefusals(refusals);
}

// ---------------------------------------------------------------------------
// Authority selection and the comparison — INV-3, INV-4, INV-18.
// ---------------------------------------------------------------------------

/**
 * Which record owns this file's truth. **By declaration membership only.**
 *
 * There is no fallback from one authority to the other, and no comparison
 * happens in here: the function has no access to the current source, which is
 * what makes match-driven selection unexpressible rather than merely absent. A
 * try-baseline-then-fall-back implementation passes the obvious negatives and is
 * still a hole — a superseded file that silently reverted would match the
 * baseline and be reported fine while the change it was superseded for had been
 * undone (INV-18).
 *
 * The first matching entry wins if the record somehow holds two for one file;
 * that state is refused by `DUPLICATE_FILE` and asserted against in the suite,
 * so the tie-break is never load-bearing.
 */
export function selectAuthority(
  file: string,
  baseline: StepMarkupBaseline,
  record: SupersededMarkupRecord
): SelectedAuthority | null {
  const declared = record.entries.find((entry) => entry.file === file);
  if (declared !== undefined) return { authority: 'superseded', recorded: declared.fingerprint };

  const recorded = baseline.files[file];
  if (recorded !== undefined) return { authority: 'baseline', recorded };

  return null;
}

/**
 * The whole guard for one file, pure over its inputs so every clause is
 * falsifiable without touching the working tree.
 *
 * The comparison is byte-for-byte the one SF-12 shipped. Only the *recorded*
 * side's selection changed.
 */
export function checkGuardedFile(
  file: string,
  sourceText: string,
  baseline: StepMarkupBaseline,
  record: SupersededMarkupRecord
): GuardVerdict {
  const selected = selectAuthority(file, baseline, record);
  if (selected === null) return { kind: 'no-authority', file };

  const current = fingerprintSource(file, sourceText);
  if (sameUnderFilter(current, selected.recorded)) {
    return { kind: 'match', file, authority: selected.authority };
  }
  return {
    kind: 'mismatch',
    file,
    authority: selected.authority,
    current,
    recorded: selected.recorded,
  };
}

// ---------------------------------------------------------------------------
// Declaration validation — the entire decision surface of the CLI.
// ---------------------------------------------------------------------------

/**
 * Every refusal the declaration set earns, never just the first.
 *
 * The signature cannot express "the first one" on purpose. An early-return
 * implementation passes all eleven single-code tests — each is built to trigger
 * exactly one code, so each observes exactly one — and then makes the sanctioned
 * path a process where every run reveals one more problem, which is a process
 * people route around (INV-11).
 *
 * Checks are in three tiers. Two are properties of the declaration *text* and
 * run for every declaration; the rest presuppose the file is actually guarded,
 * so they are skipped for a file the glob expansion does not hold — otherwise a
 * simple typo would also earn a membership refusal that is true but useless.
 */
export function validateSanction(input: ValidateSanctionInput): readonly SanctionRefusal[] {
  const { declarations, guardedFiles, baseline, record, current } = input;
  const refusals: SanctionRefusal[] = [];

  if (declarations.length === 0) {
    refusals.push(
      refuse('EMPTY_DECLARATION', null, 'nothing is declared; the human half comes first')
    );
  }

  for (const file of duplicatesOf(declarations.map((declaration) => declaration.file))) {
    refusals.push(refuse('DUPLICATE_FILE', file, `${file} is declared more than once`));
  }

  for (const declaration of declarations) {
    const { file } = declaration;

    if (!statesAReason(declaration.reason)) {
      refusals.push(
        refuse('MISSING_REASON', file, `${file}: the reason is absent, too short, or a placeholder`)
      );
    }
    if (
      !AUTHORISED_BY_SHAPE.test(declaration.authorisedBy) ||
      !DECIDED_ON_SHAPE.test(declaration.decidedOn)
    ) {
      refusals.push(
        refuse(
          'MALFORMED_AUTHORITY',
          file,
          `${file}: authorisedBy must be SF-<n> and decidedOn YYYY-MM-DD`
        )
      );
    }

    if (!guardedFiles.includes(file)) {
      // Everything below asks a question about a guarded file, and this is not
      // one — so it is the only answer worth giving.
      refusals.push(refuse('UNKNOWN_FILE', file, `${file} is not in the guarded set`));
      continue;
    }

    const inBaseline = baseline.files[file] !== undefined;
    if (declaration.kind === 'first-record' && inBaseline) {
      refusals.push(
        refuse(
          'ALREADY_BASELINED',
          file,
          `${file} is already in the baseline; kind must be replaces-baseline`
        )
      );
    }
    if (declaration.kind === 'replaces-baseline' && !inBaseline) {
      refusals.push(
        refuse('NOT_BASELINED', file, `${file} is not in the baseline; kind must be first-record`)
      );
    }

    const currentFingerprint = current[file];
    if (currentFingerprint === undefined) continue;

    const inForce = selectAuthority(file, baseline, record);
    const priorEntry = record.entries.find((entry) => entry.file === file);

    // Measured against the authority **in force**, not always the baseline. A
    // baseline-only comparison can never fire again for a declared file — that
    // is what a supersession is — so the refusal that stops speculative
    // supersessions would be permanently inert for exactly the files it
    // constrains (INV-15).
    //
    // Carry-forward exemption (SF-17): when the markup has not moved *and* the
    // declaration still echoes the prior entry field-for-field, this file is
    // not a new adoption — it is retained so a later SF can re-supersede a
    // *subset* of the declared set without dropping the others from the
    // two-key pair. Changing any mirrored field without a markup divergence
    // (or declaring a file that has never diverged) still refuses.
    if (inForce !== null && sameUnderFilter(currentFingerprint, inForce.recorded)) {
      const isUnchangedCarryForward =
        priorEntry !== undefined &&
        MIRRORED_FIELDS.every(
          (field) => JSON.stringify(priorEntry[field]) === JSON.stringify(declaration[field])
        );
      if (!isUnchangedCarryForward) {
        refusals.push(
          refuse('NO_DIVERGENCE', file, `${file} does not differ from the record already in force`)
        );
      }
    }

    // Re-adopting a *new* divergence for an already-recorded file costs what the
    // first adoption cost. Without this, the reason and the date on the record
    // stop being about the markup on disk, two-key still passes, and declared
    // files end up permanently softer than undeclared ones (INV-16).
    if (priorEntry !== undefined && !sameUnderFilter(currentFingerprint, priorEntry.fingerprint)) {
      if (!(declaration.decidedOn > priorEntry.decidedOn)) {
        refusals.push(
          refuse(
            'STALE_ADOPTION',
            file,
            `${file}: adopting a new divergence needs decidedOn to move forward`
          )
        );
      }
    }

    // Measured against the **sealed baseline**, not the authority in force —
    // unlike `NO_DIVERGENCE`. `anchorDelta` is the quantity § 4.6 sums onto
    // SF-12's inventory, and SF-12's inventory *is* the seal, so a delta read
    // against a prior record entry would be denominated in a different unit from
    // the one the suite adds up. It is also what lets a recorded first anchor
    // (`introducesFirstAnchor`) be carried forward: against its own record entry
    // the delta reads 0 forever, and the sanctioned command would refuse every
    // later declaration set on account of a file nobody touched (INV-8).
    const before = countAnchorProps(baseline.files[file] ?? []);
    if (declaration.anchorDelta !== countAnchorProps(currentFingerprint) - before) {
      // The detail deliberately carries **no number**. A message that hands over
      // the correct value gets pasted, and the act stops being considered —
      // which is the regenerate-on-failure reflex in a different costume. The
      // friction is the feature (INV-14).
      refusals.push(
        refuse(
          'ANCHOR_DELTA_MISMATCH',
          file,
          `${file}: the declared anchor delta disagrees with the anchors captured for this file. ` +
            'The correct value is withheld deliberately — read your own diff.'
        )
      );
    }
  }

  return sortRefusals(refusals);
}

// ---------------------------------------------------------------------------
// Adoption summary — INV-27.
// ---------------------------------------------------------------------------

function flatten(fingerprint: FileFingerprint): readonly JsxElementFingerprint[] {
  return fingerprint.flatMap((element) => [element, ...flatten(element.children)]);
}

/** Items of `left` not matched one-for-one by an item of `right`, sorted. */
function multisetDifference(left: readonly string[], right: readonly string[]): readonly string[] {
  const remaining = [...right];
  const only: string[] = [];
  for (const item of left) {
    const at = remaining.indexOf(item);
    if (at === -1) only.push(item);
    else remaining.splice(at, 1);
  }
  return only.sort();
}

/**
 * What an adoption changed, for the reviewer who will not read a thousand lines
 * of JSON — the only quantitative control on an unrelated edit riding along
 * inside a superseded file.
 *
 * Recomputed and asserted at test time rather than trusted, so it cannot go
 * stale after a re-run and cannot be hand-written. `valuesChanged` pairs
 * elements by position in the flattened tree: positions present on one side only
 * are already reported by the element counts and the tag lists, so counting them
 * again here would double-report a single change.
 */
export function summariseAdoption(
  before: FileFingerprint,
  after: FileFingerprint
): AdoptionSummary {
  const beforeElements = flatten(before);
  const afterElements = flatten(after);
  const beforeTags = beforeElements.map((element) => element.tag);
  const afterTags = afterElements.map((element) => element.tag);

  let valuesChanged = 0;
  const paired = Math.min(beforeElements.length, afterElements.length);
  for (let index = 0; index < paired; index += 1) {
    const left = beforeElements[index];
    const right = afterElements[index];
    if (JSON.stringify(left?.values) !== JSON.stringify(right?.values)) valuesChanged += 1;
  }

  return {
    elementsBefore: beforeElements.length,
    elementsAfter: afterElements.length,
    tagsAdded: multisetDifference(afterTags, beforeTags),
    tagsRemoved: multisetDifference(beforeTags, afterTags),
    valuesChanged,
  };
}
