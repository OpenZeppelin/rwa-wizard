import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  findToken,
  findTokenAcross,
  readScannedSources,
  type ScannedSource,
} from '../../../test/helpers/sourceScan';

/**
 * The absence scans for `inspected-anchor/`, mirroring `focusedPathSource.test.ts`
 * because the same properties matter here and the same temptations exist.
 *
 * INV-14 (no module-level mutable state), INV-17 (the listener names, by value),
 * INV-24 (no composed walk), INV-27 (exactly two `document` references),
 * INV-28 (no memo, no timer), INV-33 (no I/O, no logging, no analytics), and
 * INV-34's `tabIndex` clause over the three guarded components.
 *
 * **Comments are stripped first, and that is load-bearing rather than tidy.**
 * Every comment in this directory states the invariant the code below it
 * satisfies, so each contains the token its own scan forbids: the provider's
 * doc block says `focusout` is not listened for, says `composedPath()` is never
 * used, and says there is no `tabIndex` anywhere. A scan over raw source fails
 * on all three, and the obvious repair is to delete the sentence explaining why
 * the code is shaped that way — trading the only documentation of the property
 * for a green scan.
 *
 * **And the scan must be shown to have read something.** A scan over zero files
 * reports "no matches" for every forbidden token and is indistinguishable from a
 * clean result, so the module set, the byte lengths and three known
 * comment-borne tokens are pinned below.
 */

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

const DIRECTORY_MODULES = [
  'src/features/wizard/inspected-anchor/InspectedAnchorContext.ts',
  'src/features/wizard/inspected-anchor/InspectedAnchorProvider.tsx',
  'src/features/wizard/inspected-anchor/index.ts',
  'src/features/wizard/inspected-anchor/inspectedAnchorStore.ts',
  'src/features/wizard/inspected-anchor/useInspectedAnchor.ts',
] as const;

/** The three files SF-14 re-freezes under the markup guard (INV-38). */
const GUARDED_COMPONENTS = [
  'src/components/shared/TogglePill.tsx',
  'src/components/shared/TopicToggleGroup.tsx',
  'src/features/wizard/steps/identity/TrustedIssuersSection.tsx',
] as const;

const sources = readScannedSources(DIRECTORY_MODULES);
const guarded = readScannedSources(GUARDED_COMPONENTS);

function sourceFor(suffix: string): ScannedSource {
  const found = sources.find((source) => source.path.endsWith(suffix));
  if (!found) throw new Error(`no scanned source ends with ${suffix}`);
  return found;
}

