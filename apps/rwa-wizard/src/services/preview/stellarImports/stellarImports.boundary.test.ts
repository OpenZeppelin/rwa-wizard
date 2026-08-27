import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { STELLAR_CRATE_REPO_PATHS } from './stellarCratePaths';

const STELLAR_IMPORTS_DIR = dirname(fileURLToPath(import.meta.url));

const STELLAR_IMPORTS_SOURCES = [
  'buildStellarCrateUrl.ts',
  'createStellarImportDecorator.tsx',
  'index.ts',
  'matchStellarCratesInText.ts',
  'parseStellarSourceRevision.ts',
  'stellarCratePaths.ts',
  'types.ts',
] as const;

const FORBIDDEN_CODEGEN_IMPORT =
  /(?:from\s+|import\s*\(\s*)['"]@openzeppelin\/codegen-rwa-stellar['"]/;

const FORBIDDEN_REVISION_SYMBOLS = [
  'GENERATED_STELLAR_SOURCE_COMMIT_HASH',
  'GENERATED_STELLAR_SOURCE_REPO_URL',
  'GENERATED_STELLAR_SOURCE_SYNCED_AT',
] as const;

describe('stellarImports package boundary (INV-11, INV-12, INV-13)', () => {
  it('does not import @openzeppelin/codegen-rwa-stellar (INV-11)', () => {
    const violations: string[] = [];
    for (const file of STELLAR_IMPORTS_SOURCES) {
      const source = readFileSync(join(STELLAR_IMPORTS_DIR, file), 'utf8');
      const hits = source.split('\n').filter((line) => FORBIDDEN_CODEGEN_IMPORT.test(line));
      if (hits.length > 0) {
        violations.push(`${file}: ${hits.map((line) => line.trim()).join(' | ')}`);
      }
    }
    expect(
      violations,
      'INV-11: revision must come from the preview tree, not the codegen package seam'
    ).toEqual([]);
  });

  it('does not reference codegen revision snapshot symbols (INV-12)', () => {
    const violations: string[] = [];
    for (const file of STELLAR_IMPORTS_SOURCES) {
      const source = readFileSync(join(STELLAR_IMPORTS_DIR, file), 'utf8');
      for (const symbol of FORBIDDEN_REVISION_SYMBOLS) {
        if (source.includes(symbol)) {
          violations.push(`${file}: references forbidden symbol ${symbol}`);
        }
      }
    }
    expect(
      violations,
      'INV-12: hyperlink targets must never reuse codegen snapshot constants'
    ).toEqual([]);
  });

  it('owns the four-crate map only in stellarCratePaths.ts (INV-13)', () => {
    expect(Object.keys(STELLAR_CRATE_REPO_PATHS)).toEqual([
      'stellar_access',
      'stellar_tokens',
      'stellar_macros',
      'stellar_contract_utils',
    ]);
    expect(STELLAR_CRATE_REPO_PATHS.stellar_access).toBe('packages/access');
    expect(STELLAR_CRATE_REPO_PATHS.stellar_tokens).toBe('packages/tokens');
    expect(STELLAR_CRATE_REPO_PATHS.stellar_macros).toBe('packages/macros');
    expect(STELLAR_CRATE_REPO_PATHS.stellar_contract_utils).toBe('packages/contract-utils');
  });
});
