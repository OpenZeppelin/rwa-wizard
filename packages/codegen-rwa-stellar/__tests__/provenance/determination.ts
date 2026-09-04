/**
 * The differential determination oracle (INV-33 / INV-34 / INV-35).
 *
 * Positive and negative containment as written in the invariants are checked by
 * looking for a value inside a range. That catches a range pointing at the wrong
 * text, but not a range that points at text the field never shaped — the failure
 * mode this initiative exists to remove, and the one a green golden cannot see.
 *
 * This oracle asks the sharper question directly: **does the field determine the
 * lines it claims?** For a config path `P` and a set of mutations that change
 * only `P`, every range attributed to `P` must contain at least one line whose
 * CONTENT is absent from the unmutated generation. A range that survives every
 * mutation of `P` character for character names lines `P` does not determine.
 *
 * Lines are compared by content, never by number, so a mutation that shifts the
 * file does not register as a change (INV-33's "locate by content" rule) — and
 * a range is only cleared when it holds text that genuinely moved.
 *
 * The mutation set is per-path and deliberately plural: a field may shape a
 * block only under a configuration the baseline does not reach (a module that
 * emits a warning, an array that empties). A range is honest if ANY mutation of
 * its path moves a line inside it; it is undetermined only when none does.
 */
import type { ConfigPath, GenerationResult } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { generateRecorded, rangeEntries, sliceRange, textOf, type GeneratePath } from './helpers';

/** One config that differs from the reference in exactly the path under test. */
export interface PathMutation {
  readonly label: string;
  readonly config: RWAConfig;
}

export interface UndeterminedRange {
  readonly filePath: string;
  readonly configPath: ConfigPath;
  readonly range: string;
  readonly firstLine: string;
  readonly lineCount: number;
}

/** Line contents present in `reference` but in none of the mutated generations. */
function contentsMovedBy(
  path: GeneratePath,
  reference: GenerationResult['files'],
  mutations: readonly PathMutation[]
): Map<string, Set<string>> {
  const moved = new Map<string, Set<string>>();

  for (const mutation of mutations) {
    const { files } = generateRecorded(path, mutation.config);

    for (const [filePath, content] of Object.entries(reference)) {
      if (typeof content !== 'string') continue;
      const set = moved.get(filePath) ?? new Set<string>();
      const mutated = files[filePath];

      if (typeof mutated !== 'string') {
        // The file exists only in the reference, so the mutation determines all
        // of it — every line counts as moved.
        for (const line of content.split('\n')) set.add(line);
      } else {
        const mutatedLines = new Set(mutated.split('\n'));
        for (const line of content.split('\n')) if (!mutatedLines.has(line)) set.add(line);
      }
      moved.set(filePath, set);
    }
  }

  return moved;
}

/**
 * Every range attributed to `configPath` that no mutation of `configPath` moves.
 * An empty result is the passing state.
 */
export function undeterminedRanges(
  path: GeneratePath,
  reference: RWAConfig,
  configPath: ConfigPath,
  mutations: readonly PathMutation[]
): UndeterminedRange[] {
  if (mutations.length === 0) {
    throw new Error(`no mutations supplied for "${configPath}" — the oracle would pass vacuously`);
  }

  const { files, provenance } = generateRecorded(path, reference);
  const moved = contentsMovedBy(path, files, mutations);
  const undetermined: UndeterminedRange[] = [];

  for (const filePath of Object.keys(provenance.files)) {
    const content = files[filePath];
    if (typeof content !== 'string') continue;
    const movedHere = moved.get(filePath) ?? new Set<string>();

    for (const entry of rangeEntries(provenance, filePath)) {
      if (!entry.paths.includes(configPath)) continue;
      const lines = sliceRange(content, entry.range);
      if (lines.some((line) => movedHere.has(line))) continue;

      undetermined.push({
        filePath,
        configPath,
        range: `${entry.range.start}..${entry.range.end}`,
        firstLine: lines[0] ?? '',
        lineCount: lines.length,
      });
    }
  }

  return undetermined;
}

