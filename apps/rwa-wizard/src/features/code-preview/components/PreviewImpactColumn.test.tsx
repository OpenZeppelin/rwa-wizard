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
  noneProvenance,
  rangeRow,
  tallGroups,
  TEST_IDENTITY,
  unsupportedProvenance,
} from '../../../test/helpers/impactHarness';
import { CONFIG_ANCHOR_ATTR, tokenAnchor } from '../../wizard/focused-path';
import { InspectedAnchorProvider } from '../../wizard/inspected-anchor';
import type { CodePreviewProvenance } from '../provenanceState';
import { PreviewImpactColumn } from './PreviewImpactColumn';

/**
 * The column's rendered contract. Every assertion here is structural, textual or
 * semantic — never visual: happy-dom has no layout engine, so a visibility claim
 * would pass for the wrong reason and keep passing after the CSS is deleted
 * (INV-23). Geometry belongs to the browser probe.
 */

interface ColumnProps {
  readonly config: RWAConfig;
  readonly provenance: CodePreviewProvenance | null;
  readonly onReveal: ((target: { path: string }) => void) | null;
  /** Default false so SF-13 reveal-count tests are not disturbed by SF-21 auto-select. */
  readonly drawerOpen: boolean;
}

interface ColumnHarness extends RenderResult {
  readonly root: HTMLElement;
  readonly scroller: HTMLElement;
  readonly rows: () => HTMLButtonElement[];
  readonly setProps: (next: Partial<ColumnProps>) => void;
}

/**
 * Mount the column beside one real anchored control, so a field can be focused
 * the way the app focuses one, and rows appear without any state being faked.
 */
function mountColumn(initial: Partial<ColumnProps> = {}): ColumnHarness {
  let props: ColumnProps = {
    config: makeConfig(),
    provenance: availableProvenance(mixedGroups()).provenance,
    onReveal: vi.fn(),
    drawerOpen: false,
    ...initial,
  };

  const tree = (value: ColumnProps) => (
    // SF-14: the column's answer survives a reach into it because the *subject*
    // survives, not because a held path does — `HeldField` is gone. This harness
    // was not named by SF-14's design as needing re-pointing, and it did: the
    // design's downstream list was derived from where `HeldField` is named
    // rather than from where its behaviour is observed, and this file observes
    // it through the column. Recorded in 05-tests.md § Dev Notes.
    <InspectedAnchorProvider scopeToken="test" modules={value.config.compliance.modules}>
      <div>
        <input data-testid="field-a" {...{ [CONFIG_ANCHOR_ATTR]: tokenAnchor('name') }} />
        <PreviewImpactColumn {...value} />
      </div>
    </InspectedAnchorProvider>
  );

  const result = render(tree(props));
  const root = result.container.querySelector<HTMLElement>('.rwa-code-preview-impact')!;

  return {
    ...result,
    root,
    scroller: root.querySelector<HTMLElement>('.rwa-code-preview-impact-scroll')!,
    rows: () => [...root.querySelectorAll<HTMLButtonElement>('li > button')],
    setProps: (next) => {
      props = { ...props, ...next };
      result.rerender(tree(props));
    },
  };
}

function focusField(harness: ColumnHarness): void {
  act(() => {
    harness.getByTestId('field-a').focus();
  });
}

