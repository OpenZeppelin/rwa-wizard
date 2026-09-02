/**
 * SF-18 — `omitExactConfigPath` and hazard-5 docs pins.
 *
 * Organised by invariant category. Every test title names the INV-N it verifies.
 * Matching and builders stay out of this helper's job. SF-19 owns Stellar call
 * sites (INV-21 positive import pin) and the Addresses determination oracle.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import * as barrel from '../../src/index';
import {
  createLineBuilder,
  matchesConfigPath,
  omitExactConfigPath,
} from '../../src/provenance';
import type { ConfigPath } from '../../src/provenance';
import { createSpyScope } from './builder-fixtures';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_ROOT = join(PACKAGE_ROOT, '..', '..');
const PROVENANCE_DIR = join(PACKAGE_ROOT, 'src', 'provenance');
const OMIT_FILE = join(PROVENANCE_DIR, 'omit-config-path.ts');
const CONFIG_PATH_FILE = join(PROVENANCE_DIR, 'config-path.ts');
const HAZARDS_DOC = join(REPO_ROOT, 'docs', 'codegen-core', 'provenance', 'attribution-hazards.md');
const PROVENANCE_README = join(REPO_ROOT, 'docs', 'codegen-core', 'provenance', 'README.md');
const STELLAR_SRC = join(REPO_ROOT, 'packages', 'codegen-rwa-stellar', 'src');

const LIST_ROOT: ConfigPath = 'accessControl.roles';
const CHILD: ConfigPath = 'accessControl.roles[0].addresses';
const OTHER: ConfigPath = 'accessControl.ownership.type';

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

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

// ---------------------------------------------------------------------------
// Request / Response
// ---------------------------------------------------------------------------

describe('INV-1 — exact-string drop; survivors keep relative order', () => {
  it('AS-1: omit list root from [root, child, other] → [child, other]', () => {
    const paths: readonly ConfigPath[] = [LIST_ROOT, CHILD, OTHER];
    expect(omitExactConfigPath(paths, LIST_ROOT)).toEqual([CHILD, OTHER]);
  });

  it('duplicate equal roots are all removed in one call', () => {
    const paths: readonly ConfigPath[] = [LIST_ROOT, CHILD, LIST_ROOT];
    expect(omitExactConfigPath(paths, LIST_ROOT)).toEqual([CHILD]);
  });

  it('survivors keep relative order (no re-sort)', () => {
    const paths: readonly ConfigPath[] = ['z', 'a', 'm'];
    expect(omitExactConfigPath(paths, 'a')).toEqual(['z', 'm']);
  });
});

describe('INV-2 — exactness: parent omit never removes child strings', () => {
  it("omitting 'accessControl.roles' leaves child and sibling strings", () => {
    const paths: readonly ConfigPath[] = [LIST_ROOT, CHILD, OTHER];
    const result = omitExactConfigPath(paths, LIST_ROOT);
    expect(result).toEqual([CHILD, OTHER]);
    expect(result).not.toBe(paths);
  });

  it('omitting a child never removes the parent', () => {
    const paths: readonly ConfigPath[] = [LIST_ROOT, CHILD, OTHER];
    expect(omitExactConfigPath(paths, CHILD)).toEqual([LIST_ROOT, OTHER]);
  });

  it('prefix-looking strings that are not === survive', () => {
    const paths: readonly ConfigPath[] = [
      'accessControl.roles',
      'accessControl.roles[0]',
      'accessControl.roles.x',
      'accessControl.rolesExtra',
    ];
    expect(omitExactConfigPath(paths, 'accessControl.roles')).toEqual([
      'accessControl.roles[0]',
      'accessControl.roles.x',
      'accessControl.rolesExtra',
    ]);
  });
});

describe('INV-3 — identity no-op when path is absent or paths is empty', () => {
  it('Object.is identity when path is missing', () => {
    const sample: readonly ConfigPath[] = [LIST_ROOT, CHILD];
    expect(Object.is(omitExactConfigPath(sample, 'missing'), sample)).toBe(true);
  });

  it('Object.is identity on empty paths', () => {
    const empty: readonly ConfigPath[] = [];
    expect(Object.is(omitExactConfigPath(empty, 'x'), empty)).toBe(true);
  });

  it('omitting empty string is a no-op when empty string is absent', () => {
    const sample: readonly ConfigPath[] = [LIST_ROOT];
    expect(Object.is(omitExactConfigPath(sample, ''), sample)).toBe(true);
  });

  it('frozen input survives no-op without throw', () => {
    const frozen = Object.freeze([LIST_ROOT, CHILD] as ConfigPath[]);
    expect(() => omitExactConfigPath(frozen, 'missing')).not.toThrow();
    expect(Object.is(omitExactConfigPath(frozen, 'missing'), frozen)).toBe(true);
  });
});

describe('INV-4 — fresh array when removing; emptying yields fresh []', () => {
  it('omit the sole entry → fresh empty array', () => {
    const paths: readonly ConfigPath[] = [LIST_ROOT];
    const result = omitExactConfigPath(paths, LIST_ROOT);
    expect(Object.is(result, paths)).toBe(false);
    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('omit one of three → fresh array deep-equal to survivors', () => {
    const paths: readonly ConfigPath[] = ['a', 'b', 'c'];
    const result = omitExactConfigPath(paths, 'b');
    expect(Object.is(result, paths)).toBe(false);
    expect(result).toEqual(['a', 'c']);
  });

  it('mutating the result does not change the input', () => {
    const paths: ConfigPath[] = ['a', 'b', 'c'];
    const snapshot = [...paths];
    const result = omitExactConfigPath(paths, 'b');
    (result as ConfigPath[]).push('x');
    expect(paths).toEqual(snapshot);
  });
});

describe('INV-5 — input is never mutated', () => {
  it('frozen input with a present path: no throw; input unchanged', () => {
    const snapshot = [LIST_ROOT, CHILD, OTHER] as const;
    const frozen = Object.freeze([...snapshot] as ConfigPath[]);
    const result = omitExactConfigPath(frozen, LIST_ROOT);
    expect(result).toEqual([CHILD, OTHER]);
    expect([...frozen]).toEqual([...snapshot]);
    expect(Object.isFrozen(frozen)).toBe(true);
  });

  it('Proxy set traps record zero writes on a mutable input', () => {
    const raw: ConfigPath[] = [LIST_ROOT, CHILD];
    let setCount = 0;
    const proxied = new Proxy(raw, {
      set(target, prop, value, receiver) {
        setCount += 1;
        return Reflect.set(target, prop, value, receiver);
      },
    });
    omitExactConfigPath(proxied, LIST_ROOT);
    expect(setCount).toBe(0);
    expect(raw).toEqual([LIST_ROOT, CHILD]);
  });
});

describe('INV-6 — no parse, no match, no dialect validation', () => {
  it("malformed path 'a..b' is still compared with ===", () => {
    const paths: readonly ConfigPath[] = ['a..b', 'token.name'];
    expect(omitExactConfigPath(paths, 'a..b')).toEqual(['token.name']);
  });

  it('omit-config-path.ts value-imports only nothing from matching/builders', () => {
    const text = readFileSync(OMIT_FILE, 'utf8');
    const code = stripComments(text);
    const valueImports = [...code.matchAll(/^import\s+(?!type\b)[\s\S]*?from\s+['"]([^'"]+)['"]/gm)].map(
      (m) => m[1]
    );
    expect(valueImports, 'omit module must have zero value imports').toEqual([]);
    expect(code).toMatch(/import\s+type\s+\{[^}]*ConfigPath[^}]*\}\s+from\s+['"]\.\/types['"]/);
    expect(code).not.toMatch(/matchesConfigPath/);
    expect(code).not.toMatch(/parseConfigPath/);
    expect(code).not.toMatch(/formatConfigPath/);
    expect(code).not.toMatch(/createLineBuilder/);
    expect(code).not.toMatch(/createPatchBuilder/);
    expect(code).not.toMatch(/normalisePaths/);
  });

  it('config-path.ts matching exports are content-pinned (sealed; AS-1)', () => {
    const text = readFileSync(CONFIG_PATH_FILE, 'utf8');
    expect(text).not.toContain('omitExactConfigPath');
    const matchesStart = text.indexOf('export function matchesConfigPath(');
    const segmentsStart = text.indexOf('export function matchesConfigPathSegments(');
    expect(matchesStart, 'matchesConfigPath export missing').toBeGreaterThan(-1);
    expect(segmentsStart, 'matchesConfigPathSegments export missing').toBeGreaterThan(-1);
    // Thin wrapper must keep calling parse + segments — the whole point of the sealed boundary.
    const matchesEnd = text.indexOf('\n}', matchesStart) + 2;
    const matchesFn = text.slice(matchesStart, matchesEnd);
    expect(matchesFn).toContain('matchesConfigPathSegments(parseConfigPath(recorded), parseConfigPath(query))');
    expect(text).toContain('THE matching rule, defined once');
    // Digest of the entire matching-helper region (segments + wrapper). Any Addresses
    // special-case edit here changes the digest and fails this pin.
    const matchingRegion = text.slice(segmentsStart, matchesEnd);
    expect(sha256(matchingRegion)).toBe(
      '9af8abc087c31b4f2c70848aaf0e081f25fdd8ec3a743fde7ef69d6efdb5edc4'
    );
  });
});

// ---------------------------------------------------------------------------
// Error Semantics
// ---------------------------------------------------------------------------

describe('INV-7 — the helper never throws', () => {
  const cases: Array<{ paths: readonly ConfigPath[]; path: ConfigPath; label: string }> = [
    { paths: [], path: 'x', label: 'empty' },
    { paths: [LIST_ROOT], path: 'missing', label: 'absent' },
    { paths: [LIST_ROOT, CHILD], path: LIST_ROOT, label: 'present' },
    { paths: [LIST_ROOT, LIST_ROOT], path: LIST_ROOT, label: 'duplicate' },
    { paths: ['a..b', ''], path: 'a..b', label: 'malformed' },
    { paths: ['x'], path: '', label: 'empty-string path absent' },
    { paths: [''], path: '', label: 'empty-string path present' },
  ];

  it.each(cases)('returns normally for $label', ({ paths, path }) => {
    expect(() => omitExactConfigPath(paths, path)).not.toThrow();
  });

  it('package error-export inventory gains no omit-related error class', () => {
    expect(barrel).not.toHaveProperty('OmitConfigPathError');
    expect(typeof barrel.ProvenanceAttributionError).toBe('function');
    const reasonsFile = readFileSync(join(PROVENANCE_DIR, 'errors.ts'), 'utf8');
    expect(reasonsFile).not.toMatch(/omit/i);
  });
});

// ---------------------------------------------------------------------------
// Idempotency & Retry
// ---------------------------------------------------------------------------

describe('INV-8 — pure and deterministic; double-omit is identity after first', () => {
  it('two independent calls on equal inputs → deep-equal outputs', () => {
    const a: readonly ConfigPath[] = [LIST_ROOT, CHILD, OTHER];
    const b: readonly ConfigPath[] = [LIST_ROOT, CHILD, OTHER];
    expect(omitExactConfigPath(a, LIST_ROOT)).toEqual(omitExactConfigPath(b, LIST_ROOT));
  });

  it('second omit after removal returns the first result by reference', () => {
    const paths: readonly ConfigPath[] = [LIST_ROOT, CHILD];
    const once = omitExactConfigPath(paths, LIST_ROOT);
    const twice = omitExactConfigPath(once, LIST_ROOT);
    expect(Object.is(twice, once)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Auth Boundary
// ---------------------------------------------------------------------------

describe('INV-9 — matching rules are a sealed boundary', () => {
  it('parent recorded still matches child query (Addresses quieting is emit-side)', () => {
    expect(matchesConfigPath(LIST_ROOT, CHILD)).toBe(true);
    expect(matchesConfigPath(CHILD, LIST_ROOT)).toBe(true);
  });

  it('config-path.ts does not export or mention omitExactConfigPath', () => {
    const text = readFileSync(CONFIG_PATH_FILE, 'utf8');
    expect(text).not.toContain('omitExactConfigPath');
  });
});

describe('INV-10 — builders and drain never auto-omit', () => {
  const MODULES = [
    'line-builder.ts',
    'patch-builder.ts',
    'provenance-collector.ts',
    'config-recorder.ts',
    'builder-registry.ts',
    'line-ranges.ts',
  ] as const;

  it.each(MODULES)('%s source text does not contain omitExactConfigPath', (name) => {
    const text = readFileSync(join(PROVENANCE_DIR, name), 'utf8');
    expect(text).not.toContain('omitExactConfigPath');
  });
});

describe('INV-11 — opt-in does not imply always omit every list root', () => {
  it('whole-list dependence fixture: list root stays when helper is not applied', () => {
    const scope = createSpyScope();
    const b = createLineBuilder(scope);
    const wholeListPaths: readonly ConfigPath[] = ['members', 'settings.name'];
    // Honest whole-list emit — do not call omitExactConfigPath.
    b.line(`# members (${wholeListPaths.length})`, wholeListPaths);
    expect(scope.ranges[0]?.paths).toContain('members');
    expect(scope.ranges[0]?.paths).toContain('settings.name');
  });

  it('hazards docs state the keep-root rule for whole-list dependence', () => {
    const hazards = readFileSync(HAZARDS_DOC, 'utf8');
    expect(hazards.toLowerCase()).toMatch(/do not omit when the emit depends on the whole list/);
    // Complement to the fixture above: docs + fixture together pin INV-11.
    // SF-19 owns determination oracles; this SF must not invent a "list root remaining ⇒ fail" bar.
  });
});
// ---------------------------------------------------------------------------
// Side-Effect Ordering & Observability
// ---------------------------------------------------------------------------

describe('INV-12 — pure function: no logs, metrics, events, or I/O', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a battery of omits never touches console', () => {
    const spies = (['log', 'warn', 'error', 'info', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined)
    );
    const battery: Array<{ paths: readonly ConfigPath[]; path: ConfigPath }> = [
      { paths: [], path: 'x' },
      { paths: [LIST_ROOT], path: LIST_ROOT },
      { paths: [LIST_ROOT, CHILD], path: LIST_ROOT },
      { paths: [LIST_ROOT, CHILD], path: 'missing' },
      { paths: [LIST_ROOT, LIST_ROOT, CHILD], path: LIST_ROOT },
    ];
    for (const { paths, path } of battery) omitExactConfigPath(paths, path);
    for (const spy of spies) expect(spy, spy.getMockName()).not.toHaveBeenCalled();
  });
});

describe('INV-13 — observe → omit → emit; omit does not attribute', () => {
  it('line(extraPaths after omit) → addRange receives survivors only', () => {
    const scope = createSpyScope();
    const b = createLineBuilder(scope);
    const observedPaths: readonly ConfigPath[] = ['members', 'members[0]', 'settings.name'];
    const omitted = omitExactConfigPath(observedPaths, 'members');
    b.line('#[only_role(minter)]', omitted);
    const addRanges = scope.calls.filter((c) => c.kind === 'addRange');
    expect(addRanges).toHaveLength(1);
    expect(addRanges[0]).toMatchObject({
      kind: 'addRange',
      paths: ['members[0]', 'settings.name'],
    });
    expect(addRanges[0]?.paths).not.toContain('members');
  });

  it('omit itself never calls addRange', () => {
    const scope = createSpyScope();
    omitExactConfigPath(['members', 'settings.name'], 'members');
    expect(scope.calls).toEqual([]);
    expect(scope.ranges).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Resource Limits
// ---------------------------------------------------------------------------

describe('INV-14 — single linear pass; allocation bounded by input length', () => {
  it('for arrays up to 10_000, result length ≤ input length and stays fast', () => {
    const n = 10_000;
    const paths: ConfigPath[] = Array.from({ length: n }, (_, i) =>
      i % 7 === 0 ? 'drop-me' : `p.${i}`
    );
    const started = performance.now();
    const result = omitExactConfigPath(paths, 'drop-me');
    const elapsed = performance.now() - started;
    expect(result.length).toBeLessThanOrEqual(paths.length);
    expect(result).not.toContain('drop-me');
    expect(result.length).toBe(paths.filter((p) => p !== 'drop-me').length);
    // Soft bound: 10k string compares must finish well under 200ms in CI.
    expect(elapsed, `omit of ${n} paths took ${elapsed}ms`).toBeLessThan(200);
  });
});

// ---------------------------------------------------------------------------
// Sensitive Data
// ---------------------------------------------------------------------------

describe('INV-15 — paths only; never config values or emitted text', () => {
  it('arity is 2 and both parameters are path-shaped at the type level', () => {
    expectTypeOf(omitExactConfigPath).parameters.toEqualTypeOf<
      [paths: readonly ConfigPath[], path: ConfigPath]
    >();
    expectTypeOf(omitExactConfigPath).returns.toEqualTypeOf<readonly ConfigPath[]>();
    expect(omitExactConfigPath.length).toBe(2);
  });

  it('JSDoc examples use path literals only (no address / key payload)', () => {
    const text = readFileSync(OMIT_FILE, 'utf8');
    expect(text).not.toMatch(/SECRET|0x[0-9a-fA-F]{8,}|private[_-]?key/i);
    expect(text).toContain("'members'");
  });
});

// ---------------------------------------------------------------------------
// Performance / Scalability / Re-usability
// ---------------------------------------------------------------------------

describe('INV-16 — no module-level mutable state', () => {
  it('omit-config-path.ts has no module-level let/var and no cache maps', () => {
    const code = stripComments(readFileSync(OMIT_FILE, 'utf8'));
    // Drop the function body so we only inspect module scope.
    const moduleScope = code.replace(/export function omitExactConfigPath[\s\S]*$/, '');
    expect(moduleScope).not.toMatch(/\blet\b/);
    expect(moduleScope).not.toMatch(/\bvar\b/);
    expect(moduleScope).not.toMatch(/\bWeakSet\b/);
    expect(moduleScope).not.toMatch(/\bWeakMap\b/);
    expect(moduleScope).not.toMatch(/\bMap\b/);
    expect(moduleScope).not.toMatch(/\bSet\b/);
    expect(moduleScope).toMatch(/import\s+type/);
  });
});

describe('INV-17 — dedicated module; matching stays in config-path.ts', () => {
  it('omit-config-path.ts exists and config-path.ts does not export the helper', () => {
    expect(existsSync(OMIT_FILE)).toBe(true);
    const configPath = readFileSync(CONFIG_PATH_FILE, 'utf8');
    expect(configPath).not.toMatch(/export\s+function\s+omitExactConfigPath/);
    expect(configPath).not.toContain('omitExactConfigPath');
  });

  it('builders do not export an omit method', () => {
    expect(barrel).not.toHaveProperty('omit');
    const lineBuilder = readFileSync(join(PROVENANCE_DIR, 'line-builder.ts'), 'utf8');
    expect(lineBuilder).not.toMatch(/\bomit\s*\(/);
  });
});

describe('INV-18 — additive published export', () => {
  it('typeof omitExactConfigPath === function on the package barrel', () => {
    expect(typeof barrel.omitExactConfigPath).toBe('function');
    expect(barrel.omitExactConfigPath).toBe(omitExactConfigPath);
  });
});

describe('INV-19 — chain-agnostic vocabulary in core surface', () => {
  it('omit-config-path.ts imports no stellar / rwa-common package', () => {
    const text = readFileSync(OMIT_FILE, 'utf8');
    expect(text).not.toMatch(/codegen-rwa-stellar|codegen-rwa-common|rwa-config/);
  });

  it('source JSDoc does not require accessControl vocabulary (INV-30 stays green)', () => {
    const text = readFileSync(OMIT_FILE, 'utf8');
    expect(text).not.toContain('accessControl');
    expect(text).toContain('members');
  });
});

describe('INV-20 / INV-22 — SF-18 change-set scope; zero generated-byte obligation', () => {
  it('suite pins helper/docs/stellar-boundary only; no Addresses ranged-row count', () => {
    // Positive scope: helper + hazards exist. INV-21 (flipped in SF-19) pins Stellar import.
    // Honesty of Addresses quieting is SF-19's determination re-measure (SC-016) — not a fixed N.
    // This SF must not rewrite SF-4 fixtures or assert `rangedRows.length === <N>`.
    expect(typeof omitExactConfigPath).toBe('function');
    expect(existsSync(HAZARDS_DOC)).toBe(true);
    expect(existsSync(OMIT_FILE)).toBe(true);
  });
});

describe('INV-21 — Stellar src/ references omitExactConfigPath (SF-19)', () => {
  it('packages/codegen-rwa-stellar/src has at least one match for omitExactConfigPath', () => {
    expect(existsSync(STELLAR_SRC)).toBe(true);
    const hits: string[] = [];
    for (const file of walkTsFiles(STELLAR_SRC)) {
      const text = readFileSync(file, 'utf8');
      if (text.includes('omitExactConfigPath')) hits.push(file);
    }
    expect(
      hits.length,
      'SF-19 requires Stellar role-guard wraps to import omitExactConfigPath'
    ).toBeGreaterThan(0);
  });
});

describe('INV-23 — hazard 5 documents list-scan and names the helper', () => {
  it('attribution-hazards.md names omitExactConfigPath, list-scan, and whole-list contrast', () => {
    const hazards = readFileSync(HAZARDS_DOC, 'utf8');
    expect(hazards).toContain('omitExactConfigPath');
    expect(hazards.toLowerCase()).toMatch(/list[\s-]?scan/);
    expect(hazards.toLowerCase()).toMatch(/whole[\s-]?list/);
    expect(hazards).not.toMatch(/change\s+matchesConfigPath|teach\s+matching\s+to\s+ignore/i);
    expect(hazards).toMatch(/###\s*5\./);
  });

  it('provenance README points at the helper / hazard 5', () => {
    const readme = readFileSync(PROVENANCE_README, 'utf8');
    expect(readme).toMatch(/omitExactConfigPath|hazard\s*5|list-scan/i);
  });
});
