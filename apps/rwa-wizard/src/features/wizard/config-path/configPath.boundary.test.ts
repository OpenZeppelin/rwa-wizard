/**
 * SF-6 static boundary guards — INV-17 (module is stateless, side-effect free
 * and imports nothing chain- or service-shaped), INV-9 (no React state holds
 * a path), INV-15 (no memo fronts an index builder — the invariant is vacuous
 * only while this stays true), INV-12 (constant paths are literals).
 *
 * These read source with `node:fs`, following the repo's existing
 * `*.boundary.test.ts` precedent, because the property is about the code's
 * shape rather than its behaviour.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const WIZARD_ROOT = join(HERE, '..');
const SHARED_ROOT = join(HERE, '..', '..', '..', 'components', 'shared');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

const moduleFiles = walk(HERE);
const stepFiles = [...walk(join(WIZARD_ROOT, 'steps')), join(SHARED_ROOT, 'TopicToggleGroup.tsx')];
const read = (file: string): string => readFileSync(file, 'utf8');
const label = (file: string): string => relative(WIZARD_ROOT, file);

describe('INV-17: features/wizard/config-path is pure and import-clean', () => {
  it('ships the three documented source files and nothing else', () => {
    expect(moduleFiles.map((f) => relative(HERE, f)).sort()).toEqual([
      'configPath.ts',
      'configPathBuilders.ts',
      'index.ts',
    ]);
  });

  it.each(moduleFiles.map((f) => [relative(HERE, f), f]))(
    '%s imports only its documented dependencies',
    (_name, file) => {
      const source = read(file);
      const imports = Array.from(source.matchAll(/from\s+'([^']+)'/g)).map((m) => m[1] ?? '');
      for (const specifier of imports) {
        const allowed = specifier === '@openzeppelin/rwa-config' || specifier.startsWith('./');
        expect(allowed, `${_name} imports ${specifier}`).toBe(true);
      }
      expect(source).not.toMatch(
        /\breact\b|codegen-rwa-stellar|\/services\/|\/state\/|ui-components|ui-utils/
      );
    }
  );

  it.each(moduleFiles.map((f) => [relative(HERE, f), f]))(
    '%s has no state, logging, timers, subscriptions or I/O',
    (_name, file) => {
      const source = read(file);
      expect(source).not.toMatch(/\blogger\b|console\./);
      expect(source).not.toMatch(/useState|useRef|useEffect|useLayoutEffect|useMemo|useCallback/);
      expect(source).not.toMatch(/setTimeout|setInterval|requestAnimationFrame|addEventListener/);
      expect(source).not.toMatch(/\bfetch\(|localStorage|indexedDB|Dexie/);
      // Module-level mutable state: a top-level `let`.
      expect(source).not.toMatch(/^let\s/m);
    }
  );
});

describe('INV-9: no React state or ref in the wizard holds a ConfigPath', () => {
  it.each(stepFiles.map((f) => [label(f), f]))('%s', (_name, file) => {
    const source = read(file);
    expect(source).not.toMatch(/use(State|Ref)<[^>]*ConfigPath/);
    expect(source).not.toMatch(/use(State|Ref)\([^)]*Path\(/);
    // A path never enters an update payload.
    expect(source).not.toMatch(/onUpdate\([^)]*(Path\(|tokenPaths|ownershipTypePath)/);
  });
});

describe('INV-15: no memo fronts an index builder (recorded vacuous by the Code stage)', () => {
  const INDEX_BUILDERS = /\b(moduleIndex|roleIndex|claimTopicIndex|nextTrustedIssuerIndex)\(/;

  it.each(stepFiles.map((f) => [label(f), f]))(
    '%s calls index builders only outside useMemo',
    (_name, file) => {
      const source = read(file);
      for (const match of source.matchAll(
        /useMemo\(\s*\(\)\s*=>\s*([\s\S]*?)\n\s*\],?\s*\n?\s*\[[^\]]*\]\s*\)/g
      )) {
        expect(match[1] ?? '', `${_name}: useMemo body calls an index builder`).not.toMatch(
          INDEX_BUILDERS
        );
      }
      // `useCallback` closing over an index builder is a stable function, not a
      // cache; it must list the array it reads. Today only ClaimTopicsSection does.
      for (const match of source.matchAll(
        /useCallback\(\s*\(([^)]*)\)\s*=>\s*([\s\S]*?),\s*\n?\s*\[([^\]]*)\]\s*\)/g
      )) {
        const body = match[2] ?? '';
        const deps = match[3] ?? '';
        if (INDEX_BUILDERS.test(body)) {
          expect(
            deps.trim(),
            `${_name}: useCallback over an index builder must depend on the array`
          ).toMatch(
            /^(topics|identity\.claimTopics|selectedModules|accessControl\.roles|modules|roles)$/
          );
        }
      }
    }
  );
});

describe('INV-12: constant paths are literals, not computed', () => {
  it('tokenPaths and ownershipTypePath are quoted literals with no concatenation or interpolation', () => {
    const source = read(join(HERE, 'configPathBuilders.ts'));
    const tokenBlock = source.slice(
      source.indexOf('export const tokenPaths'),
      source.indexOf('satisfies')
    );
    expect(tokenBlock).toContain('Object.freeze(');
    expect(tokenBlock).not.toMatch(/\+|\$\{/);
    expect(source).toMatch(
      /export const ownershipTypePath = 'accessControl\.ownership\.type' satisfies ConfigPath;/
    );
  });
});
