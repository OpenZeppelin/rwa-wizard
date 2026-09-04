import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { ImplementationApproachExclusionStillValid } from './exclusionGuards';

/**
 * INV-21's absence clause, and INV-12's type-level guard.
 *
 * Both are properties about what the module *does not* contain, which no runtime
 * assertion can reach — so they are asserted over the source, the way this repo
 * already asserts the `console` ban.
 */

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

/** Source files in `focused-path/`, excluding tests and fixtures. */
function moduleSources(): Array<{ file: string; source: string }> {
  return readdirSync(MODULE_DIR)
    .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
    .filter((name) => !name.includes('.test.'))
    .sort()
    .map((file) => ({ file, source: readFileSync(join(MODULE_DIR, file), 'utf8') }));
}

describe('INV-21 — there is no memo', () => {
  it('the module set is what we think it is', () => {
    // A guard over a set of files is only as good as the set. If a file is added
    // to `focused-path/` this fails, and whoever added it decides whether the
    // no-memo rule applies to it rather than inheriting an exemption silently.
    expect(moduleSources().map((entry) => entry.file)).toEqual([
      'anchorToConfigPath.ts',
      'configAnchor.ts',
      'exclusionGuards.ts',
      'index.ts',
      'resolveFocusedConfigPath.ts',
      'stepMarkupFingerprint.ts',
      // SF-15's two halves of the sanctioned re-baseline. Both satisfy the three
      // clauses below by construction — pure functions, no hook, no module-scope
      // mutable state — so neither inherits an exemption; each earns the pass.
      'stepMarkupGuard.ts', // pure authority selection and validation; no memo, no module state.
      'stepMarkupSanction.ts', // pure data a human edits; zero imports by design.
      'useFocusedConfigPath.ts',
    ]);
  });

  /**
   * Recorded as a property because it is a decision a future reader will be
   * tempted to undo — the resolver runs on every render — and undoing it
   * silently re-introduces exactly the memo key the repo's standing rule exists
   * to police. Writing it down with a test makes the temptation visible.
   *
   * The cost being avoided is small and bounded: a `Map` lookup, at most one
   * linear scan of the selected modules, one `closest()` walk bounded by the
   * step's depth, and one array scan bounded by the wizard's own limits.
   */
  it.each(['useMemo', 'useCallback'])('no `%s` anywhere in the module', (hook) => {
    const offenders = moduleSources()
      .filter((entry) => new RegExp(`\\b${hook}\\s*\\(`).test(entry.source))
      .map((entry) => entry.file);
    expect(offenders).toEqual([]);
  });

  it('no module-level mutable state', () => {
    const offenders: string[] = [];
    for (const { file, source } of moduleSources()) {
      for (const line of source.split('\n')) {
        // Module scope only: `let`/`var` at column 0.
        if (/^(let|var)\s/.test(line)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the static id registry is a `ReadonlyMap`, not a writable one', () => {
    const source = readFileSync(join(MODULE_DIR, 'resolveFocusedConfigPath.ts'), 'utf8');
    expect(source).toContain('STATIC_ANCHOR_IDS: ReadonlyMap<string, ConfigAnchorKey>');
  });

  it('`useFocusedConfigPath` holds exactly one piece of state', () => {
    const source = readFileSync(join(MODULE_DIR, 'useFocusedConfigPath.ts'), 'utf8');
    // Call sites only — the import line and the module comment both mention the
    // hook names and are not state.
    expect(source.match(/useState\s*[<(]/g) ?? []).toHaveLength(1);
    expect(source.match(/useEffect\s*\(/g) ?? []).toHaveLength(1);
    expect(source).not.toContain('setTimeout');
    expect(source).not.toContain('setInterval');
    expect(source).not.toContain('requestAnimationFrame');
  });
});

describe('INV-14 — the resolver never reads `document`', () => {
  /**
   * The behavioural half of this lives in `resolveFocusedConfigPath.test.ts`,
   * which resolves an element from a *foreign document*. This is the cheap
   * structural half: a `document.` reference in the walk would be caught by
   * review, but only if review was looking.
   */
  it('no `document.` reference in the resolver or the anchor modules', () => {
    const offenders: string[] = [];
    for (const file of [
      'resolveFocusedConfigPath.ts',
      'anchorToConfigPath.ts',
      'configAnchor.ts',
    ]) {
      const source = readFileSync(join(MODULE_DIR, file), 'utf8');
      for (const line of source.split('\n')) {
        // Skip prose: the module comments discuss `document` on purpose.
        const code = line.replace(/^\s*\*.*$/, '').replace(/\/\/.*$/, '');
        if (/\bdocument\s*\./.test(code)) offenders.push(`${file}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the hook is the only module that touches `document`', () => {
    const source = readFileSync(join(MODULE_DIR, 'useFocusedConfigPath.ts'), 'utf8');
    // Two `addEventListener`, two `removeEventListener` — and nothing else.
    const references = source.match(/\bdocument\.\w+/g) ?? [];
    expect([...new Set(references)].sort()).toEqual([
      'document.addEventListener',
      'document.removeEventListener',
    ]);
  });
});

describe('INV-12 — the ImplementationApproach exclusion is type-guarded', () => {
  /**
   * The guard itself is a compile-time assertion in `exclusionGuards.ts`; this
   * test cannot re-check it, and does not pretend to. What it does is keep the
   * guard *referenced*, so an unused-export sweep cannot delete it, and record
   * where the failure will surface.
   *
   * The guard fails to compile the day `IdentityVerificationConfig` gains a
   * member — a verification-approach discriminant, say — at which point that card
   * becomes a real choice and must be anchored rather than excluded. That is a
   * precondition a list entry cannot express: adding a fourth key to the config
   * is what makes a second approach able to write anything, so tying the guard to
   * the key union ties it to the actual precondition.
   */
  it('the guard is exported from source, so `pnpm typecheck` is the gate', () => {
    const guarded: ImplementationApproachExclusionStillValid = true;
    expect(guarded).toBe(true);

    const source = readFileSync(join(MODULE_DIR, 'exclusionGuards.ts'), 'utf8');
    expect(source).toContain('keyof IdentityVerificationConfig');
    expect(source).toContain("'claimTopics' | 'trustedIssuers' | 'controls'");
  });

  it('the guard lives in source, not in a test file', () => {
    // A guard that only exists inside a test can be deleted with the test.
    expect(moduleSources().map((entry) => entry.file)).toContain('exclusionGuards.ts');
  });
});
