import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { stellarPreviewCatalog } from '../../test/helpers/previewConfig';
import { createDefaultRwaConfig } from '../../utils/defaultRwaConfig';
import { toPreviewConfig } from '../preview';
import { loadCodegenService } from './codegenLoader';
import type { RwaCodegenService } from './types';

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

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

const STELLAR_PACKAGE_IMPORT =
  /(?:from\s+|import\s*\(\s*)['"]@openzeppelin\/codegen-rwa-stellar['"]/;

describe('generateFileTree auth boundary (INV-13, INV-14, INV-24)', () => {
  it('returns null for a non-stellar target and does not invent a service (INV-13)', async () => {
    const evm = await loadCodegenService('evm');
    expect(evm, 'INV-13: catalogued EVM must stay codegenService null').toBeNull();
    const unknown = await loadCodegenService('not-a-target');
    expect(unknown).toBeNull();
  });

  it('exposes generateFileTree on the stellar wrapper (INV-13, INV-24)', async () => {
    const service = await loadCodegenService('stellar');
    expect(service).not.toBeNull();
    expect(typeof service!.generateFileTree).toBe('function');
  });

  it('does not import package generate APIs outside codegenLoader.ts (INV-14)', () => {
    const loader = join(SRC_ROOT, 'services/codegen/codegenLoader.ts');
    const violations: string[] = [];
    for (const file of walkSourceFiles(SRC_ROOT)) {
      if (file === loader) continue;
      const source = readFileSync(file, 'utf8');
      const importLines = source.split('\n').filter((line) => STELLAR_PACKAGE_IMPORT.test(line));
      if (importLines.length === 0) continue;
      violations.push(
        `${relative(SRC_ROOT, file)}: ${importLines.map((line) => line.trim()).join(' | ')}`
      );
    }
    expect(
      violations,
      'INV-14: only codegenLoader.ts may import @openzeppelin/codegen-rwa-stellar in app source'
    ).toEqual([]);
  });

  it('does not import GENERATED_FILE_KINDS or getGeneratedFileKind from stellar outside the loader (INV-9)', () => {
    const loader = join(SRC_ROOT, 'services/codegen/codegenLoader.ts');
    const violations: string[] = [];
    for (const file of walkSourceFiles(SRC_ROOT)) {
      if (file === loader) continue;
      const source = readFileSync(file, 'utf8');
      const importLines = source.split('\n').filter((line) => {
        if (!STELLAR_PACKAGE_IMPORT.test(line)) return false;
        return (
          line.includes('GENERATED_FILE_KINDS') ||
          line.includes('getGeneratedFileKind') ||
          line.includes('GeneratedFileKind')
        );
      });
      if (importLines.length === 0) continue;
      violations.push(
        `${relative(SRC_ROOT, file)}: ${importLines.map((line) => line.trim()).join(' | ')}`
      );
    }
    expect(
      violations,
      'INV-9: kinds reach the app through the loader seam, not a stellar type import'
    ).toEqual([]);
  });

  it('exposes getGeneratedFileKind on the stellar wrapper (INV-14)', async () => {
    const service = await loadCodegenService('stellar');
    expect(service).not.toBeNull();
    expect(typeof service!.getGeneratedFileKind).toBe('function');
  });
});

describe('hosts embed via RwaCodegenService (INV-24)', () => {
  it('does not export a module-level generateFileTree that bypasses the wrapper', () => {
    const indexSource = readFileSync(join(SRC_ROOT, 'services/codegen/index.ts'), 'utf8');
    expect(
      /export\s+async\s+function\s+generateFileTree/.test(indexSource) ||
        /export\s+\{[^}]*\bgenerateFileTree\b/.test(indexSource),
      'INV-24: preview must go through RwaCodegenService, not a stellar singleton'
    ).toBe(false);
  });

  it('lets a second host call generateFileTree through an injected service (INV-24)', async () => {
    const service = await loadCodegenService('stellar');
    const { config } = toPreviewConfig(createDefaultRwaConfig(), stellarPreviewCatalog());
    async function secondHostPreview(injected: RwaCodegenService) {
      return injected.generateFileTree(config);
    }
    const artifact = await secondHostPreview(service!);
    expect(artifact.files).toBeTypeOf('object');
    expect(Object.keys(artifact.files).length).toBeGreaterThan(0);
  });

  it('lets a second host classify through an injected service (INV-14)', async () => {
    const service = await loadCodegenService('stellar');
    function secondHostKind(injected: RwaCodegenService, path: string) {
      return injected.getGeneratedFileKind?.(path) ?? 'unknown';
    }
    expect(secondHostKind(service!, 'config.json')).toBe('provenance-and-docs');
    expect(secondHostKind(service!, 'Cargo.toml')).toBe('unknown');
  });
});
