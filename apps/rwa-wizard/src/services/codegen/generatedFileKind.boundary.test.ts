import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { GENERATED_FILE_KINDS } from '@openzeppelin/codegen-rwa-stellar';

import { isStructuralGeneratedFileKind } from '../../types/wizard';

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const HERE = dirname(fileURLToPath(import.meta.url));

const LANGUAGE_FOR_PATH = join(SRC_ROOT, 'features/code-preview/languageForPath.ts');
const LOADER = join(SRC_ROOT, 'services/codegen/codegenLoader.ts');
const TEST_DOUBLE = join(HERE, 'testCodegenService.ts');
const CONTRACT = join(
  SRC_ROOT,
  '../../../specs/002-wizard-ui-shell/contracts/codegen-service-contract.md'
);

function walkSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'test') continue;
      out.push(...walkSourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    if (entry.endsWith('.test.ts') || entry.endsWith('.test.tsx')) continue;
    out.push(full);
  }
  return out;
}

/** Ranking-adjacent app source: feature preview, preview services, codegen except the loader. */
function rankingAdjacentSources(): string[] {
  const dirs = [
    join(SRC_ROOT, 'features/code-preview'),
    join(SRC_ROOT, 'services/preview'),
    join(SRC_ROOT, 'services/codegen'),
  ];
  return dirs
    .flatMap((dir) => walkSourceFiles(dir))
    .filter((file) => file !== LOADER && file !== LANGUAGE_FOR_PATH);
}

const SUFFIX_HEURISTIC =
  /\.endsWith\(\s*['"]\.(?:rs|sh|md|json|toml)['"]|\.includes\(\s*['"]\.(?:rs|sh)['"]/;

describe('generated file kind closed set (INV-2)', () => {
  it('lists the same four members on the package and the app, including unknown', () => {
    expect([...GENERATED_FILE_KINDS]).toEqual([
      'contract',
      'script',
      'provenance-and-docs',
      'unknown',
    ]);
    for (const kind of GENERATED_FILE_KINDS) {
      expect(isStructuralGeneratedFileKind(kind), kind).toBe(true);
    }
    expect(isStructuralGeneratedFileKind('manifest')).toBe(false);
    expect(isStructuralGeneratedFileKind('Contract')).toBe(false);
    expect(isStructuralGeneratedFileKind('')).toBe(false);
  });
});

describe('generated file kind auth boundary (INV-6, INV-7, INV-8, INV-10, INV-14)', () => {
  it('does not recover ranking kinds from filenames (INV-8)', () => {
    const violations: string[] = [];
    for (const file of rankingAdjacentSources()) {
      const hits = readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => SUFFIX_HEURISTIC.test(line));
      if (hits.length === 0) continue;
      violations.push(
        `${relative(SRC_ROOT, file)}: ${hits.map((line) => line.trim()).join(' | ')}`
      );
    }
    expect(
      violations,
      'INV-8: ranking kinds come from the service, not path.endsWith / suffix maps. languageForPath.ts is excluded because it maps extensions to CodeView grammars, not kinds'
    ).toEqual([]);
  });

  it('does not wrap the kinds call in try/catch (INV-6)', () => {
    const source = readFileSync(LOADER, 'utf8');
    const start = source.indexOf('getGeneratedFileKind: pkg.getGeneratedFileKind');
    const end = source.indexOf('getCodegenInfoBlurb:', start);
    expect(start, 'kinds wrap must exist').toBeGreaterThanOrEqual(0);
    expect(end, 'kinds wrap must be followed by the next method').toBeGreaterThan(start);
    const wrap = source.slice(start, end);
    expect(wrap, 'INV-6: a package throw is a package bug; do not catch it here').not.toMatch(
      /\btry\b/
    );
    expect(wrap).not.toMatch(/\bcatch\b/);
  });

  it('does not cache kinds on the loader wrap (INV-7)', () => {
    const source = readFileSync(LOADER, 'utf8');
    const start = source.indexOf('getGeneratedFileKind: pkg.getGeneratedFileKind');
    const end = source.indexOf('getCodegenInfoBlurb:', start);
    const wrap = source.slice(start, end);
    expect(wrap).not.toMatch(/\buseRef\b/);
    expect(wrap).not.toMatch(/\bmemo\s*\(/);
    expect(wrap).not.toMatch(/\bcache\b/i);
  });

  it('does not hardcode Stellar paths as kind keys in the test double (INV-10)', () => {
    const source = readFileSync(TEST_DOUBLE, 'utf8');
    expect(source, 'INV-10: no rwa-token kind key').not.toMatch(/rwa-token/);
    expect(source, 'INV-10: no deploy.sh kind key').not.toMatch(/deploy\.sh/);
    expect(source, 'INV-10: no config.json kind key').not.toMatch(/config\.json/);
  });

  it('documents the optional method on the codegen service contract (INV-14)', () => {
    const contract = readFileSync(CONTRACT, 'utf8');
    expect(contract).toMatch(/getGeneratedFileKind\?/);
    expect(contract).toContain('contract');
    expect(contract).toContain('script');
    expect(contract).toContain('provenance-and-docs');
    expect(contract).toContain('unknown');
    expect(contract).toMatch(/does not drop the file/);
  });
});