/** Mount, focus a resolving field, and return the harness with rows on screen. */
function mountWithRows(initial: Partial<ColumnProps> = {}): ColumnHarness {
  const harness = mountColumn(initial);
  focusField(harness);
  return harness;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PreviewImpactColumn', () => {
  // -------------------------------------------------------------------------
  // INV-2 / INV-36 — seven kinds, six named resting states, none an error
  // -------------------------------------------------------------------------
  describe('renders every view kind as a named, plain state (INV-2, INV-36)', () => {
    const restingCases = [
      { kind: 'no-preview', title: 'No code preview', props: { provenance: null } },
      {
        kind: 'no-preview (none)',
        title: 'No code preview',
        props: { provenance: noneProvenance() },
      },
      {
        kind: 'unsupported',
        title: 'Impact not reported',
        props: { provenance: unsupportedProvenance() },
      },
      { kind: 'no-focus', title: 'No field selected', props: {} },
    ] as const;

    for (const testCase of restingCases) {
      it(`${testCase.kind} renders a title and a description`, () => {
        const harness = mountColumn(testCase.props);
        const state = harness.getByText(testCase.title);
        expect(state).toBeInTheDocument();
        expect(harness.root.textContent).toContain(testCase.title);
        expect(harness.rows()).toHaveLength(0);
      });
    }

    it('not-a-field renders when a control outside the config holds focus', () => {
      const harness = mountColumn();
      act(() => {
        harness.container.querySelector('div')!.setAttribute('tabindex', '0');
        harness.container.querySelector<HTMLElement>('div')!.focus();
      });
      expect(harness.getByText('Not a configuration field')).toBeInTheDocument();
    });

    it('pending renders with the field name still on the header', () => {
      // Narrowed: `pending` is now the stale-AND-empty corner. A stale identity
      // with rows to keep renders `groups` with the refresh mark, which is the
      // next test.
      const harness = mountWithRows({
        provenance: availableProvenance([], {
          identity: TEST_IDENTITY,
          liveIdentity: 'moved',
        }).provenance,
      });
      expect(harness.getByText('Regenerating')).toBeInTheDocument();
      expect(harness.root.querySelector('.rwa-code-preview-impact-subject')!.textContent).toBe(
        'Token · Name'
      );
    });

    it('a stale tree with rows keeps them and marks the refresh instead', () => {
      // The flicker fix, at the render site. Regeneration is debounced per
      // keystroke, so the state this exercises is entered once per character
      // typed into the field the column is describing — and it must not change
      // the column's height or replace its content.
      const harness = mountWithRows({
        provenance: availableProvenance(mixedGroups(), {
          identity: TEST_IDENTITY,
          liveIdentity: 'moved',
        }).provenance,
      });
      expect(harness.rows()).toHaveLength(4);
      expect(harness.queryByText('Regenerating')).not.toBeInTheDocument();
      expect(harness.root.getAttribute('aria-busy')).toBe('true');
      expect(harness.root.getAttribute('data-impact-stale')).toBe('true');
    });

    it('a fresh tree carries no refresh mark, so the mark is not always on', () => {
      const harness = mountWithRows();
      expect(harness.root.getAttribute('aria-busy')).toBe('false');
      expect(harness.root.getAttribute('data-impact-stale')).toBe('false');
    });

    it('empty renders the only state permitted to claim anything about generated code', () => {
      const harness = mountWithRows({ provenance: availableProvenance([]).provenance });
      expect(harness.getByText('Nothing generated from this field')).toBeInTheDocument();
      expect(harness.rows()).toHaveLength(0);
    });

    it('groups renders the list', () => {
      const harness = mountWithRows();
      expect(harness.rows()).toHaveLength(4);
    });

    it('the six resting states are pairwise distinct, and none is a substring of another', () => {
      // Six different facts, told as six different sentences. Two that read the
      // same are two the user cannot tell apart, which is the failure the whole
      // state table exists to prevent.
      const rendered: { title: string; description: string }[] = [];
      const cases: Partial<ColumnProps>[] = [
        { provenance: null },
        { provenance: unsupportedProvenance() },
        {},
        {},
        {
          provenance: availableProvenance([], {
            identity: TEST_IDENTITY,
            liveIdentity: 'moved',
          }).provenance,
        },
        { provenance: availableProvenance([]).provenance },
      ];

      cases.forEach((props, index) => {
        const harness = mountColumn(props);
        // Cases 3 (no-focus) and 4 (not-a-field) differ by focus, not by props.
        if (index === 3) {
          act(() => {
            harness.getByTestId('field-a').setAttribute(CONFIG_ANCHOR_ATTR, '');
            harness.getByTestId('field-a').focus();
          });
        } else if (index >= 4) {
          focusField(harness);
        }
        const state = harness.scroller.textContent ?? '';
        const heading = harness.scroller.querySelector('h1, h2, h3, h4, h5, h6, p, div');
        rendered.push({ title: heading?.textContent ?? state, description: state });
        harness.unmount();
      });

      const descriptions = rendered.map((entry) => entry.description);
      expect(new Set(descriptions).size, 'two resting states read the same').toBe(
        descriptions.length
      );
      for (const [i, a] of descriptions.entries()) {
        for (const [j, b] of descriptions.entries()) {
          if (i === j) continue;
          expect(a.includes(b), `state ${i} contains state ${j}`).toBe(false);
        }
      }
    });
  });

  // -------------------------------------------------------------------------
  // INV-3 — subtractive presentation
  // -------------------------------------------------------------------------
  describe('is subtractive (INV-3)', () => {
    it('renders an all-primary file as one plain list with no heading and no marker', () => {
      const harness = mountWithRows({
        provenance: availableProvenance(tallGroups()).provenance,
      });

      const lists = harness.root.querySelectorAll('ul');
      expect(lists).toHaveLength(2);
      expect(lists[0]!.querySelectorAll('li')).toHaveLength(20);
      expect(harness.root.querySelectorAll('h5')).toHaveLength(0);
      expect(harness.root.textContent).not.toContain('Mentions');
    });

    it('renders the secondary heading only for a file that has secondary rows', () => {
      const harness = mountWithRows({
        provenance: availableProvenance([
          group('a.rs', [rangeRow(1, 2)]),
          group('b.rs', [rangeRow(1, 2), rangeRow(5, 5, 'secondary')]),
        ]).provenance,
      });
      expect(harness.root.querySelectorAll('h5')).toHaveLength(1);
    });

    it('gives a primary row the same markup whether or not a secondary row is present', () => {
      const withOnlyPrimary = mountWithRows({
        provenance: availableProvenance([group('a.rs', [rangeRow(12, 18)])]).provenance,
      });
      const primaryOnly = withOnlyPrimary.rows()[0]!.outerHTML;
      withOnlyPrimary.unmount();

      const withBoth = mountWithRows({
        provenance: availableProvenance([
          group('a.rs', [rangeRow(12, 18), rangeRow(20, 20, 'secondary')]),
        ]).provenance,
      });
      expect(withBoth.rows()[0]!.outerHTML).toBe(primaryOnly);
    });
  });

  // -------------------------------------------------------------------------
  // INV-5 — keys are unique list-wide, and rows do not swap identity
  // -------------------------------------------------------------------------
  describe('keys every row uniquely across both partitions (INV-5)', () => {
    it('renders no duplicate-key warning for a file with mixed significance', () => {
      // React logs duplicate keys rather than throwing, so the spy is a
      // supplement to the mapper assertion, never the whole check. It is only
      // worth anything if it can fire at all, which the guard below proves.
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});
      mountWithRows();
      const duplicates = error.mock.calls.filter((call) =>
        String(call[0] ?? '').includes('two children with the same key')
      );
      expect(duplicates).toHaveLength(0);

      console.error('probe: two children with the same key');
      expect(
        error.mock.calls.some((call) =>
          String(call[0] ?? '').includes('two children with the same key')
        ),
        'the console spy is swallowed and proves nothing'
      ).toBe(true);
    });

    it('keeps each row bound to its own site across a re-render', () => {
      // The collision's real symptom: React reuses the primary row's node for
      // the secondary one, the user clicks "Lines 52-55" under "Also appears
      // here" and the pane reveals lines 12-18.
      const harness = mountWithRows();
      const labelsBefore = harness.rows().map((row) => row.textContent);
      expect(labelsBefore).toEqual(['Lines 12–18', 'Lines 41–47', 'Line 20', 'Lines 52–55']);

      harness.setProps({ config: makeConfig({ token: { ...makeConfig().token, name: 'x' } }) });
      expect(harness.rows().map((row) => row.textContent)).toEqual(labelsBefore);
    });
  });

  // -------------------------------------------------------------------------
  // INV-7 / INV-22 — the header is outside the scroller, which is unconditional
  // -------------------------------------------------------------------------
  describe('header and scroll region (INV-7, INV-22)', () => {
    const kinds: readonly (readonly [string, Partial<ColumnProps>, boolean])[] = [
      ['no-preview', { provenance: null }, false],
      ['unsupported', { provenance: unsupportedProvenance() }, false],
      ['no-focus', {}, false],
      [
        'pending',
        {
          provenance: availableProvenance([], {
            identity: TEST_IDENTITY,
            liveIdentity: 'moved',
          }).provenance,
        },
        true,
      ],
      ['empty', { provenance: availableProvenance([]).provenance }, true],
      ['groups', {}, true],
    ];

    for (const [label, props, needsFocus] of kinds) {
      it(`renders the header outside the scroller in the ${label} state`, () => {
        const harness = needsFocus ? mountWithRows(props) : mountColumn(props);
        const header = harness.root.querySelector('.rwa-code-preview-impact-field')!;
        expect(header, `${label} dropped the header`).not.toBeNull();
        expect(
          harness.scroller.contains(header),
          `${label} put the header inside the scroller`
        ).toBe(false);
        expect(
          header.compareDocumentPosition(harness.scroller) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
      });
    }

    it('renders the scroll region for a one-row fixture as well as the worst case', () => {
      // Not row-count-gated: the worst case is taller than the available row
      // height at every supported viewport, so scrolling is the ordinary path.
      const single = mountWithRows({
        provenance: availableProvenance([group('a.rs', [fileRow()])]).provenance,
      });
      expect(single.scroller).not.toBeNull();
      expect(single.rows()).toHaveLength(1);
      single.unmount();

      const tall = mountWithRows({ provenance: availableProvenance(tallGroups()).provenance });
      expect(tall.scroller).not.toBeNull();
      expect(tall.rows()).toHaveLength(22);
    });

    it('renders the sticky file heading for a one-row fixture too', () => {
      const harness = mountWithRows({
        provenance: availableProvenance([group('a.rs', [fileRow()])]).provenance,
      });
      expect(harness.root.querySelectorAll('h4')).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // INV-21 / SF-21 INV-16 — the memo has exactly four inputs, one test each
  // -------------------------------------------------------------------------
  describe('memoises on exactly four props (INV-21 / SF-21 INV-16)', () => {
    /**
     * The seam lookup is the render counter. `toFieldImpactView` calls it
     * exactly once per evaluation that resolves a field (INV-11), so its call
     * count grows by exactly one per column render that reaches the rows — no
     * component is instrumented and the count cannot drift from the render.
     */
    function countingHarness() {
      const first = availableProvenance(mixedGroups());
      const harness = mountWithRows({ provenance: first.provenance });
      return { harness, lookups: first.lookups };
    }

    it('a parent re-render with all four props unchanged renders the column zero times', () => {
      // This is the point of the memo. The sheet re-renders on every
      // `pointermove` of a height drag while none of these props change; each
      // unmemoised render would run a seam lookup linear in the provenance size
      // at 60Hz, and the stutter would look like the code pane's problem.
      const { harness, lookups } = countingHarness();
      const before = lookups.length;
      expect(before).toBeGreaterThan(0);

      harness.setProps({});
      harness.setProps({});
      harness.setProps({});

      expect(lookups.length - before, 'the memo did not bail out').toBe(0);
    });

    it('input 1 — a new config re-renders it', () => {
      const { harness, lookups } = countingHarness();
      const before = lookups.length;
      harness.setProps({ config: makeConfig({ token: { ...makeConfig().token, name: 'x' } }) });
      expect(lookups.length - before).toBe(1);
    });

    it('input 2 — a new provenance re-renders it', () => {
      const { harness } = countingHarness();
      const next = availableProvenance(mixedGroups());
      harness.setProps({ provenance: next.provenance });
      expect(next.lookups.length).toBe(1);
    });

    it('input 3 — a new onReveal re-renders it', () => {
      const { harness, lookups } = countingHarness();
      const before = lookups.length;
      harness.setProps({ onReveal: vi.fn() });
      expect(lookups.length - before).toBe(1);
    });

    it('input 4 — a new drawerOpen re-renders it', () => {
      // onReveal null so auto-select (INV-9) does not fire a second render via
      // setActiveSite — this case measures the memo input alone.
      const first = availableProvenance(mixedGroups());
      const harness = mountWithRows({ provenance: first.provenance, onReveal: null });
      const before = first.lookups.length;
      harness.setProps({ drawerOpen: true });
      expect(first.lookups.length - before).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // INV-39 — nothing throws and nothing logs
  // -------------------------------------------------------------------------
  describe('never throws and never logs (INV-39)', () => {
    it('exercises all seven states and every row kind without a single logger call', () => {
      const spies = (['debug', 'info', 'warn', 'error'] as const).map((level) => ({
        level,
        spy: vi.spyOn(logger, level).mockImplementation(() => {}),
      }));

      const onReveal = vi.fn();
      const harness = mountColumn({ provenance: null, onReveal });
      harness.setProps({ provenance: noneProvenance() });
      harness.setProps({ provenance: unsupportedProvenance() });
      harness.setProps({ provenance: availableProvenance([]).provenance });
      focusField(harness);
      harness.setProps({
        provenance: availableProvenance([], {
          identity: TEST_IDENTITY,
          liveIdentity: 'moved',
        }).provenance,
      });
      harness.setProps({
        provenance: availableProvenance([group('a.rs', [fileRow(), createdRow(), rangeRow(1, 2)])])
          .provenance,
      });
      for (const row of harness.rows()) {
        act(() => {
          row.click();
        });
      }
      expect(onReveal).toHaveBeenCalledTimes(3);

      for (const { level, spy } of spies) {
        expect(spy, `logger.${level} was called`).not.toHaveBeenCalled();
      }
    });

    it('renders a group whose primary side is empty without a crash and without a special case', () => {
      // The types say this cannot happen — `file` and `created` are the literal
      // 'primary', and a group with only secondary ranges is impossible because
      // significance is answered per attribution against a query that matched.
      // If it ever stops holding, the column must degrade to the secondary list
      // rather than fail, so nothing has to guard it.
      const harness = mountWithRows({
        provenance: availableProvenance([
          group('a.rs', [rangeRow(4, 9, 'secondary'), rangeRow(20, 20, 'secondary')]),
        ]).provenance,
      });
      expect(harness.rows()).toHaveLength(2);
      expect(harness.getByText('Mentions')).toBeInTheDocument();
      expect(harness.root.querySelectorAll('ul')).toHaveLength(2);
      expect(harness.root.querySelectorAll('ul')[0]!.children).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // INV-19 (restated) — an activation during a refresh still lands
  // -------------------------------------------------------------------------
  describe('finishes a range activation against the tree that arrives (INV-19)', () => {
    const STALE = { identity: TEST_IDENTITY, liveIdentity: 'moved' } as const;

    let revealSpy: ReturnType<typeof vi.fn>;

    /** `onReveal`'s arguments, typed for the range half the harness prop elides. */
    function calls(): { path: string; range?: { startLine: number; endLine: number } }[] {
      return (revealSpy.mock.calls as unknown[][]).map(
        (call) => call[0] as { path: string; range?: { startLine: number; endLine: number } }
      );
    }

    function mountStale(groups = mixedGroups()) {
      revealSpy = vi.fn();
      return mountWithRows({
        provenance: availableProvenance(groups, STALE).provenance,
        onReveal: revealSpy,
      });
    }

    /** The same sites, one tree later: every range has shifted by ten lines. */
    function shifted() {
      return [
        group('scripts/deploy.sh', [
          rangeRow(22, 28),
          rangeRow(30, 30, 'secondary'),
          rangeRow(51, 57),
          rangeRow(62, 65, 'secondary'),
        ]),
      ];
    }

    it('reveals the file at once and holds the range, rather than sending a doomed one', () => {
      // The defect this closes: a range sent here is stamped with the on-screen
      // tree's key and dropped the instant the newer tree lands (SF-9 INV-4
      // row 4), so the click looked live and did nothing at all.
      const harness = mountStale();
      act(() => {
        harness.rows()[0]!.click();
      });

      expect(calls()).toHaveLength(1);
      expect(calls()[0]).toEqual({ path: 'scripts/deploy.sh' });
      expect('range' in calls()[0]!).toBe(false);
    });

    it('re-issues the range once the tree settles, re-resolved against the NEW rows', () => {
      // Re-resolved, not replayed: the fixture shifts every range by ten lines,
      // so a replay of the captured range would be visibly wrong here.
      const harness = mountStale();
      act(() => {
        harness.rows()[0]!.click();
      });

      act(() => {
        harness.setProps({
          provenance: availableProvenance(shifted(), {
            identity: 'settled',
            liveIdentity: 'settled',
          }).provenance,
          onReveal: revealSpy,
        });
      });

      expect(calls()).toHaveLength(2);
      expect(calls()[1]).toEqual({
        path: 'scripts/deploy.sh',
        range: { startLine: 22, endLine: 28 },
      });
    });

    it('holds across an intermediate tree that is itself already stale', () => {
      // One request, satisfied when the typing stops — not one per tick.
      const harness = mountStale();
      act(() => {
        harness.rows()[0]!.click();
      });

      act(() => {
        harness.setProps({
          provenance: availableProvenance(shifted(), {
            identity: 'mid',
            liveIdentity: 'still-typing',
          }).provenance,
          onReveal: revealSpy,
        });
      });
      expect(calls()).toHaveLength(1);

      act(() => {
        harness.setProps({
          provenance: availableProvenance(shifted(), {
            identity: 'settled',
            liveIdentity: 'settled',
          }).provenance,
          onReveal: revealSpy,
        });
      });
      expect(calls()).toHaveLength(2);
    });

    it('drops the held range without revealing when its site is gone', () => {
      // The site no longer exists in the tree that arrived. Nothing is
      // synthesised in its place — that is the same rule a `created` row obeys.
      const harness = mountStale();
      act(() => {
        harness.rows()[0]!.click();
      });

      act(() => {
        harness.setProps({
          provenance: availableProvenance([group('scripts/deploy.sh', [fileRow()])], {
            identity: 'settled',
            liveIdentity: 'settled',
          }).provenance,
          onReveal: revealSpy,
        });
      });

      expect(calls()).toHaveLength(1);
    });

    it('sends the range immediately when no refresh is in flight', () => {
      // The unchanged path, and the majority of activations: one call, with the
      // range, exactly as INV-19's table says.
      revealSpy = vi.fn();
      const harness = mountWithRows({ onReveal: revealSpy });
      act(() => {
        harness.rows()[0]!.click();
      });

      expect(calls()).toHaveLength(1);
      expect(calls()[0]).toEqual({
        path: 'scripts/deploy.sh',
        range: { startLine: 12, endLine: 18 },
      });
    });

    it('leaves file and created rows alone, because they carry no range to invalidate', () => {
      const harness = mountStale([group('README.md', [fileRow(), createdRow()])]);
      act(() => {
        harness.rows()[0]!.click();
        harness.rows()[1]!.click();
      });

      expect(calls()).toEqual([{ path: 'README.md' }, { path: 'README.md' }]);

      act(() => {
        harness.setProps({
          provenance: availableProvenance([group('README.md', [fileRow(), createdRow()])], {
            identity: 'settled',
            liveIdentity: 'settled',
          }).provenance,
          onReveal: revealSpy,
        });
      });

      expect(calls()).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // INV-41 — the region always has a non-empty accessible name
  // -------------------------------------------------------------------------
  describe('always has a non-empty accessible name that names the field (INV-41)', () => {
    it('both aria-labelledby ids resolve to elements in the document', () => {
      // A dangling id is silent: the browser drops the missing part, and the
      // name degrades without anything failing.
      const harness = mountColumn();
      const ids = harness.root.getAttribute('aria-labelledby')!.split(' ');
      expect(ids).toHaveLength(2);
      for (const id of ids) {
        expect(document.getElementById(id), `aria-labelledby id ${id} is dangling`).not.toBeNull();
      }
    });

    it('is named in every one of the seven kinds', () => {
      const cases: readonly (readonly [string, Partial<ColumnProps>, boolean])[] = [
        ['no-preview', { provenance: null }, false],
        ['unsupported', { provenance: unsupportedProvenance() }, false],
        ['no-focus', {}, false],
        [
          'pending',
          {
            provenance: availableProvenance([], {
              identity: TEST_IDENTITY,
              liveIdentity: 'moved',
            }).provenance,
          },
          true,
        ],
        ['empty', { provenance: availableProvenance([]).provenance }, true],
        ['groups', {}, true],
      ];

      for (const [label, props, needsFocus] of cases) {
        const harness = needsFocus ? mountWithRows(props) : mountColumn(props);
        const region = harness.getByRole('region');
        expect(region.textContent, label).toBeDefined();
        const name = harness.root
          .getAttribute('aria-labelledby')!
          .split(' ')
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim();
        expect(name, `${label} has an empty accessible name`).not.toBe('');
        expect(name, label).toContain('Field impact');
        harness.unmount();
      }
    });

    it('names the described field in pending, empty and groups', () => {
      for (const props of [
        {
          provenance: availableProvenance([], {
            identity: TEST_IDENTITY,
            liveIdentity: 'moved',
          }).provenance,
        },
        { provenance: availableProvenance([]).provenance },
        {},
      ]) {
        const harness = mountWithRows(props);
        const name = harness.root
          .getAttribute('aria-labelledby')!
          .split(' ')
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ');
        // The humanised spelling of the same `ConfigPath` — a pure function of
        // it, so the name still cannot disagree with what is on screen.
        expect(name).toContain('Token · Name');
        harness.unmount();
      }
    });

    it('keeps naming the pinned field across the pointer sequence', () => {
      const harness = mountWithRows();
      const nameOf = () =>
        harness.root
          .getAttribute('aria-labelledby')!
          .split(' ')
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ');
      const before = nameOf();

      act(() => {
        harness.root.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        harness.rows()[0]!.focus();
      });

      expect(nameOf()).toBe(before);
    });
  });

  // -------------------------------------------------------------------------
  // INV-42 — exactly one static tab stop, on the root
  // -------------------------------------------------------------------------
  describe('carries exactly one static tab stop, on the root (INV-42)', () => {
    const cases: readonly (readonly [string, Partial<ColumnProps>, boolean])[] = [
      ['no-preview', { provenance: null }, false],
      ['unsupported', { provenance: unsupportedProvenance() }, false],
      ['no-focus', {}, false],
      ['empty', { provenance: availableProvenance([]).provenance }, true],
      ['groups', {}, true],
      ['groups (22 rows)', { provenance: availableProvenance(tallGroups()).provenance }, true],
    ];

    for (const [label, props, needsFocus] of cases) {
      it(`has one tabindex, valued 0, on the column root in the ${label} state`, () => {
        const harness = needsFocus ? mountWithRows(props) : mountColumn(props);
        const stops = [...harness.root.querySelectorAll('[tabindex]')];
        const rootHasStop = harness.root.hasAttribute('tabindex');

        expect(rootHasStop, `${label}: the column root lost its tab stop`).toBe(true);
        expect(harness.root.getAttribute('tabindex')).toBe('0');
        expect(
          stops,
          `${label}: a descendant grew a tabindex — that is a roving list`
        ).toHaveLength(0);
        expect(harness.root.querySelectorAll('[aria-activedescendant]')).toHaveLength(0);
        expect(harness.root.hasAttribute('aria-activedescendant')).toBe(false);
      });
    }

    it('renders every row as a real button of type button', () => {
      // Enter and Space activate for free, with no key handling of our own.
      const harness = mountWithRows({
        provenance: availableProvenance([group('a.rs', [fileRow(), createdRow(), rangeRow(1, 2)])])
          .provenance,
      });
      const rows = harness.rows();
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row.tagName).toBe('BUTTON');
        expect(row.getAttribute('type')).toBe('button');
        expect(row.parentElement!.tagName).toBe('LI');
      }
    });
  });

  // -------------------------------------------------------------------------
  // INV-43 — text carries the distinction; real headings carry the grouping
  // -------------------------------------------------------------------------
  describe('carries the distinction in text and the grouping in headings (INV-43)', () => {
    it('nests an h4 per file and an h5 per secondary group', () => {
      const harness = mountWithRows({
        provenance: availableProvenance([
          group('contracts/rwa-token/src/contract.rs', [rangeRow(1, 2)]),
          group('scripts/deploy.sh', [rangeRow(1, 2), rangeRow(9, 9, 'secondary')]),
        ]).provenance,
      });
      expect(harness.root.querySelectorAll('h4')).toHaveLength(2);
      expect(harness.root.querySelectorAll('h5')).toHaveLength(1);
      expect(harness.root.querySelector('h5')!.textContent).toBe('Mentions');
    });

    it('renders the leaf and the directory as separate text, both non-empty', () => {
      const harness = mountWithRows({
        provenance: availableProvenance([
          group('contracts/compliance/modules/max-balance/src/contract.rs', [rangeRow(1, 2)]),
        ]).provenance,
      });
      expect(harness.root.querySelector('.rwa-code-preview-impact-leaf')!.textContent).toBe(
        'contract.rs'
      );
      expect(harness.root.querySelector('.rwa-code-preview-impact-dir')!.textContent).toBe(
        'contracts/compliance/modules/max-balance/src'
      );
      expect(harness.root.querySelector('h4')!.getAttribute('title')).toBe(
        'contracts/compliance/modules/max-balance/src/contract.rs'
      );
    });

    it('omits the directory line for a root-level file rather than rendering an empty one', () => {
      const harness = mountWithRows({
        provenance: availableProvenance([group('README.md', [fileRow()])]).provenance,
      });
      expect(harness.root.querySelector('.rwa-code-preview-impact-leaf')!.textContent).toBe(
        'README.md'
      );
      expect(harness.root.querySelector('.rwa-code-preview-impact-dir')).toBeNull();
    });

    it('distinguishes the two groups by text alone, with every class attribute removed', () => {
      // Tone is decoration layered on the heading word; strip every class and
      // the distinction must survive, because colour was never the axis.
      const harness = mountWithRows({
        provenance: availableProvenance([
          group('a.rs', [rangeRow(1, 2), rangeRow(9, 9, 'secondary')]),
        ]).provenance,
      });
      for (const element of harness.root.querySelectorAll('[class]')) {
        element.removeAttribute('class');
      }
      expect(harness.root.textContent).toContain('Mentions');
      expect(harness.root.querySelectorAll('h5')).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // INV-13 clause 3 — the column starts at no-focus on a fresh mount
  // -------------------------------------------------------------------------
  it('starts at no-focus on a fresh mount, holding nothing from the last one (INV-13)', () => {
    const first = mountWithRows();
    expect(first.rows().length).toBeGreaterThan(0);
    first.unmount();

    const second = mountColumn();
    expect(second.getByText('No field selected')).toBeInTheDocument();
    expect(second.rows()).toHaveLength(0);
  });
});
