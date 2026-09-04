/**
 * The AS-4 oracle's machinery, extracted so it can itself be tested.
 *
 * `display-significance.test.ts` runs this over the real generator and expects
 * no findings. `display-significance.meta.test.ts` runs it over deliberately
 * corrupted provenance and expects findings — because an oracle that cannot be
 * shown to fail is indistinguishable from one that always passes, and this is
 * the single test whose silent success would let the sub-feature ship hollow.
 *
 * Nothing here classifies on behalf of `src/`: the grammar is test-owned
 * (INV-27) and this module only pairs it with what the generator declared.
 */
import type { ProvenanceEntry, ProvenanceResult } from '@openzeppelin/codegen-core';

import { isDisplayOnlyRange } from './display-grammar';
import { sliceRange } from './helpers';

export type RangeEntry = Extract<ProvenanceEntry, { kind: 'range' }>;

export const isShell = (filePath: string): boolean => filePath.endsWith('.sh');

/**
 * Divergences are an explicit, justified allowlist entry, never a loosened
 * assertion. It starts empty and is asserted empty, so adding one is a visible,
 * reviewed act rather than a quiet widening.
 */
export interface Divergence {
  readonly filePath: string;
  readonly firstLine: string;
  readonly why: string;
}
export const ALLOWLIST: readonly Divergence[] = [];

export interface Finding {
  readonly filePath: string;
  readonly range: string;
  readonly paths: string;
  readonly firstLine: string;
  readonly direction: 'promotion drift' | 'silent demotion';
}

/** Reports the file key, range, attributed paths and offending line — never the config that produced them (INV-26). */
export const describeFinding = (finding: Finding, where: string): string =>
  `${
    finding.direction === 'promotion drift'
      ? 'display-only but NOT marked secondary (promotion drift)'
      : 'marked secondary but DETERMINING (silent demotion)'
  }\n` +
  `    fixture : ${where}\n` +
  `    file    : ${finding.filePath} [${finding.range}]\n` +
  `    paths   : ${finding.paths}\n` +
  `    line    : ${finding.firstLine}`;

export const rangesOf = (provenance: ProvenanceResult, filePath: string): readonly RangeEntry[] =>
  (provenance.files[filePath]?.entries ?? []).filter(
    (entry): entry is RangeEntry => entry.kind === 'range'
  );

export interface ShellCensus {
  readonly findings: readonly Finding[];
  /** `.sh` ranges carrying a mark — the non-vacuity floor's first half. */
  readonly marked: number;
  /** `.sh` ranges left primary — its second half. */
  readonly primary: number;
}

/**
 * The biconditional, swept over every recorded range of every `.sh` file:
 * display-only under the grammar **iff** marked secondary.
 *
 * The forward direction catches promotion drift; the reverse is the
 * demotion-catcher, and it is the direction this sub-feature is rated High for.
 * Both run, and the counts come back so the caller can assert the sweep was not
 * vacuous — a biconditional over an empty set passes.
 */
export function shellCensus(
  files: Record<string, string | Uint8Array>,
  provenance: ProvenanceResult,
  allowlist: readonly Divergence[] = ALLOWLIST
): ShellCensus {
  const findings: Finding[] = [];
  let marked = 0;
  let primary = 0;

  for (const [filePath, content] of Object.entries(files)) {
    if (!isShell(filePath) || typeof content !== 'string') continue;

    for (const entry of rangesOf(provenance, filePath)) {
      const lines = sliceRange(content, entry.range);
      const displayOnly = isDisplayOnlyRange(lines);
      const isMarked = entry.secondaryPaths !== undefined;
      if (isMarked) marked += 1;
      else primary += 1;
      if (displayOnly === isMarked) continue;

      const firstLine = displayOnly
        ? (lines[0] ?? '')
        : (lines.find((line) => !isDisplayOnlyRange([line])) ?? '');
      if (
        allowlist.some(
          (entryOf) => entryOf.filePath === filePath && entryOf.firstLine === firstLine
        )
      ) {
        continue;
      }
      findings.push({
        filePath,
        range: `${entry.range.start}-${entry.range.end}`,
        paths: entry.paths.join(', '),
        firstLine,
        direction: displayOnly ? 'promotion drift' : 'silent demotion',
      });
    }
  }

  return { findings, marked, primary };
}

/**
 * The grammar-free prohibition: nothing outside `.sh` may be marked at all.
 *
 * Deliberately uses no grammar. The shell classifier misfires badly here — `#`
 * opens a Rust attribute and a Markdown heading — so a genuine display-only
 * range in a contract or a README cannot be marked without someone first
 * changing this rule.
 */
export function marksOutsideShell(
  files: Record<string, string | Uint8Array>,
  provenance: ProvenanceResult
): string[] {
  const marked: string[] = [];
  for (const filePath of Object.keys(files)) {
    if (isShell(filePath)) continue;
    for (const entry of rangesOf(provenance, filePath)) {
      if (entry.secondaryPaths !== undefined) {
        marked.push(
          `${filePath} [${entry.range.start}-${entry.range.end}] paths: ${entry.paths.join(', ')}`
        );
      }
    }
  }
  return marked;
}

/* ------------------------------------------------------------------ *
 * Corruptions — used only by the meta-test, to prove the oracle fails
 * ------------------------------------------------------------------ */

const mapRanges = (
  provenance: ProvenanceResult,
  transform: (entry: RangeEntry, filePath: string) => ProvenanceEntry
): ProvenanceResult => ({
  files: Object.fromEntries(
    Object.entries(provenance.files).map(([filePath, file]) => [
      filePath,
      {
        entries: file.entries.map((entry) =>
          entry.kind === 'range' ? transform(entry, filePath) : entry
        ),
      },
    ])
  ),
});

/** The pre-SF-10 world: no range carries a mark. */
export const stripAllMarks = (provenance: ProvenanceResult): ProvenanceResult =>
  mapRanges(provenance, ({ secondaryPaths: _dropped, ...rest }) => rest);

/** Every range marked, determining ones included — the silent-demotion world. */
export const markEveryRange = (provenance: ProvenanceResult): ProvenanceResult =>
  mapRanges(provenance, (entry) =>
    entry.paths.length === 0 ? entry : { ...entry, secondaryPaths: [...entry.paths] }
  );
