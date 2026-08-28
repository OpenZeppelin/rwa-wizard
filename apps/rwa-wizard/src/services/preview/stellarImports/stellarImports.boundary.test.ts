import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { STELLAR_CRATE_REPO_PATHS } from './stellarCratePaths';

const STELLAR_IMPORTS_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Every non-test source in the directory, read from disk rather than listed by
 * hand: a hand-maintained list silently stops covering files added later.
 */
function stellarImportsSources(): string[] {
  return readdirSync(STELLAR_IMPORTS_DIR).filter(
    (file) => /\.tsx?$/.test(file) && !file.includes('.test.')
  );
}

const FORBIDDEN_CODEGEN_IMPORT =
  /(?:from\s+|import\s*\(\s*)['"]@openzeppelin\/codegen-rwa-stellar['"]/;

const FORBIDDEN_REVISION_SYMBOLS = [
  'GENERATED_STELLAR_SOURCE_COMMIT_HASH',
  'GENERATED_STELLAR_SOURCE_REPO_URL',
  'GENERATED_STELLAR_SOURCE_SYNCED_AT',
] as const;

/**
 * Generated-artifact names whose appearance here would mean the module is
 * reading facts back out of generated files. Constitution §I forbids that:
 * structural facts come from the codegen service, not from parsing its output.
 */
const FORBIDDEN_GENERATED_ARTIFACTS = ['Cargo.toml', 'README.md'] as const;

describe('stellarImports package boundary (INV-11, INV-12, INV-13)', () => {
  it('does not import @openzeppelin/codegen-rwa-stellar (INV-11)', () => {
    const violations: string[] = [];
    for (const file of stellarImportsSources()) {
      const source = readFileSync(join(STELLAR_IMPORTS_DIR, file), 'utf8');
      const hits = source.split('\n').filter((line) => FORBIDDEN_CODEGEN_IMPORT.test(line));
      if (hits.length > 0) {
        violations.push(`${file}: ${hits.map((line) => line.trim()).join(' | ')}`);
      }
    }
    expect(
      violations,
      'INV-11: the revision arrives through the codegen service seam, not a direct package import'
    ).toEqual([]);
  });

  it('does not reference codegen revision snapshot symbols (INV-12)', () => {
    const violations: string[] = [];
    for (const file of stellarImportsSources()) {
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

  it('does not read generated chain artifacts back (constitution §I)', () => {
    const violations: string[] = [];
    for (const file of stellarImportsSources()) {
      const source = readFileSync(join(STELLAR_IMPORTS_DIR, file), 'utf8');
      for (const artifact of FORBIDDEN_GENERATED_ARTIFACTS) {
        if (source.includes(artifact)) {
          violations.push(`${file}: parses generated ${artifact}`);
        }
      }
    }
    expect(
      violations,
      '§I: chain-specific parsing of generated files must not live in the UI'
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