/* ------------------------------------------------------------------ *
 * The focusable surface
 *
 * The oracle is only as good as the set of paths it runs on. A path the
 * wizard can focus but the mutation table omits is indistinguishable from a
 * path that was never attributed at all — the operator-role address bug lived
 * in exactly that blind spot for the whole of SF-3. So the surface is
 * enumerated FROM the reference config rather than listed by hand, and the
 * suite asserts the mutation table covers all of it.
 * ------------------------------------------------------------------ */

/**
 * Every config path the wizard can put focus on, given `config`.
 *
 * Mirrors `apps/rwa-wizard/src/features/wizard/config-path/configPathBuilders.ts`
 * — the app owns the binding table, and this package cannot import it, so the
 * two are kept in step by construction instead: every entry here is derived
 * from the config the way the builder derives it, so adding an array entry or a
 * module config field grows this set automatically and the coverage assertion
 * fails until a mutation exists for it.
 *
 * Excluded deliberately: `token.administrativeControls.*` and
 * `identityVerification.controls.*`. Every control in the live registry is
 * locked, a locked control renders no focusable input, and the builder is only
 * ever called for unlocked metas. Unlocking one is what should make this list
 * grow, and it must then arrive with a mutation.
 */
export function focusablePaths(config: RWAConfig): ConfigPath[] {
  const paths: ConfigPath[] = [
    'token.name',
    'token.symbol',
    'token.decimals',
    'token.initialSupply',
    'token.documentManager.enabled',
    'accessControl.ownership.type',
    config.accessControl.ownership.type === 'single-owner'
      ? 'accessControl.ownership.ownerAddress'
      : 'accessControl.ownership.address',
  ];

  config.accessControl.roles.forEach((_role, index) => {
    paths.push(`accessControl.roles[${index}].addresses`);
  });
  config.identityVerification.claimTopics.forEach((_topic, index) => {
    paths.push(`identityVerification.claimTopics[${index}]`);
  });
  config.identityVerification.trustedIssuers.forEach((_issuer, index) => {
    paths.push(`identityVerification.trustedIssuers[${index}].address`);
    paths.push(`identityVerification.trustedIssuers[${index}].claimTopics`);
  });
  config.compliance.modules.forEach((module, index) => {
    paths.push(`compliance.modules[${index}]`);
    for (const fieldKey of Object.keys(module.config ?? {})) {
      paths.push(`compliance.modules[${index}].config.${fieldKey}`);
    }
  });

  return paths;
}

/* ------------------------------------------------------------------ *
 * Section-boundary containment
 *
 * A cheaper, stronger check for the one shape that keeps recurring: a
 * `for…of` over a config array reads its iterator once more AFTER the last
 * body emission, and that trailing read drains onto whatever is emitted next
 * — normally the NEXT section's heading. The oracle above cannot always
 * separate this from an honest existence dependency, because validation
 * couples the two arrays. Locating the heading by content does.
 * ------------------------------------------------------------------ */

/** The range covering the line that contains `headingText`, with its paths. */
export function entryCoveringLine(
  path: GeneratePath,
  config: RWAConfig,
  filePath: string,
  headingText: string
): { readonly paths: readonly ConfigPath[]; readonly lines: readonly string[] } {
  const { files, provenance } = generateRecorded(path, config);
  const content = textOf(files, filePath);
  const lineNumber = content.split('\n').findIndex((line) => line.includes(headingText)) + 1;

  if (lineNumber === 0) {
    throw new Error(`"${filePath}" has no line containing ${JSON.stringify(headingText)}`);
  }

  const covering = rangeEntries(provenance, filePath).filter(
    (entry) => entry.range.start <= lineNumber && lineNumber <= entry.range.end
  );

  return {
    paths: covering.flatMap((entry) => entry.paths),
    lines: covering.flatMap((entry) => sliceRange(content, entry.range)),
  };
}
