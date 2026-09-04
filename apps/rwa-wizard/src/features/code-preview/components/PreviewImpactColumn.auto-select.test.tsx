import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, type RenderResult } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';
import { logger } from '@openzeppelin/ui-utils';

import { makeConfig } from '../../../test/fixtures/wizardFixtures';
import {
  availableProvenance,
  createdRow,
  fileRow,
  group,
  mixedGroups,
  rangeRow,
  TEST_IDENTITY,
} from '../../../test/helpers/impactHarness';
import { REPO_ROOT } from '../../../test/helpers/sourceScan';
import { CONFIG_ANCHOR_ATTR, tokenAnchor } from '../../wizard/focused-path';
import { InspectedAnchorProvider } from '../../wizard/inspected-anchor';
import type { CodePreviewProvenance } from '../provenanceState';
import type { CodePreviewRevealTarget } from '../reveal';
import { PreviewImpactColumn } from './PreviewImpactColumn';

/**
 * SF-21 auto-select / open-transition behaviour.
 *
 * Every test names the INV-N / AS-N it verifies. Harness defaults `drawerOpen`
 * to the value under test — never the SF-13 default of false — so silence and
 * activation are explicit.
 */

type RevealTarget = CodePreviewRevealTarget;

interface ColumnProps {
  readonly config: RWAConfig;
  readonly provenance: CodePreviewProvenance | null;
  readonly onReveal: ((target: RevealTarget) => void) | null;
  readonly drawerOpen: boolean;
}

interface AutoSelectHarness extends RenderResult {
  readonly root: HTMLElement;
  readonly rows: () => HTMLButtonElement[];
  readonly activeRows: () => HTMLButtonElement[];
  readonly setProps: (next: Partial<ColumnProps>) => void;
  readonly focusName: () => void;
  readonly focusSymbol: () => void;
}

function mountAutoSelect(initial: Partial<ColumnProps> = {}): AutoSelectHarness {
  let props: ColumnProps = {
    config: makeConfig(),
    provenance: availableProvenance(mixedGroups()).provenance,
    onReveal: vi.fn(),
    drawerOpen: true,
    ...initial,
  };

  const tree = (value: ColumnProps) => (
    <InspectedAnchorProvider scopeToken="test" modules={value.config.compliance.modules}>
      <div>
        <input data-testid="field-name" {...{ [CONFIG_ANCHOR_ATTR]: tokenAnchor('name') }} />
        <input data-testid="field-symbol" {...{ [CONFIG_ANCHOR_ATTR]: tokenAnchor('symbol') }} />
        <PreviewImpactColumn {...value} />
      </div>
    </InspectedAnchorProvider>
  );

  const result = render(tree(props));
  const root = result.container.querySelector<HTMLElement>('.rwa-code-preview-impact')!;

  return {
    ...result,
    root,
    rows: () => [...root.querySelectorAll<HTMLButtonElement>('li > button')],
    activeRows: () =>
      [...root.querySelectorAll<HTMLButtonElement>('li > button')].filter(
        (button) => button.getAttribute('aria-current') === 'true'
      ),
    setProps: (next) => {
      props = { ...props, ...next };
      result.rerender(tree(props));
    },
    focusName: () => {
      act(() => {
        result.getByTestId('field-name').focus();
      });
    },
    focusSymbol: () => {
      act(() => {
        result.getByTestId('field-symbol').focus();
      });
    },
  };
}

function lastRevealCall(spy: ReturnType<typeof vi.fn>): RevealTarget | undefined {
  const calls = revealCalls(spy);
  return calls.length > 0 ? calls[calls.length - 1] : undefined;
}

