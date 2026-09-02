/**
 * Golden-output byte-identity guard for the Stellar generator.
 *
 * Every file of every fixture, on both generate paths, must match the checked-in
 * golden byte for byte. Refreshing goldens after an intentional output change is
 * an explicit step, reviewed as a diff:
 *
 *   pnpm --filter @openzeppelin/codegen-rwa-stellar test:goldens:update
 *
 * The guard never rewrites a golden on mismatch, and a missing golden fails —
 * locally as well as under `CI` — unless the run is an explicit update (`-u`),
 * so a new fixture or a new emitted file cannot pass green without its golden
 * being written on purpose and reviewed as a diff.
 */
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { GenerationResult } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { generate, generateWithIdentitySupport } from '../../src/index';
import {
  BASELINE_FIXTURE_NAME,
  CONFIG_DIMENSIONS,
  dimensionsDifferingFromBaseline,
  GOLDEN_FIXTURES,
  PREVIEW_FILLED_EMPTY_DRAFT_FIXTURE_NAME,
  type GoldenFixture,
} from './fixtures';

interface GeneratePath {
  readonly name: string;
  readonly run: (config: RWAConfig) => GenerationResult;
}

const GENERATE_PATHS: readonly GeneratePath[] = [
  { name: 'generate', run: (config) => generate(config) },
  { name: 'generate-with-identity-support', run: (config) => generateWithIdentitySupport(config) },
];

/**
 * Where the goldens live. `RWA_STELLAR_GOLDENS_DIR` exists only so the guard's
 * own tests (`golden-guard.meta.test.ts`) can run this file against a mutated
 * scratch copy and prove it fails; nothing else sets it.
 */
const GOLDENS_DIR =
  process.env.RWA_STELLAR_GOLDENS_DIR === undefined
    ? join(dirname(fileURLToPath(import.meta.url)), '__goldens__')
    : resolve(process.env.RWA_STELLAR_GOLDENS_DIR);
const MANIFEST_SUFFIX = '.manifest.txt';

function goldenPath(path: GeneratePath, fixture: GoldenFixture, filePath: string): string {
  return join(GOLDENS_DIR, path.name, fixture.name, filePath);
}

function manifestPath(path: GeneratePath, fixture: GoldenFixture): string {
  return join(GOLDENS_DIR, path.name, `${fixture.name}${MANIFEST_SUFFIX}`);
}

function sortedFilePaths(result: GenerationResult): string[] {
  return Object.keys(result.files).sort();
}

/**
 * Refuse to let `toMatchFileSnapshot` create a golden as a side effect of a
 * plain run. Vitest writes missing file snapshots whenever its update mode is
 * `new` (the default outside CI); only an explicit `-u` (`all`) may create one.
 */
function assertGoldenPresent(target: string): void {
  if (existsSync(target)) return;
  const snapshotState = expect.getState().snapshotState as unknown as
    | { _updateSnapshot?: string }
    | undefined;
  if (snapshotState?._updateSnapshot === 'all') return;
  throw new Error(
    `missing golden ${relative(GOLDENS_DIR, target)} — run test:goldens:update to write it, then review the diff`
  );
}

function requireBaseline(): GoldenFixture {
  const baseline = GOLDEN_FIXTURES.find((fixture) => fixture.name === BASELINE_FIXTURE_NAME);
  if (baseline === undefined) {
    throw new Error(`fixture matrix has no "${BASELINE_FIXTURE_NAME}" fixture`);
  }
  return baseline;
}

describe('golden fixture matrix', () => {
  it('has unique fixture names', () => {
    const names = GOLDEN_FIXTURES.map((fixture) => fixture.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('includes the preview-filled empty draft', () => {
    expect(GOLDEN_FIXTURES.map((f) => f.name)).toContain(PREVIEW_FILLED_EMPTY_DRAFT_FIXTURE_NAME);
  });

  it.each(CONFIG_DIMENSIONS)('has at least one fixture varying %s', (dimension) => {
    expect(GOLDEN_FIXTURES.some((fixture) => fixture.varies === dimension)).toBe(true);
  });

  const variants = GOLDEN_FIXTURES.filter(
    (fixture): fixture is GoldenFixture & { varies: keyof RWAConfig } => fixture.varies !== null
  );

  it.each(variants.map((fixture) => [fixture.name, fixture] as const))(
    '%s differs from the baseline on its dimension and nowhere else',
    (_name, fixture) => {
      expect(dimensionsDifferingFromBaseline(fixture, requireBaseline())).toEqual([fixture.varies]);
    }
  );
});

describe.each(GENERATE_PATHS.map((path) => [path.name, path] as const))(
  'golden output · %s',
  (_pathName, path) => {
    for (const fixture of GOLDEN_FIXTURES) {
      // Generated at collection time so each emitted file is its own test and a
      // failure names both the fixture and the file.
      const result = path.run(fixture.config);
      const filePaths = sortedFilePaths(result);

      describe(fixture.name, () => {
        it('emits the recorded file set', async () => {
          assertGoldenPresent(manifestPath(path, fixture));
          await expect(`${filePaths.join('\n')}\n`).toMatchFileSnapshot(
            manifestPath(path, fixture)
          );
        });

        it.each(filePaths)('%s is byte-identical to its golden', async (filePath) => {
          const content = result.files[filePath];
          if (typeof content !== 'string') {
            throw new Error(
              `${path.name}/${fixture.name}/${filePath} is binary; the guard only records text output`
            );
          }
          assertGoldenPresent(goldenPath(path, fixture, filePath));
          await expect(content).toMatchFileSnapshot(goldenPath(path, fixture, filePath));
        });
      });
    }

    it('has no golden directory or manifest for a fixture that no longer exists', () => {
      // Missing entries are caught by the manifest test (and by CI refusing to write
      // snapshots); this test only catches leftovers a rename or removal left behind.
      const pathDir = join(GOLDENS_DIR, path.name);
      const expected = new Set(
        GOLDEN_FIXTURES.flatMap((fixture) => [fixture.name, `${fixture.name}${MANIFEST_SUFFIX}`])
      );
      const actual = existsSync(pathDir) ? readdirSync(pathDir) : [];

      const orphans = actual.filter((entry) => !expected.has(entry));
      expect(orphans, `golden entries for unknown fixtures:\n${orphans.join('\n')}`).toEqual([]);
    });

    it('has no golden file that the generator no longer emits', () => {
      // A file the generator stopped emitting is caught by the manifest test, but
      // its golden would otherwise linger and silently stop being compared. Walk
      // every fixture directory and require each file to be in the emitted set.
      const stale: string[] = [];
      for (const fixture of GOLDEN_FIXTURES) {
        const fixtureDir = join(GOLDENS_DIR, path.name, fixture.name);
        if (!existsSync(fixtureDir)) {
          continue;
        }
        const emitted = new Set(sortedFilePaths(path.run(fixture.config)));
        for (const entry of readdirSync(fixtureDir, { recursive: true, withFileTypes: true })) {
          if (!entry.isFile()) {
            continue;
          }
          const filePath = relative(fixtureDir, join(entry.parentPath, entry.name));
          if (!emitted.has(filePath)) {
            stale.push(`${path.name}/${fixture.name}/${filePath}`);
          }
        }
      }

      expect(stale, `goldens with no emitted counterpart:\n${stale.join('\n')}`).toEqual([]);
    });
  }
);
