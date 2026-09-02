/**
 * Shared machinery for the SF-3 provenance suites.
 *
 * Two rules shape everything here:
 *
 * - Lines are located by CONTENT, never by absolute number (INV-33). A range is
 *   checked by slicing the final file and asserting what the slice holds, so a
 *   future template edit that moves a line is not a false failure.
 * - Provenance-only fixtures live here and are deliberately NOT added to
 *   `GOLDEN_FIXTURES`: doing so would create new directories under `__goldens__`,
 *   which INV-10's branch gate forbids.
 */
import type { GenerationResult } from '@openzeppelin/codegen-core';
import { hasProvenance } from '@openzeppelin/codegen-core';
import type {
  ConfigPath,
  FileProvenance,
  ProvenanceEntry,
  ProvenanceLineRange,
  ProvenanceResult,
} from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { generate, generateWithIdentitySupport } from '../../src/index';
import { createValidConfig } from '../helpers/config';
import { GOLDEN_FIXTURES, type GoldenFixture } from '../golden/fixtures';

export { GOLDEN_FIXTURES };
export type { GoldenFixture };

/** The two generate roots, named as the golden tree names them. */
export interface GeneratePath {
  readonly name: string;
  readonly run: (config: RWAConfig, options?: { recordProvenance?: boolean }) => GenerationResult;
}

export const GENERATE_PATHS: readonly GeneratePath[] = [
  { name: 'generate', run: (config, options) => generate(config, options) },
  {
    name: 'generate-with-identity-support',
    run: (config, options) => generateWithIdentitySupport(config, options),
  },
];

/** Generate with recording on, failing loudly if the capability did not answer. */
export function generateRecorded(
  path: GeneratePath,
  config: RWAConfig
): { files: Record<string, string | Uint8Array>; provenance: ProvenanceResult } {
  const result = path.run(config, { recordProvenance: true });
  if (!hasProvenance(result)) {
    throw new Error(`${path.name} returned no provenance with recordProvenance: true`);
  }
  return { files: result.files, provenance: result.provenance };
}

/* ------------------------------------------------------------------ *
 * Entry access
 * ------------------------------------------------------------------ */

export function entriesOf(provenance: ProvenanceResult, filePath: string): readonly ProvenanceEntry[] {
  const file: FileProvenance | undefined = provenance.files[filePath];
  if (file === undefined) throw new Error(`no provenance recorded for "${filePath}"`);
  return file.entries;
}

export function fileEntry(
  provenance: ProvenanceResult,
  filePath: string
): Extract<ProvenanceEntry, { kind: 'file' }> {
  const entry = entriesOf(provenance, filePath).find((candidate) => candidate.kind === 'file');
  if (entry === undefined) throw new Error(`"${filePath}" has no file entry`);
  return entry;
}

export function createdEntry(
  provenance: ProvenanceResult,
  filePath: string
): Extract<ProvenanceEntry, { kind: 'created' }> | undefined {
  return entriesOf(provenance, filePath).find((entry) => entry.kind === 'created');
}

export function rangeEntries(
  provenance: ProvenanceResult,
  filePath: string
): readonly Extract<ProvenanceEntry, { kind: 'range' }>[] {
  return entriesOf(provenance, filePath).filter((entry) => entry.kind === 'range');
}

/** Ranges on `filePath` whose paths include `configPath` exactly. */
export function rangesForPath(
  provenance: ProvenanceResult,
  filePath: string,
  configPath: ConfigPath
): readonly ProvenanceLineRange[] {
  return rangeEntries(provenance, filePath)
    .filter((entry) => entry.paths.includes(configPath))
    .map((entry) => entry.range);
}

/* ------------------------------------------------------------------ *
 * Final-text inspection (INV-33/34/35: by content, never by line number)
 * ------------------------------------------------------------------ */

/** `content` split the way the range dialect counts lines. */
export function linesOf(content: string): string[] {
  return content.split('\n');
}