describe('inspected-anchor source scans', () => {
  // -------------------------------------------------------------------------
  // The scan's own preconditions. These run first, on purpose.
  // -------------------------------------------------------------------------
  describe('the scan reads what it claims to read', () => {
    /**
     * A guard over a set of files is only as good as the set. A new file in
     * `inspected-anchor/` fails this, and whoever added it decides whether the
     * rules below apply to it rather than inheriting an exemption silently.
     */
    it('the module set is what we think it is (INV-14)', () => {
      const onDisk = readdirSync(MODULE_DIR)
        .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
        .filter((name) => !name.includes('.test.'))
        .sort();

      expect(onDisk).toEqual([
        'InspectedAnchorContext.ts',
        'InspectedAnchorProvider.tsx',
        'index.ts',
        'inspectedAnchorStore.ts',
        'useInspectedAnchor.ts',
      ]);
      expect(sources).toHaveLength(onDisk.length);
    });

    it('reads a non-trivial amount of each module', () => {
      for (const source of [...sources, ...guarded]) {
        expect(source.raw.length, `${source.path} is empty`).toBeGreaterThan(200);
        expect(source.stripped.trim().length, `${source.path} stripped to nothing`).toBeGreaterThan(
          50
        );
        expect(source.stripped, `${source.path} lost its code`).toContain('export');
      }
    });

    /**
     * Three tokens that exist **only** in comments. Each must survive in `raw`
     * and vanish in `stripped`; if the stripper ever returns nothing, these fail
     * loudly instead of every scan below passing quietly.
     */
    it.each([
      ['focusout', 'InspectedAnchorProvider.tsx'],
      ['composedPath', 'InspectedAnchorProvider.tsx'],
      ['useMemo', 'useInspectedAnchor.ts'],
    ])('`%s` is comment-borne in %s and the stripper removes it', (token, file) => {
      const source = sourceFor(file);
      expect(source.raw, `${file} no longer documents ${token}`).toContain(token);
      expect(findToken(source, token)).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // INV-14 — no module-level mutable state
  // -------------------------------------------------------------------------
  it('no module-level mutable state (INV-14)', () => {
    const offenders: string[] = [];
    for (const { path, stripped } of sources) {
      for (const [offset, line] of stripped.split('\n').entries()) {
        // Module scope only: `let`/`var` at column 0. The store's own `let
        // subject` is indented inside the factory closure, which is the point.
        if (/^(let|var)\s/.test(line)) offenders.push(`${path}:${offset + 1}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // INV-28 — no memo, no timer
  // -------------------------------------------------------------------------
  /**
   * The cheapest way to honour a rule about memo keys is to have no key to get
   * wrong. A `useMemo` keyed on `[subject]` and not on the config would resolve
   * the subject against a stale draft, defeating the read-time existence check
   * in the one place nobody looks.
   */
  it.each(['useMemo', 'useCallback'])('no `%s` call anywhere in the directory (INV-28)', (hook) => {
    const offenders = sources
      .filter((source) => new RegExp(`\\b${hook}\\s*\\(`).test(source.stripped))
      .map((source) => source.path);
    expect(offenders).toEqual([]);
  });

  it.each(['setTimeout', 'setInterval', 'requestAnimationFrame'])(
    'no `%s` anywhere in the directory (INV-28)',
    (timer) => {
      expect(findTokenAcross(sources, timer)).toEqual([]);
    }
  );

  // -------------------------------------------------------------------------
  // INV-27 / INV-17 — the provider is the only module that touches `document`,
  // and its two listeners are named by value
  // -------------------------------------------------------------------------
  describe('touches `document` in exactly one module, twice (INV-27)', () => {
    it('no other module references `document.`', () => {
      const offenders = sources
        .filter((source) => !source.path.endsWith('InspectedAnchorProvider.tsx'))
        .flatMap((source) => findToken(source, 'document.'));
      expect(offenders).toEqual([]);
    });

    it('the provider’s `document.*` reference set is exactly add/remove', () => {
      const references = sourceFor('InspectedAnchorProvider.tsx').stripped.match(
        /\bdocument\.\w+/g
      );
      expect([...new Set(references ?? [])].sort()).toEqual([
        'document.addEventListener',
        'document.removeEventListener',
      ]);
    });

    /**
     * INV-17's structural half, and the sharpest form of it available without a
     * browser: the listener names, **by value**, in both directions. A third
     * listener fails by name — and the third listener anyone would add is
     * `focusout`, which ships the reported defect (the Add button disables
     * itself, focus lands nowhere, the column empties at the instant the user
     * looks for what they created). The behavioural half — dispatching
     * `focusout` and asserting no effect — is in
     * `InspectedAnchorProvider.test.tsx`; a code reading alone would not catch a
     * listener registered through a variable, and a behavioural test alone would
     * not catch a listener that happens to be a no-op today.
     */
    it('the listener names are exactly `click` and `focusin` (INV-17, INV-27)', () => {
      const { stripped } = sourceFor('InspectedAnchorProvider.tsx');
      const added = [...stripped.matchAll(/document\.addEventListener\(\s*'([^']+)'/g)].map(
        (match) => match[1]
      );
      const removed = [...stripped.matchAll(/document\.removeEventListener\(\s*'([^']+)'/g)].map(
        (match) => match[1]
      );

      expect(added.sort()).toEqual(['click', 'focusin']);
      expect(removed.sort()).toEqual(['click', 'focusin']);
      expect(findToken(sourceFor('InspectedAnchorProvider.tsx'), 'focusout')).toEqual([]);
    });

    /** Capture phase is a third argument; there is none. INV-18. */
    it('both listeners are bubble phase — no capture argument', () => {
      const { stripped } = sourceFor('InspectedAnchorProvider.tsx');
      expect(stripped).not.toMatch(/addEventListener\([^)]*(true|capture)/);
    });
  });

  // -------------------------------------------------------------------------
  // INV-24 — the retargeted target, and a plain walk
  // -------------------------------------------------------------------------
  it.each(['composedPath', 'containsComposed'])(
    'no `%s` anywhere in the directory (INV-24)',
    (token) => {
      expect(findTokenAcross(sources, token)).toEqual([]);
    }
  );

  // -------------------------------------------------------------------------
  // INV-11 — no cast at the DOM boundary
  // -------------------------------------------------------------------------
  /**
   * A cast instead of the narrowing predicate type-checks and is invisible in
   * review: a corrupted `data-config-anchor` would be stored as the subject and
   * decode to `null` at read time, so the column would silently describe nothing
   * while an element that does resolve sits focused.
   */
  it('no `as ConfigAnchorKey` in either directory (INV-11)', () => {
    const walk = readScannedSources([
      'src/features/wizard/focused-path/resolveFocusedConfigPath.ts',
      'src/features/wizard/focused-path/configAnchor.ts',
    ]);
    expect(findTokenAcross([...sources, ...walk], 'as ConfigAnchorKey')).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // INV-33 — nothing persisted, fetched, logged or emitted
  // -------------------------------------------------------------------------
  /**
   * The writer is a document `focusin` listener, so "inspection" is not a
   * user-intent signal: a per-inspection analytics event would emit the wizard's
   * entire focus traffic. And persisting the subject would restore a stale item
   * on the next session, against SF-13 AS-8.
   */
  it.each([
    'localStorage',
    'sessionStorage',
    'ui-storage',
    'fetch(',
    'console.',
    'useRwaWizardAnalytics',
    'logger',
  ])('no `%s` reference anywhere in the directory (INV-33)', (token) => {
    expect(findTokenAcross(sources, token)).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // INV-34 — no `tabIndex`, in any of the three guarded files
  // -------------------------------------------------------------------------
  /**
   * Research's Q1b trap, designed out rather than mitigated: **happy-dom focuses
   * an element with no `tabindex` where a real browser does not**, so a design
   * that forgot `tabIndex={-1}` would pass every behavioural test in this suite
   * and fail live. This design needs none — the click writer needs no focus and
   * the add handlers write directly — so the property is pinned as a property.
   *
   * The second half of the trap is why the *absence* is pinned rather than the
   * value: `tabIndex={-1}` on the issuer row would insert nothing into the tab
   * order but invites the next hand to write `tabIndex={0}`, which puts every
   * issuer row in the tab order and makes traversing a long list strictly worse
   * — the thing AS-6 forbids by name.
   */
  it.each([...GUARDED_COMPONENTS])('`%s` contains no tabIndex (INV-34)', (path) => {
    const source = guarded.find((candidate) => candidate.path === path)!;
    expect(findToken(source, 'tabIndex')).toEqual([]);
    expect(findToken(source, 'tabindex')).toEqual([]);
  });

  /**
   * INV-3's absence clause on the same three files: inspection is `aria-current`
   * plus one ring composed through `cn`, and never a role change. `aria-selected`
   * is excluded on a hard constraint rather than a preference — it requires
   * `option`/`row`/`tab`/`treeitem`, and those roles make every descendant
   * presentational, so a chip containing an `×` cannot be one and a screen-reader
   * user would lose the only way to delete a custom topic.
   */
  it.each([...GUARDED_COMPONENTS])('`%s` expresses inspection no other way (INV-3)', (path) => {
    const source = guarded.find((candidate) => candidate.path === path)!;
    for (const token of ['aria-selected', 'data-selected', 'role=', 'role:']) {
      expect(findToken(source, token), `${path} uses ${token}`).toEqual([]);
    }
  });

  /**
   * INV-21's absence clause. Someone adds `onClick` to the issuer row "for
   * reliability"; the row's handler and the document listener then both write,
   * and clicking a per-issuer topic pill describes the whole issuer instead of
   * its topic list — AS-3 broken by an addition that looks like a safety net.
   */
  it.each([...GUARDED_COMPONENTS])('`%s` writes no hand-rolled nesting guard (INV-21)', (path) => {
    const source = guarded.find((candidate) => candidate.path === path)!;
    expect(findToken(source, 'stopPropagation')).toEqual([]);
    expect(findToken(source, 'currentTarget')).toEqual([]);
  });
});
