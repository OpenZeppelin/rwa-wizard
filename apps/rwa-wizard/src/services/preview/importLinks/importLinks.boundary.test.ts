import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const IMPORT_LINKS_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Every non-test source in the directory, read from disk rather than listed by
 * hand: a hand-maintained list silently stops covering files added later.
 */
function importLinksSources(): string[] {
  return readdirSync(IMPORT_LINKS_DIR).filter(
    (file) => /\.tsx?$/.test(file) && !file.includes('.test.')
  );
}

function readSource(file: string): string {
  return readFileSync(join(IMPORT_LINKS_DIR, file), 'utf8');
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

/**
 * Words that only make sense if this module knows which ecosystem it is
 * decorating. Chain names and package-manager nouns are the obvious ones; the
 * language name and its import keyword matter just as much, because both used
 * to be written here — a `stellar_*` identifier pattern, a map of crate names
 * to upstream directories, and a helper that knew a Rust import line starts
 * with `use`. All three are now reported by the codegen package, so the module
 * can be pointed at any generator's output. Constitution §I.
 */
const CHAIN_VOCABULARY = [
  'stellar',
  'soroban',
  'crate',
  'cargo',
  'rust',
  'solidity',
  'evm',
] as const;

describe('importLinks package boundary (INV-11, INV-12, INV-13)', () => {
  it('does not import @openzeppelin/codegen-rwa-stellar (INV-11)', () => {
    const violations: string[] = [];
    for (const file of importLinksSources()) {
      const hits = readSource(file)
        .split('\n')
        .filter((line) => FORBIDDEN_CODEGEN_IMPORT.test(line));
      if (hits.length > 0) {
        violations.push(`${file}: ${hits.map((line) => line.trim()).join(' | ')}`);
      }
    }
    expect(
      violations,
      'INV-11: link targets arrive through the codegen service seam, not a direct package import'
    ).toEqual([]);
  });

  it('does not reference codegen revision snapshot symbols (INV-12)', () => {
    const violations: string[] = [];
    for (const file of importLinksSources()) {
      const source = readSource(file);
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
    for (const file of importLinksSources()) {
      const source = readSource(file);
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

  it('carries no chain, language or package-manager vocabulary (INV-13, §I)', () => {
    const violations: string[] = [];
    for (const file of importLinksSources()) {
      const source = readSource(file).toLowerCase();
      for (const term of CHAIN_VOCABULARY) {
        if (new RegExp(`\\b${term}`).test(source)) {
          violations.push(`${file}: mentions "${term}"`);
        }
      }
    }
    expect(
      violations,
      '§I: identifiers, upstream paths and import syntax are the codegen package\u2019s to report'
    ).toEqual([]);
  });
});
