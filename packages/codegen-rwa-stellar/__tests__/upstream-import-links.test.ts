import { describe, expect, it } from 'vitest';

import { generate, getUpstreamImportLinks } from '../src/index';
import { generateWorkspaceToml } from '../src/templates/cargo/workspace-toml';
import { createValidConfig } from './helpers/config';

const GENERATE_OPTIONS = { allowUnderReviewModules: true, includeIdentitySupport: true } as const;

function generatedRustSources(): string[] {
  const result = generate(createValidConfig(), GENERATE_OPTIONS);
  return Object.entries(result.files)
    .filter(([path]) => path.endsWith('.rs'))
    .map(([, content]) => (typeof content === 'string' ? content : ''));
}

function importedIdentifiers(source: string): string[] {
  return source
    .split('\n')
    .map((line) => line.trimStart())
    .filter((line) => line.startsWith(getUpstreamImportLinks().importLinePrefix))
    .flatMap((line) => line.match(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)*\b(?=::)/g) ?? []);
}

/**
 * `getUpstreamImportLinks` exists so a consumer can link the imports in
 * generated source to upstream without carrying its own copy of this map or
 * matching on this chain's naming. That only holds while the reported targets
 * describe what the generator actually emits, so the cases below check the
 * export against generated output rather than against a fixture.
 */
describe('getUpstreamImportLinks', () => {
  it('covers every upstream crate the generated sources import', () => {
    const links = getUpstreamImportLinks();
    const known = new Set(links.targets.map((target) => target.identifier));
    const upstreamPrefix = /^stellar_/;

    const imported = new Set(generatedRustSources().flatMap(importedIdentifiers));
    const upstreamImports = [...imported].filter((identifier) => upstreamPrefix.test(identifier));

    expect(upstreamImports.length, 'the fixture must exercise upstream imports').toBeGreaterThan(0);
    for (const identifier of upstreamImports) {
      expect(known, `generated source imports ${identifier}`).toContain(identifier);
    }
  });

  it('reports paths that match the crate locations the manifest resolves', () => {
    const contractsLibraryPath = '../stellar-contracts';
    const manifest = generateWorkspaceToml({
      members: ['contracts/rwa-token'],
      contractsLibraryPath,
    });

    for (const target of getUpstreamImportLinks().targets) {
      expect(manifest, `manifest must resolve ${target.identifier}`).toContain(
        `path = "${contractsLibraryPath}/${target.path}"`
      );
    }
  });

  it('describes the generated language and its import syntax', () => {
    const links = getUpstreamImportLinks();

    expect(links.language).toBe('rust');
    expect(links.importLinePrefix).toBe('use ');
    expect(links.targets.every((target) => !target.path.startsWith('/'))).toBe(true);
  });
});