/** The 1-indexed inclusive `range` of `content`, as an array of lines. */
export function sliceRange(content: string, range: ProvenanceLineRange): string[] {
  return linesOf(content).slice(range.start - 1, range.end);
}

/** The line count the range dialect ascribes to `content`. */
export function finalLineCount(content: string): number {
  return content === '' ? 0 : linesOf(content).length;
}

export function textOf(files: Record<string, string | Uint8Array>, filePath: string): string {
  const content = files[filePath];
  if (typeof content !== 'string') throw new Error(`"${filePath}" is not a text file`);
  return content;
}

/** True when some line of some range attributed to `configPath` contains `needle`. */
export function someRangeContains(
  provenance: ProvenanceResult,
  content: string,
  filePath: string,
  configPath: ConfigPath,
  needle: string
): boolean {
  return rangesForPath(provenance, filePath, configPath).some((range) =>
    sliceRange(content, range).some((line) => line.includes(needle))
  );
}

/** True when any range attributed to `configPath` holds `needle` — the widened-range detector. */
export function noRangeContains(
  provenance: ProvenanceResult,
  content: string,
  filePath: string,
  configPath: ConfigPath,
  needle: string
): boolean {
  return !someRangeContains(provenance, content, filePath, configPath, needle);
}

/* ------------------------------------------------------------------ *
 * INV-4: well-formedness, checked over every file of every fixture
 * ------------------------------------------------------------------ */

export interface WellFormedProblem {
  readonly filePath: string;
  readonly problem: string;
}

/**
 * Every structural rule of INV-4 in one sweep. Returns the problems rather than
 * asserting, so a caller can report all of them at once instead of the first.
 */
export function wellFormedProblems(
  provenance: ProvenanceResult,
  files: Record<string, string | Uint8Array>
): WellFormedProblem[] {
  const problems: WellFormedProblem[] = [];
  const report = (filePath: string, problem: string): void => {
    problems.push({ filePath, problem });
  };

  for (const [filePath, file] of Object.entries(provenance.files)) {
    const entries = file.entries;
    const kinds = entries.map((entry) => entry.kind);

    if (kinds.filter((kind) => kind === 'file').length !== 1) {
      report(filePath, `expected exactly one file entry, got ${kinds.filter((k) => k === 'file').length}`);
    }
    if (kinds.filter((kind) => kind === 'created').length > 1) {
      report(filePath, 'more than one created entry');
    }
    if (kinds[0] !== 'file') report(filePath, `first entry is "${kinds[0]}", expected "file"`);

    const createdAt = kinds.indexOf('created');
    const firstRange = kinds.indexOf('range');
    if (createdAt !== -1 && firstRange !== -1 && createdAt > firstRange) {
      report(filePath, 'created entry appears after a range entry');
    }

    for (const entry of entries) {
      const sorted = [...entry.paths].sort();
      if (entry.paths.some((path, index) => path !== sorted[index])) {
        report(filePath, `paths are not sorted: ${JSON.stringify(entry.paths)}`);
      }
      if (new Set(entry.paths).size !== entry.paths.length) {
        report(filePath, `paths contain duplicates: ${JSON.stringify(entry.paths)}`);
      }
    }

    const content = files[filePath];
    if (content === undefined) {
      report(filePath, 'provenance key names a file that was not emitted');
      continue;
    }
    if (typeof content !== 'string') continue;

    const lineCount = finalLineCount(content);
    const ranges = entries.filter((entry) => entry.kind === 'range');
    let previousStart = 0;
    for (const entry of ranges) {
      const { start, end } = entry.range;
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
        report(filePath, `malformed range ${start}..${end}`);
      }
      if (end > lineCount) {
        report(filePath, `range ${start}..${end} exceeds the file's ${lineCount} lines`);
      }
      if (start < previousStart) report(filePath, 'range entries are not ordered by start');
      previousStart = start;
    }
  }

  return problems;
}

