import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createValidConfig } from './helpers/config';

import { CRATE_NAMES } from '../src/constants';
import type { GeneratedFileKind } from '../src/generated-file-kinds';
import {
  generate,
  GENERATED_FILE_KINDS,
  generateWithIdentitySupport,
  getAvailableModules,
  getGeneratedFileKind,
  IDENTITY_SUPPORT_CONTRACTS,
  SIGN_CLAIM_TOOL,
} from '../src/index';

const GENERATE_OPTIONS = { allowUnderReviewModules: true } as const;

type RankedGeneratedFileKind = Exclude<GeneratedFileKind, 'unknown'>;

/**
 * Expected ranking paths, rebuilt from the same generator constants the
 * classifier uses. Independent of `generated-file-kinds.ts` so a suffix
 * heuristic there cannot hide behind a shared helper.
 */
function expectedRankingCatalog(): ReadonlyMap<string, RankedGeneratedFileKind> {
  const catalog = new Map<string, RankedGeneratedFileKind>();

  const crateDirs = [
    ...Object.values(CRATE_NAMES).map((name) => `contracts/${name}`),
    ...getAvailableModules().map((entry) => `contracts/modules/${entry.crateName}`),
    ...IDENTITY_SUPPORT_CONTRACTS.map((contract) => contract.dirPath),
  ];

  for (const dirPath of crateDirs) {
    catalog.set(`${dirPath}/src/contract.rs`, 'contract');
    catalog.set(`${dirPath}/src/lib.rs`, 'contract');
  }

  catalog.set('scripts/build.sh', 'script');
  catalog.set('scripts/deploy.sh', 'script');
  catalog.set('scripts/bootstrap-demo-mint.sh', 'script');
  catalog.set('config.json', 'provenance-and-docs');
  catalog.set('README.md', 'provenance-and-docs');
  catalog.set('UNDER_REVIEW_MODULES.md', 'provenance-and-docs');

  return catalog;
}

function leftoverExactPaths(): ReadonlySet<string> {
  const leftover = new Set<string>(['Cargo.toml', 'rustfmt.toml']);
  const crateDirs = [
    ...Object.values(CRATE_NAMES).map((name) => `contracts/${name}`),
    ...getAvailableModules().map((entry) => `contracts/modules/${entry.crateName}`),
    ...IDENTITY_SUPPORT_CONTRACTS.map((contract) => contract.dirPath),
  ];
  for (const dirPath of crateDirs) {
    leftover.add(`${dirPath}/Cargo.toml`);
  }
  return leftover;
}

function isLeftoverPath(path: string): boolean {
  if (leftoverExactPaths().has(path)) return true;
  const toolRoot = SIGN_CLAIM_TOOL.dirPath;
  return path === toolRoot || path.startsWith(`${toolRoot}/`);
}

function configWithAllModules() {
  return createValidConfig({
    compliance: {
      modules: getAvailableModules().map((entry) => ({
        moduleId: entry.id,
        config: Object.fromEntries(
          entry.configFields
            .filter((field) => field.required)
            .map((field) => [
              field.key,
              field.type === 'number' ? 1 : field.type === 'string[]' ? ['US'] : '1',
            ])
        ),
      })),
    },
  });
}

/**
 * `getGeneratedFileKind` exists so a consumer can rank generated paths without
 * learning this generator's layout. That only holds while the reported kinds
 * describe what `generate` / `generateWithIdentitySupport` actually emit, so
 * the cases below check the export against generated output rather than
 * against a fixture.
 */