function revealCalls(spy: ReturnType<typeof vi.fn>): RevealTarget[] {
  return (spy.mock.calls as unknown[][]).map((call) => call[0] as RevealTarget);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PreviewImpactColumn auto-select (SF-21)', () => {
  // -------------------------------------------------------------------------
  // AS-1 / INV-8 / INV-1 — happy path: first ranged row activates
  // -------------------------------------------------------------------------
  describe('AS-1: drawer open + ranged field → first ranged site (INV-8, INV-1)', () => {
    it('auto-selects the first ranged row and reveals that file+range — INV-8 happy', () => {
      const onReveal = vi.fn();
      const harness = mountAutoSelect({ onReveal, drawerOpen: true });
      harness.focusName();

      expect(revealCalls(onReveal)).toEqual([
        {
          path: 'scripts/deploy.sh',
          range: { startLine: 12, endLine: 18 },
        },
      ]);
      expect(harness.activeRows()).toHaveLength(1);
      expect(harness.activeRows()[0]).toBe(harness.rows()[0]);
      expect(harness.activeRows()[0]!.getAttribute('aria-current')).toBe('true');
      expect(harness.activeRows()[0]!.className).toContain('rwa-code-preview-impact-row-active');
    });

    it('click and auto-select of the first ranged site produce identical reveal args — INV-8', () => {
      const autoSpy = vi.fn();
      const auto = mountAutoSelect({ onReveal: autoSpy, drawerOpen: true });
      auto.focusName();
      const autoArgs = revealCalls(autoSpy);
      auto.unmount();

      const clickSpy = vi.fn();
      const click = mountAutoSelect({ onReveal: clickSpy, drawerOpen: false });
      click.focusName();
      expect(clickSpy).not.toHaveBeenCalled();
      act(() => {
        click.rows()[0]!.click();
      });
      expect(revealCalls(clickSpy)).toEqual(autoArgs);
    });

    it('exactly one row carries aria-current after auto-select — INV-1', () => {
      const harness = mountAutoSelect({ drawerOpen: true });
      harness.focusName();
      const withCurrent = harness.rows().filter((row) => row.hasAttribute('aria-current'));
      expect(withCurrent).toHaveLength(1);
      expect(withCurrent[0]!.getAttribute('aria-current')).toBe('true');
      for (const row of harness.rows()) {
        if (row !== withCurrent[0]) {
          expect(row.hasAttribute('aria-current')).toBe(false);
          expect(row.className).not.toContain('rwa-code-preview-impact-row-active');
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // AS-2 / INV-9 / INV-14 — drawer closed is silence
  // -------------------------------------------------------------------------
  describe('AS-2: drawer closed → no auto-select (INV-9, INV-14)', () => {
    it('focusing a ranged field with drawerOpen false does not call onReveal — INV-9', () => {
      const onReveal = vi.fn();
      const harness = mountAutoSelect({ onReveal, drawerOpen: false });
      harness.focusName();
      expect(harness.rows().length).toBeGreaterThan(0);
      expect(onReveal, 'AS-2 violated: closed drawer forced a reveal').not.toHaveBeenCalled();
      expect(harness.activeRows()).toHaveLength(0);
    });

    it('onReveal null with drawer open is silent — INV-9 boundary', () => {
      const harness = mountAutoSelect({ onReveal: null, drawerOpen: true });
      expect(() => harness.focusName()).not.toThrow();
      expect(harness.rows().length).toBeGreaterThan(0);
      expect(harness.activeRows()).toHaveLength(0);
    });

    it('empty / not-a-field / unsupported resting states never call onReveal — INV-9 failure', () => {
      const onReveal = vi.fn();
      const empty = mountAutoSelect({
        onReveal,
        drawerOpen: true,
        provenance: availableProvenance([]).provenance,
      });
      empty.focusName();
      expect(onReveal).not.toHaveBeenCalled();
      empty.unmount();

      const noFocus = mountAutoSelect({ onReveal, drawerOpen: true });
      // Never focus — stays no-focus.
      expect(onReveal).not.toHaveBeenCalled();
      noFocus.unmount();
    });
  });

  // -------------------------------------------------------------------------
  // AS-3 / INV-10 — no consolation file/created jump
  // -------------------------------------------------------------------------
  describe('AS-3: file/created-only field → no auto-select (INV-10)', () => {
    it('does not reveal when every row is whole-file or created — INV-10 happy', () => {
      const onReveal = vi.fn();
      const harness = mountAutoSelect({
        onReveal,
        drawerOpen: true,
        provenance: availableProvenance([
          group('contracts/new.rs', [createdRow()]),
          group('scripts/deploy.sh', [fileRow()]),
        ]).provenance,
      });
      harness.focusName();
      expect(
        onReveal,
        'AS-3 violated: auto-select jumped to a file/created row'
      ).not.toHaveBeenCalled();
      expect(harness.activeRows()).toHaveLength(0);
      expect(harness.rows().length).toBeGreaterThan(0);
    });

    it('does not override a manual file-row click with first ranged auto-select — B-2', () => {
      const onReveal = vi.fn();
      const harness = mountAutoSelect({
        onReveal,
        drawerOpen: true,
        provenance: availableProvenance([
          group('README.md', [fileRow()]),
          group('scripts/deploy.sh', [rangeRow(12, 18)]),
        ]).provenance,
      });
      harness.focusName();
      expect(onReveal).toHaveBeenCalledTimes(1);
      expect(revealCalls(onReveal)[0]).toEqual({
        path: 'scripts/deploy.sh',
        range: { startLine: 12, endLine: 18 },
      });

      act(() => {
        harness.rows()[0]!.click();
      });
      expect(lastRevealCall(onReveal)).toEqual({ path: 'README.md' });
      expect(harness.activeRows()[0]).toBe(harness.rows()[0]);

      act(() => {
        harness.setProps({ drawerOpen: true });
      });
      expect(revealCalls(onReveal).length).toBe(2);
      expect(harness.activeRows()[0]).toBe(harness.rows()[0]);
    });
  });

  // -------------------------------------------------------------------------
  // AS-4 / INV-11 — preserve within subject
  // -------------------------------------------------------------------------
  describe('AS-4: same subject preserves the user site (INV-11)', () => {
    it('re-focus of the same field keeps a later ranged site — INV-11 happy', () => {
      const onReveal = vi.fn();
      const harness = mountAutoSelect({ onReveal, drawerOpen: true });
      harness.focusName();
      expect(revealCalls(onReveal)).toHaveLength(1);

      // Activate the second primary ranged row (display order: primary then
      // secondary — rows()[1] is unpartitioned rowIndex 2).
      act(() => {
        harness.rows()[1]!.click();
      });
      expect(lastRevealCall(onReveal)).toEqual({
        path: 'scripts/deploy.sh',
        range: { startLine: 41, endLine: 47 },
      });
      expect(harness.activeRows()[0]).toBe(harness.rows()[1]);

      // Blur without changing subject: leave for a non-field, then return.
      // Switching to another ranged field would overwrite activeSite (INV-11
      // only preserves within the same configPath).
      act(() => {
        const decoy = document.createElement('button');
        decoy.setAttribute('data-testid', 'decoy');
        harness.container.appendChild(decoy);
        decoy.focus();
      });
      const midCount = onReveal.mock.calls.length;

      harness.focusName();

      expect(
        onReveal.mock.calls.length,
        'AS-4 violated: re-focus re-asserted first and called onReveal'
      ).toBe(midCount);
      expect(
        harness.activeRows()[0],
        'AS-4 violated: re-focus yanked chrome back to the first ranged row'
      ).toBe(harness.rows()[1]);
    });

    it("changing to a different ranged field auto-selects that field's first site — INV-11 boundary", () => {
      const onReveal = vi.fn();
      // Different groups per path so we can tell subjects apart.
      const nameGroups = mixedGroups();
      const symbolGroups = [
        group('contracts/rwa-token/src/contract.rs', [rangeRow(5, 8), rangeRow(90, 95)]),
      ];
      const provenance: CodePreviewProvenance = {
        state: {
          kind: 'available',
          identity: TEST_IDENTITY,
          lookup: (path) => {
            const groups = path.includes('symbol') ? symbolGroups : nameGroups;
            return { identity: TEST_IDENTITY, path, groups };
          },
        },
        liveIdentity: TEST_IDENTITY,
      };

      const harness = mountAutoSelect({ onReveal, drawerOpen: true, provenance });
      harness.focusName();
      expect(lastRevealCall(onReveal)).toEqual({
        path: 'scripts/deploy.sh',
        range: { startLine: 12, endLine: 18 },
      });

      harness.focusSymbol();
      expect(lastRevealCall(onReveal)).toEqual({
        path: 'contracts/rwa-token/src/contract.rs',
        range: { startLine: 5, endLine: 8 },
      });
      expect(harness.activeRows()).toHaveLength(1);
      expect(harness.activeRows()[0]).toBe(harness.rows()[0]);
    });

    it('when a preserved site no longer resolves, falls through to first — INV-11c', () => {
      const onReveal = vi.fn();
      const harness = mountAutoSelect({ onReveal, drawerOpen: true });
      harness.focusName();
      act(() => {
        harness.rows()[1]!.click();
      });
      expect(harness.activeRows()[0]).toBe(harness.rows()[1]);
      const before = onReveal.mock.calls.length;

      // Drop enough rows that the preserved site's rowIndex (2) no longer
      // exists — a mid-list delete alone renumbers later rows into that
      // index and would still "resolve". INV-11c needs an unresolvable site.
      act(() => {
        harness.setProps({
          provenance: availableProvenance([
            group('scripts/deploy.sh', [rangeRow(12, 18), rangeRow(20, 20, 'secondary')]),
          ]).provenance,
        });
      });

      expect(
        onReveal.mock.calls.length,
        'INV-11c violated: preserved site gone but first was not re-asserted'
      ).toBeGreaterThan(before);
      expect(lastRevealCall(onReveal)).toEqual({
        path: 'scripts/deploy.sh',
        range: { startLine: 12, endLine: 18 },
      });
      expect(harness.activeRows()[0]).toBe(harness.rows()[0]);
    });
  });

  // -------------------------------------------------------------------------
  // INV-12 — open-transition re-issue
  // -------------------------------------------------------------------------
  describe('drawer open-transition re-issues preserved or first site (INV-12)', () => {
    it('focus with drawer closed then open → one activation of the first site — INV-12 happy', () => {
      const onReveal = vi.fn();
      const harness = mountAutoSelect({ onReveal, drawerOpen: false });
      harness.focusName();
      expect(onReveal).not.toHaveBeenCalled();

      act(() => {
        harness.setProps({ drawerOpen: true });
      });

      expect(revealCalls(onReveal)).toEqual([
        {
          path: 'scripts/deploy.sh',
          range: { startLine: 12, endLine: 18 },
        },
      ]);
      expect(harness.activeRows()).toHaveLength(1);
    });

    it("re-open re-issues the user's non-first site, not first — INV-12 preserve", () => {
      const onReveal = vi.fn();
      const harness = mountAutoSelect({ onReveal, drawerOpen: true });
      harness.focusName();
      act(() => {
        harness.rows()[1]!.click();
      });
      expect(harness.activeRows()[0]).toBe(harness.rows()[1]);

      act(() => {
        harness.setProps({ drawerOpen: false });
      });
      // Closed: no further reveal from SF-21.
      const beforeOpen = onReveal.mock.calls.length;

      act(() => {
        harness.setProps({ drawerOpen: true });
      });

      expect(onReveal.mock.calls.length - beforeOpen).toBe(1);
      expect(lastRevealCall(onReveal)).toEqual({
        path: 'scripts/deploy.sh',
        range: { startLine: 41, endLine: 47 },
      });
      expect(harness.activeRows()[0]).toBe(harness.rows()[1]);
    });

    it('issues a single activation per open edge — INV-12 boundary', () => {
      const onReveal = vi.fn();
      const harness = mountAutoSelect({ onReveal, drawerOpen: false });
      harness.focusName();
      act(() => {
        harness.setProps({ drawerOpen: true });
      });
      expect(onReveal).toHaveBeenCalledTimes(1);
      // Parent re-render with drawer still open must not re-fire.
      act(() => {
        harness.setProps({ drawerOpen: true });
      });
      expect(onReveal).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // INV-13 — manual activation moves chrome
  // -------------------------------------------------------------------------
  describe('manual activation updates activeSite (INV-13)', () => {
    it('activating a later ranged row moves aria-current and reveals that site', () => {
      const onReveal = vi.fn();
      const harness = mountAutoSelect({ onReveal, drawerOpen: true });
      harness.focusName();
      act(() => {
        harness.rows()[1]!.click();
      });
      expect(harness.activeRows()).toHaveLength(1);
      expect(harness.activeRows()[0]).toBe(harness.rows()[1]);
      expect(lastRevealCall(onReveal)).toEqual({
        path: 'scripts/deploy.sh',
        range: { startLine: 41, endLine: 47 },
      });
    });

    it('repeat activation of the same row still calls onReveal — SF-9 INV-10 / INV-13', () => {
      const onReveal = vi.fn();
      const harness = mountAutoSelect({ onReveal, drawerOpen: true });
      harness.focusName();
      const afterAuto = onReveal.mock.calls.length;
      act(() => {
        harness.rows()[0]!.click();
        harness.rows()[0]!.click();
      });
      expect(onReveal.mock.calls.length - afterAuto).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // INV-8 / INV-19 — stale auto-select uses the defer split
  // -------------------------------------------------------------------------
  describe('stale auto-select shares the click defer path (INV-8, INV-19)', () => {
    const STALE = { identity: TEST_IDENTITY, liveIdentity: 'moved' } as const;

    it('auto-select under staleness reveals file only, then range on settle — INV-19', () => {
      const onReveal = vi.fn();
      const harness = mountAutoSelect({
        onReveal,
        drawerOpen: true,
        provenance: availableProvenance(mixedGroups(), STALE).provenance,
      });
      harness.focusName();

      expect(revealCalls(onReveal)).toEqual([{ path: 'scripts/deploy.sh' }]);
      expect('range' in revealCalls(onReveal)[0]!).toBe(false);

      act(() => {
        harness.setProps({
          provenance: availableProvenance(
            [
              group('scripts/deploy.sh', [
                rangeRow(22, 28),
                rangeRow(30, 30, 'secondary'),
                rangeRow(51, 57),
                rangeRow(62, 65, 'secondary'),
              ]),
            ],
            { identity: 'settled', liveIdentity: 'settled' }
          ).provenance,
        });
      });

      expect(lastRevealCall(onReveal)).toEqual({
        path: 'scripts/deploy.sh',
        range: { startLine: 22, endLine: 28 },
      });
    });
  });

  // -------------------------------------------------------------------------
  // INV-6 / INV-18 — lifecycle and silent failure
  // -------------------------------------------------------------------------
  describe('activeSite lifecycle and silent failure (INV-6, INV-18)', () => {
    it('range-less subject after a ranged subject clears active chrome — INV-6', () => {
      const onReveal = vi.fn();
      const harness = mountAutoSelect({
        onReveal,
        drawerOpen: true,
        provenance: availableProvenance(mixedGroups()).provenance,
      });
      harness.focusName();
      expect(harness.activeRows()).toHaveLength(1);

      act(() => {
        harness.setProps({
          provenance: availableProvenance([group('a.rs', [fileRow(), createdRow()])]).provenance,
        });
      });
      expect(harness.activeRows()).toHaveLength(0);
    });

    it('remount starts with no active chrome until auto-select fires — INV-6 boundary', () => {
      const first = mountAutoSelect({ drawerOpen: false });
      first.focusName();
      expect(first.activeRows()).toHaveLength(0);
      first.unmount();

      const second = mountAutoSelect({ drawerOpen: true });
      second.focusName();
      expect(second.activeRows()).toHaveLength(1);
    });

    it('never throws and never logs above silence while auto-selecting — INV-18', () => {
      const spies = (['debug', 'info', 'warn', 'error'] as const).map((level) => ({
        level,
        spy: vi.spyOn(logger, level).mockImplementation(() => {}),
      }));
      const onReveal = vi.fn();
      expect(() => {
        const harness = mountAutoSelect({ onReveal, drawerOpen: true });
        harness.focusName();
        harness.setProps({ drawerOpen: false });
        harness.setProps({ drawerOpen: true });
        harness.setProps({ provenance: availableProvenance([]).provenance });
        harness.focusSymbol();
      }).not.toThrow();
      for (const { level, spy } of spies) {
        if (level === 'debug') continue;
        expect(spy, `logger.${level} was called`).not.toHaveBeenCalled();
      }
    });
  });

  // -------------------------------------------------------------------------
  // INV-17 — no oscillation under ordinary focus / settle
  // -------------------------------------------------------------------------
  describe('auto-select does not oscillate (INV-17)', () => {
    it('settling on a subject asserts first at most once — INV-17 happy', () => {
      const onReveal = vi.fn();
      const harness = mountAutoSelect({ onReveal, drawerOpen: true });
      harness.focusName();
      expect(onReveal).toHaveBeenCalledTimes(1);
      // Re-render with identical props must not re-assert.
      act(() => {
        harness.setProps({ drawerOpen: true });
      });
      expect(onReveal).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // INV-20 — auto-select does not steal DOM focus
  // -------------------------------------------------------------------------
  describe('auto-select does not move DOM focus (INV-20)', () => {
    it('document.activeElement remains the focused form control after auto-select', () => {
      const harness = mountAutoSelect({ drawerOpen: true });
      harness.focusName();
      expect(document.activeElement).toBe(harness.getByTestId('field-name'));
      expect(harness.activeRows()).toHaveLength(1);
    });

    it('open-transition re-issue also leaves focus on the field — INV-20', () => {
      const harness = mountAutoSelect({ drawerOpen: false });
      harness.focusName();
      act(() => {
        harness.setProps({ drawerOpen: true });
      });
      expect(document.activeElement).toBe(harness.getByTestId('field-name'));
    });
  });
});

describe('layout-probe V8 refresh leg tolerates SF-21 auto-select marks', () => {
  // SF-20 Finding 1: the refresh leg required baseline === 0 after focusing the
  // lockup field. AS-1 makes that false whenever the drawer is open. The probe
  // must not fail-closed on auto-select marks; stale-at-click remains the proof.
  it('checkRevealDuringRefresh no longer fails closed on a non-zero post-focus baseline', () => {
    const probe = readFileSync(join(REPO_ROOT, 'apps/rwa-wizard/scripts/layout-probe.mjs'), 'utf8');
    const fnStart = probe.indexOf('async function checkRevealDuringRefresh');
    expect(
      fnStart,
      'checkRevealDuringRefresh missing from layout-probe.mjs'
    ).toBeGreaterThanOrEqual(0);
    const fnEnd = probe.indexOf('\nasync function checkRevealAtNarrowPane', fnStart);
    const body = probe.slice(fnStart, fnEnd === -1 ? undefined : fnEnd);
    expect(
      body,
      'V8 refresh leg must not fail when SF-21 auto-select leaves marks after focus'
    ).not.toMatch(/baseline\s*!==\s*0/);
    expect(
      body,
      'V8 refresh leg must not fail when SF-21 auto-select leaves marks after focus'
    ).not.toContain('the refresh leg started with');
    expect(body).toContain('SF-21 auto-select');
    expect(body).toContain("clicked.stale !== 'true'");
  });
});