/* ------------------------------------------------------------------ *
 * Provenance-only fixtures (invariants Open Question 5)
 *
 * These exercise inputs the 16-fixture golden matrix does not reach. They are
 * asserted against provenance and against direct function output only — never
 * against a golden, and they are NOT members of `GOLDEN_FIXTURES`.
 * ------------------------------------------------------------------ */

/** Two distinct modules: the sibling-confusion matrix of Checkpoint 7. */
export const twoModuleConfig = (): RWAConfig =>
  createValidConfig({
    compliance: {
      modules: [
        { moduleId: 'country-allow', config: { allowedCountries: ['CH', 'SG'] } },
        { moduleId: 'max-balance', config: { maxBalance: 50_000 } },
      ],
    },
  });

/** The same module id twice: one file set, a `createdBy` union of both indices. */
export const duplicateModuleConfig = (): RWAConfig =>
  createValidConfig({
    compliance: {
      modules: [
        { moduleId: 'country-allow', config: { allowedCountries: ['CH'] } },
        { moduleId: 'country-allow', config: { allowedCountries: ['SG'] } },
      ],
    },
  });

/** No modules at all: the empty-render path of every possibly-empty block (INV-37). */
export const noModuleConfig = (): RWAConfig => createValidConfig({ compliance: { modules: [] } });

/**
 * Three topics with the NON-FINAL one unselected, issuers referencing only
 * selected topics (SF-16 INV-36 fixture 1).
 *
 * The position is the whole point. Unselect the FINAL topic and the count/index
 * conflation this sub-feature removes emits byte-correct output — selected count
 * 2, loop over indices 0 and 1, ids 1 and 2, which is exactly right. So a
 * final-position fixture passes with the defect present and reads as coverage.
 * With topic 1 unselected at index 0, the conflation emits `1, 2` where `2, 7`
 * is correct, and every check below separates them.
 *
 * NOT a member of `GOLDEN_FIXTURES`: a golden fixture adds a directory and a
 * manifest on both roots, which moves the goldens tree OID that this branch's
 * gate pins.
 */
export const topicUnselectedConfig = (): RWAConfig =>
  createValidConfig({
    identityVerification: {
      claimTopics: [
        { id: 1, name: 'KYC', selected: false },
        { id: 2, name: 'AML' },
        { id: 7, name: 'Accredited Investor', isCustom: true },
      ],
      trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [2, 7] }],
    },
  });

/**
 * The same shape with the FINAL topic unselected — the declared vacuity control
 * for `topicUnselectedConfig`, not coverage.
 *
 * Under the count/index conflation this config's output is byte-identical to the
 * output for the same config with topic 7 absent, so the byte-identity oracle
 * passes on it both before and after the projection change. It is kept, and
 * labelled, so nobody re-derives the mistake by "adding a case with an
 * unselected topic".
 */
export const finalTopicUnselectedConfig = (): RWAConfig =>
  createValidConfig({
    identityVerification: {
      claimTopics: [
        { id: 1, name: 'KYC' },
        { id: 2, name: 'AML' },
        { id: 7, name: 'Accredited Investor', isCustom: true, selected: false },
      ],
      trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [1, 2] }],
    },
  });

/**
 * `topicUnselectedConfig` with the unselected topic ABSENT instead — the other
 * half of the byte-identity oracle. Pruned from every issuer, per the oracle's
 * statement.
 */
export const topicAbsentConfig = (): RWAConfig =>
  createValidConfig({
    identityVerification: {
      claimTopics: [
        { id: 2, name: 'AML' },
        { id: 7, name: 'Accredited Investor', isCustom: true },
      ],
      trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [2, 7] }],
    },
  });

/** `finalTopicUnselectedConfig` with the final topic absent — the control's pair. */
export const finalTopicAbsentConfig = (): RWAConfig =>
  createValidConfig({
    identityVerification: {
      claimTopics: [
        { id: 1, name: 'KYC' },
        { id: 2, name: 'AML' },
      ],
      trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [1, 2] }],
    },
  });