describe('getGeneratedFileKind', () => {
  const ranking = expectedRankingCatalog();

  it('returns a closed-set member for every path generate() emits', () => {
    const files = generate(configWithAllModules(), GENERATE_OPTIONS).files;
    expect(Object.keys(files).length, 'the fixture must emit a project').toBeGreaterThan(0);

    for (const path of Object.keys(files)) {
      expect(GENERATED_FILE_KINDS, `emitted path ${path}`).toContain(getGeneratedFileKind(path));
    }
  });

  it('returns a closed-set member for every path generateWithIdentitySupport() emits', () => {
    const files = generateWithIdentitySupport(configWithAllModules(), GENERATE_OPTIONS).files;
    expect(Object.keys(files).length, 'the fixture must emit a project').toBeGreaterThan(0);
    expect(
      files,
      'demo-mint script must be present when identity support can emit it'
    ).toHaveProperty('scripts/bootstrap-demo-mint.sh');

    for (const path of Object.keys(files)) {
      expect(GENERATED_FILE_KINDS, `emitted path ${path}`).toContain(getGeneratedFileKind(path));
    }
  });

  it('classifies ranking emit sites from generator constants, never as unknown', () => {
    for (const [path, kind] of ranking) {
      expect(getGeneratedFileKind(path), path).toBe(kind);
    }
  });

  it('classifies leftover emitted paths as unknown and fails on a new unclassified emit site', () => {
    const files = generateWithIdentitySupport(configWithAllModules(), GENERATE_OPTIONS).files;

    for (const path of Object.keys(files)) {
      const kind = getGeneratedFileKind(path);
      const ranked = ranking.get(path);
      if (ranked !== undefined) {
        expect(kind, path).toBe(ranked);
        continue;
      }

      expect(
        isLeftoverPath(path),
        `emitted path ${path} is neither a ranking site nor leftover (Cargo.toml / rustfmt.toml / per-crate Cargo.toml / ${SIGN_CLAIM_TOOL.dirPath}/**)`
      ).toBe(true);
      expect(kind, path).toBe('unknown');
    }
  });

  it('pins Specify AS-1 named examples without hardcoding a module folder', () => {
    expect(getGeneratedFileKind('config.json')).toBe('provenance-and-docs');
    expect(getGeneratedFileKind('README.md')).toBe('provenance-and-docs');
    expect(getGeneratedFileKind('scripts/deploy.sh')).toBe('script');
    expect(getGeneratedFileKind(`contracts/${CRATE_NAMES.rwaToken}/src/contract.rs`)).toBe(
      'contract'
    );

    const [module] = getAvailableModules();
    expect(module, 'registry must have at least one module').toBeDefined();
    expect(getGeneratedFileKind(`contracts/modules/${module!.crateName}/src/contract.rs`)).toBe(
      'contract'
    );
    expect(getGeneratedFileKind(`contracts/modules/${module!.crateName}/src/lib.rs`)).toBe(
      'contract'
    );
  });

  it('classifies identity-support ranking paths even when this tree did not emit them', () => {
    const baseline = generate(createValidConfig(), GENERATE_OPTIONS).files;
    expect(baseline).not.toHaveProperty('scripts/bootstrap-demo-mint.sh');
    expect(getGeneratedFileKind('scripts/bootstrap-demo-mint.sh')).toBe('script');
    expect(getGeneratedFileKind('UNDER_REVIEW_MODULES.md')).toBe('provenance-and-docs');
  });

  it('does not normalize ZIP prefixes, leading slashes, or ./ (INV-3)', () => {
    expect(getGeneratedFileKind('README.md')).toBe('provenance-and-docs');
    expect(getGeneratedFileKind('./README.md')).toBe('unknown');
    expect(getGeneratedFileKind('/README.md')).toBe('unknown');
    expect(getGeneratedFileKind('mtk-rwa/README.md')).toBe('unknown');
    expect(getGeneratedFileKind('')).toBe('unknown');
  });

  it('pins config.json and README.md as provenance-and-docs because both change on every field (INV-1)', () => {
    expect(getGeneratedFileKind('config.json')).toBe('provenance-and-docs');
    expect(getGeneratedFileKind('README.md')).toBe('provenance-and-docs');
  });

  it('keeps Cargo.toml and the sign-claim tool as unknown, not provenance (INV-1)', () => {
    const signClaimMain = `${SIGN_CLAIM_TOOL.dirPath}/src/main.rs`;
    const crateManifest = `contracts/${CRATE_NAMES.rwaToken}/Cargo.toml`;

    expect(getGeneratedFileKind('Cargo.toml'), 'workspace manifest').toBe('unknown');
    expect(getGeneratedFileKind('Cargo.toml')).not.toBe('provenance-and-docs');
    expect(getGeneratedFileKind(crateManifest), 'crate manifest').toBe('unknown');
    expect(getGeneratedFileKind(crateManifest)).not.toBe('provenance-and-docs');
    expect(getGeneratedFileKind(signClaimMain), 'native helper is not a deploy script').toBe(
      'unknown'
    );
    expect(getGeneratedFileKind(signClaimMain)).not.toBe('provenance-and-docs');
    expect(getGeneratedFileKind(signClaimMain)).not.toBe('contract');
    expect(getGeneratedFileKind(signClaimMain)).not.toBe('script');
  });

  it('returns the same kind for two calls with the same path (INV-7)', () => {
    const path = `contracts/${CRATE_NAMES.rwaToken}/src/contract.rs`;
    expect(getGeneratedFileKind(path)).toEqual(getGeneratedFileKind(path));
  });

  it('lists the closed four-member set including unknown (INV-2)', () => {
    expect([...GENERATED_FILE_KINDS]).toEqual([
      'contract',
      'script',
      'provenance-and-docs',
      'unknown',
    ]);
  });

  it('never returns null or undefined, including on garbage paths (INV-2, INV-6)', () => {
    for (const path of ['', './README.md', '/README.md', 'mtk-rwa/README.md', 'no-such-file']) {
      expect(() => getGeneratedFileKind(path), path).not.toThrow();
      const kind = getGeneratedFileKind(path);
      expect(kind, path).not.toBeNull();
      expect(kind, path).not.toBeUndefined();
      expect(GENERATED_FILE_KINDS, path).toContain(kind);
      expect(kind, path).toBe('unknown');
    }
  });
});

