/**
 * SF-19 — `withoutRolesListRoot` unit + architectural pins.
 *
 * Every test title names the INV-N it verifies. The clear-members Addresses
 * oracle lives in `addresses-role-guard-oracle.test.ts`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import type { ConfigPath, Observed } from '@openzeppelin/codegen-core';

import {
  ACCESS_CONTROL_ROLES,
  withoutRolesListRoot,
} from '../../src/templates/contracts/rwa-token-roles';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_ROOT = join(PACKAGE_ROOT, '..', '..');
const RWA_TOKEN_FILE = join(
  PACKAGE_ROOT,
  'src',
  'templates',
  'contracts',
  'rwa-token.ts'
);
const ROLES_FILE = join(PACKAGE_ROOT, 'src', 'templates', 'contracts', 'rwa-token-roles.ts');
const STELLAR_SRC = join(PACKAGE_ROOT, 'src');
const STELLAR_INDEX = join(PACKAGE_ROOT, 'src', 'index.ts');
const CHANGESET = join(REPO_ROOT, '.changeset', 'quieter-addresses-role-guard.md');

const CHILD: ConfigPath = 'accessControl.roles[0].addresses';
const OTHER: ConfigPath = 'token.name';

function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTsFiles(full));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Request / Response — wrapper contract
// ---------------------------------------------------------------------------

describe('INV-2 — ACCESS_CONTROL_ROLES is the exact dialect literal', () => {
  it('equals accessControl.roles', () => {
    expect(ACCESS_CONTROL_ROLES).toBe('accessControl.roles');
  });
});

describe('INV-1 / INV-3 — withoutRolesListRoot is exact omit; children survive', () => {
  it('drops the list root and keeps child + unrelated paths; value by Object.is', () => {
    const value = { attr: '#[only_role(MINTER_ROLE, operator)]' };
    const observed: Observed<typeof value> = {
      value,
      paths: [ACCESS_CONTROL_ROLES, CHILD, OTHER],
    };

    const cleaned = withoutRolesListRoot(observed);

    expect(Object.is(cleaned.value, value)).toBe(true);
    expect(cleaned.paths).toEqual([CHILD, OTHER]);
  });

  it('identity no-op when the root is absent (SF-18 INV-3 via composition)', () => {
    const paths: readonly ConfigPath[] = [CHILD, OTHER];
    const observed: Observed<string> = { value: 'x', paths };
    const cleaned = withoutRolesListRoot(observed);
    expect(Object.is(cleaned.paths, paths)).toBe(true);
    expect(Object.is(cleaned.value, observed.value)).toBe(true);
  });
});

describe('INV-6 — wrapper never throws; no new error surface', () => {
  it.each([
    { label: 'empty paths', paths: [] as const },
    { label: 'absent root', paths: [CHILD] as const },
    { label: 'duplicate root', paths: [ACCESS_CONTROL_ROLES, ACCESS_CONTROL_ROLES, CHILD] as const },
    { label: 'malformed survivor', paths: [ACCESS_CONTROL_ROLES, 'a..b' as ConfigPath] as const },
  ])('$label completes without throw', ({ paths }) => {
    expect(() => withoutRolesListRoot({ value: 1, paths })).not.toThrow();
  });
});

describe('INV-14 — pure wrapper; no console / I/O', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not call console.* across a battery of wraps', () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined)
    );

    withoutRolesListRoot({ value: null, paths: [ACCESS_CONTROL_ROLES, CHILD] });
    withoutRolesListRoot({ value: null, paths: [CHILD] });
    withoutRolesListRoot({ value: null, paths: [] });

    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});

describe('INV-15 — paths-only; value is never walked', () => {
  it('succeeds when value is a throwing proxy (paths-only wrap)', () => {
    const value = new Proxy(
      {},
      {
        get() {
          throw new Error('value must not be accessed during omit');
        },
      }
    );
    expect(() =>
      withoutRolesListRoot({ value, paths: [ACCESS_CONTROL_ROLES, CHILD] })
    ).not.toThrow();
  });
});

describe('INV-22 — no module-level mutable state', () => {
  it('roles module declares only const for this feature surface', () => {
    const text = stripComments(readFileSync(ROLES_FILE, 'utf8'));
    // Feature surface: ACCESS_CONTROL_ROLES + withoutRolesListRoot. No let/var
    // caches, WeakSet, or scratch arrays reused across calls.
    expect(text).toMatch(/export const ACCESS_CONTROL_ROLES/);
    expect(text).toMatch(/export function withoutRolesListRoot/);
    const featureRegion = text.slice(
      text.indexOf('export const ACCESS_CONTROL_ROLES'),
      text.indexOf('export function withoutRolesListRoot') + 200
    );
    expect(featureRegion).not.toMatch(/\blet\b|\bvar\b|WeakSet|WeakMap/);
  });
});

describe('INV-1 type surface', () => {
  it('preserves Observed<T> in and out', () => {
    expectTypeOf(withoutRolesListRoot).parameter(0).toExtend<Observed<unknown>>();
    expectTypeOf(withoutRolesListRoot<string>).returns.toExtend<Observed<string>>();
  });
});

// ---------------------------------------------------------------------------
// Architectural — wrap inventory + whole-list keep
// ---------------------------------------------------------------------------

describe('INV-4 / INV-13 / INV-23 — every role-guard observe is wrapped', () => {
  it('rwa-token.ts wraps pauseGuard, tokenGuards, and documentManagerGuard', () => {
    const text = readFileSync(RWA_TOKEN_FILE, 'utf8');
    const bodyStart = text.indexOf('export function generateRwaTokenContractInScope');
    expect(bodyStart).toBeGreaterThanOrEqual(0);
    const body = text.slice(bodyStart);
    expect(body).toContain('withoutRolesListRoot');
    expect(body).toMatch(/const pauseGuard = withoutRolesListRoot\s*\(/);
    expect(body).toMatch(/withoutRolesListRoot\s*\(\s*patcher\.observe/);
    expect(body).toMatch(/const documentManagerGuard = withoutRolesListRoot\s*\(/);
    // observe → omit at assignment (not after patch apply)
    expect(body.indexOf('const pauseGuard')).toBeLessThan(body.indexOf('applyRwaTokenPatches'));
  });

  it('every buildAccessAttribute observe site is enclosed by withoutRolesListRoot', () => {
    const text = readFileSync(RWA_TOKEN_FILE, 'utf8');
    // Count observe→buildAccessAttribute / buildDocumentManagerAccessAttribute sites
    // vs withoutRolesListRoot calls that wrap them.
    const observeBuild = [
      ...text.matchAll(
        /patcher\.observe\(\(config\)\s*=>\s*build(?:DocumentManager)?AccessAttribute/g
      ),
    ];
    const wraps = [...text.matchAll(/withoutRolesListRoot\s*\(/g)];
    expect(
      observeBuild.length,
      'expected pause + tokenGuards map + document-manager observe sites'
    ).toBeGreaterThanOrEqual(3);
    expect(wraps.length).toBeGreaterThanOrEqual(observeBuild.length);
  });
});

describe('INV-5 / INV-11 — additionalRoles is not wrapped (whole-list honesty)', () => {
  it('getAdditionalRoles observe is not enclosed by withoutRolesListRoot', () => {
    const text = readFileSync(RWA_TOKEN_FILE, 'utf8');
    const additional = text.match(
      /const additionalRoles = [\s\S]*?;/
    );
    expect(additional).not.toBeNull();
    expect(additional![0]).toContain('getAdditionalRoles');
    expect(additional![0]).not.toContain('withoutRolesListRoot');
  });
});

describe('INV-18 — additive internal surface; not on package barrel', () => {
  it('changeset patch note exists for codegen-rwa-stellar', () => {
    expect(existsSync(CHANGESET)).toBe(true);
    const body = readFileSync(CHANGESET, 'utf8');
    expect(body).toMatch(/codegen-rwa-stellar/);
    expect(body.toLowerCase()).toMatch(/patch|provenance/);
  });

  it('src/index.ts does not re-export withoutRolesListRoot or ACCESS_CONTROL_ROLES', () => {
    const barrel = readFileSync(STELLAR_INDEX, 'utf8');
    expect(barrel).not.toContain('withoutRolesListRoot');
    expect(barrel).not.toContain('ACCESS_CONTROL_ROLES');
  });
});

describe('INV-20 — no EVM omit call sites in this package tree', () => {
  it('Stellar is the only chain pack under packages/ that imports omitExactConfigPath', () => {
    const packagesDir = join(REPO_ROOT, 'packages');
    const hits: string[] = [];
    for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === 'codegen-rwa-stellar' || entry.name === 'codegen-core') continue;
      const src = join(packagesDir, entry.name, 'src');
      if (!existsSync(src)) continue;
      for (const file of walkTsFiles(src)) {
        if (readFileSync(file, 'utf8').includes('omitExactConfigPath')) hits.push(file);
      }
    }
    expect(hits, `unexpected omitExactConfigPath outside Stellar/core: ${hits.join(', ')}`).toEqual(
      []
    );
  });
});

describe('INV-21 — Stellar src references omitExactConfigPath', () => {
  it('roles module imports omitExactConfigPath from codegen-core', () => {
    const text = readFileSync(ROLES_FILE, 'utf8');
    expect(text).toMatch(/import\s*\{[^}]*omitExactConfigPath[^}]*\}\s*from\s*'@openzeppelin\/codegen-core'/);
    expect(
      walkTsFiles(STELLAR_SRC).some((file) =>
        readFileSync(file, 'utf8').includes('omitExactConfigPath')
      )
    ).toBe(true);
  });
});