describe('getGeneratedFileKind emit-site correspondence (INV-1)', () => {
  it('claims only paths the generator can emit, leftover set exact', () => {
    const ranking = expectedRankingCatalog();
    const leftover = leftoverExactPaths();
    const baseline = generate(configWithAllModules(), GENERATE_OPTIONS).files;
    const identity = generateWithIdentitySupport(configWithAllModules(), GENERATE_OPTIONS).files;
    const emittable = new Set([...Object.keys(baseline), ...Object.keys(identity)]);

    expect(emittable.size, 'the fixture must emit a project').toBeGreaterThan(0);

    for (const [path, kind] of ranking) {
      if (path === 'UNDER_REVIEW_MODULES.md') continue;
      expect(
        emittable.has(path),
        `catalog claims ${path} as ${kind} but neither generate() nor generateWithIdentitySupport() emits it`
      ).toBe(true);
    }

    const unclassified = Object.keys(identity).filter((path) => !ranking.has(path));
    for (const path of unclassified) {
      expect(
        isLeftoverPath(path),
        `emitted path ${path} is neither a ranking site nor leftover`
      ).toBe(true);
    }

    expect(
      Object.keys(identity)
        .filter((path) => leftover.has(path))
        .sort(),
      'leftoverExactPaths must equal the emitted leftover list, not a dumping ground of unused entries'
    ).toEqual([...leftover].sort());

    for (const path of leftover) {
      expect(getGeneratedFileKind(path), path).toBe('unknown');
    }
  });
});

const KINDS_SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/generated-file-kinds.ts'),
  'utf8'
);

describe('generated-file-kinds.ts source shape (INV-7, INV-8, INV-12)', () => {
  it('does not classify by suffix or CRATE_NAMES string literals (INV-8)', () => {
    expect(KINDS_SOURCE, 'no .endsWith heuristic').not.toMatch(/\.endsWith\s*\(/);
    expect(KINDS_SOURCE, 'no .includes(".rs") heuristic').not.toMatch(
      /\.includes\(\s*['"]\.rs['"]/
    );
    expect(KINDS_SOURCE, 'no .includes(".sh") heuristic').not.toMatch(
      /\.includes\(\s*['"]\.sh['"]/
    );

    const crateNameLiterals = Object.values(CRATE_NAMES).filter((name) =>
      new RegExp(`['"]${name}['"]`).test(KINDS_SOURCE)
    );
    expect(
      crateNameLiterals,
      'crate dirs must come from CRATE_NAMES values, not duplicated string literals'
    ).toEqual([]);
  });

  it('has no cache, memo, or useRef (INV-7)', () => {
    expect(KINDS_SOURCE).not.toMatch(/\buseRef\b/);
    expect(KINDS_SOURCE).not.toMatch(/\bmemo\s*\(/);
    expect(KINDS_SOURCE).not.toMatch(/\bcache\b/i);
  });

  it('looks up a module-level map and does not generate per call (INV-12)', () => {
    expect(KINDS_SOURCE.match(/new Map/g)?.length, 'one catalog Map at module load').toBe(1);

    const fnStart = KINDS_SOURCE.indexOf('export function getGeneratedFileKind');
    expect(fnStart, 'getGeneratedFileKind must exist').toBeGreaterThanOrEqual(0);
    const fnSource = KINDS_SOURCE.slice(fnStart);
    expect(fnSource).toMatch(/GENERATED_FILE_KIND_CATALOG\.get\(path\)/);
    expect(fnSource, 'lookup must not rebuild the map').not.toMatch(/new Map/);
    expect(fnSource, 'lookup must not call generate').not.toMatch(
      /\bgenerateWithIdentitySupport\b/
    );
  });
});

describe('classification does not mutate generate output (INV-11)', () => {
  it('leaves GenerationResult.files keys and contents unchanged', () => {
    const result = generate(createValidConfig(), GENERATE_OPTIONS);
    const beforeKeys = Object.keys(result.files).sort();
    const beforeContents = { ...result.files };

    for (const path of beforeKeys) {
      getGeneratedFileKind(path);
    }

    expect(Object.keys(result.files).sort()).toEqual(beforeKeys);
    expect(result.files).toEqual(beforeContents);
    expect(result, 'kinds are a sibling reporter, not generate metadata').not.toHaveProperty(
      'kinds'
    );
    expect(result).not.toHaveProperty('fileKinds');
  });
});
