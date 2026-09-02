import { act, render, type RenderResult } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PreviewDrawerBody } from './components/PreviewDrawerBody';
import type { CodePreviewPhase } from './hooks/useCodePreview';

import { makeConfig } from '../../test/fixtures/wizardFixtures';
import { collectFocusable } from '../../test/helpers/focusedPathHarness';
import {
  availableProvenance,
  createColumnRecorder,
  mixedGroups,
  tallGroups,
} from '../../test/helpers/impactHarness';
import { CONFIG_ANCHOR_ATTR, tokenAnchor } from '../wizard/focused-path';
import { InspectedAnchorProvider } from '../wizard/inspected-anchor';
import type { CodePreviewProvenance } from './provenanceState';

const FILES = { 'README.md': '# readme', 'src/lib.rs': 'pub fn main() {}' };

const READY: CodePreviewPhase = {
  kind: 'ready',
  files: FILES,
  configHash: 'hash',
  substitutedKeys: [],
  changedPaths: [],
  generateKey: 'hash|identity:0|service:test',
};

interface BodyProps {
  readonly treeVisible: boolean;
  readonly provenance: CodePreviewProvenance | null;
  readonly onReveal: ((target: { path: string }) => void) | null;
}

interface DrawerHarness extends RenderResult {
  readonly row: HTMLElement;
  readonly column: HTMLElement;
  readonly rows: () => HTMLButtonElement[];
}

/**
 * The real drawer body, with the two things the tab route runs between: an
 * anchored config control ahead of it, and a plain control behind it.
 *
 * The trailing sentinel is not decoration. It is the element focus lands on when
 * the column is *not* reachable — which is exactly what happened before the tab
 * stop existed, and what a reachability test that starts inside the column can
 * never see.
 */
function mountBody(overrides: Partial<BodyProps> = {}): DrawerHarness {
  const props: BodyProps = {
    treeVisible: false,
    provenance: availableProvenance(mixedGroups()).provenance,
    onReveal: vi.fn(),
    ...overrides,
  };

  const config = makeConfig();
  const result = render(
    // SF-14: the column keeps its rows across the tab route because the
    // inspected subject survives focus moving into the column, which is what
    // `HeldField` used to do. Named for re-pointing by SF-14 Design § 8.3.
    <InspectedAnchorProvider scopeToken="test" modules={config.compliance.modules}>
      <div>
        <input data-testid="field-a" {...{ [CONFIG_ANCHOR_ATTR]: tokenAnchor('name') }} />
        <PreviewDrawerBody
          phase={READY}
          selectedPath="README.md"
          onSelectedPathChange={() => {}}
          files={FILES}
          changedPaths={[]}
          errorMessages={undefined}
          boundaryResetKey="reset"
          sourceRevision={null}
          importLinks={null}
          treeVisible={props.treeVisible}
          config={config}
          provenance={props.provenance}
          onReveal={props.onReveal}
          drawerOpen
          dockPosition="bottom"
        />
        <button data-testid="sentinel" type="button">
          after the drawer
        </button>
      </div>
    </InspectedAnchorProvider>
  );

  const row = result.container.querySelector<HTMLElement>('.rwa-code-preview')!;
  const column = result.container.querySelector<HTMLElement>('.rwa-code-preview-impact')!;
  return {
    ...result,
    row,
    column,
    rows: () => [...column.querySelectorAll<HTMLButtonElement>('li > button')],
  };
}

function focus(element: HTMLElement): void {
  act(() => {
    element.focus();
  });
}

describe('code-preview drawer with the field-impact column', () => {
  // -------------------------------------------------------------------------
  // INV-1 — three children, in reading order, always mounted
  // -------------------------------------------------------------------------
  describe('renders three regions in reading order (INV-1)', () => {
    const matrix: readonly (readonly [string, Partial<BodyProps>])[] = [
      ['tree shown, provenance available', { treeVisible: true }],
      ['tree hidden, provenance available', { treeVisible: false }],
      ['tree shown, provenance null', { treeVisible: true, provenance: null, onReveal: null }],
      ['tree hidden, provenance null', { treeVisible: false, provenance: null, onReveal: null }],
    ];

    for (const [label, props] of matrix) {
      it(`has exactly three element children — ${label}`, () => {
        const harness = mountBody(props);
        const children = [...harness.row.children];
        expect(children, label).toHaveLength(3);
        expect(children[2], `${label}: the column is not the third sibling`).toBe(harness.column);
        // Reading order, which is also the tab order: tree, code, column.
        expect(
          children[0]!.getAttribute('aria-hidden'),
          `${label}: child 0 is not the tree wrapper`
        ).not.toBeNull();
        expect(
          children[1]!.contains(harness.column),
          `${label}: the column is inside the pane`
        ).toBe(false);
        harness.unmount();
      });
    }

    it('mounts the column unconditionally — no treeVisible test gates it in JS', () => {
      // Matching the container query in JS would state the rule twice. The two
      // disagree above the threshold, the column vanishes at 1280 for every user
      // with the tree shown, and nothing in this suite could see it: happy-dom
      // never evaluates the query, so the column is always in the DOM here.
      // That is why this is a structure assertion and not a visibility one
      // (INV-23).
      for (const treeVisible of [true, false]) {
        const harness = mountBody({ treeVisible });
        expect(harness.column, `treeVisible=${treeVisible}`).toBeInTheDocument();
        harness.unmount();
      }
    });
  });

  // -------------------------------------------------------------------------
  // INV-15 — the attribute React owns renders the literal the selector matches
  // -------------------------------------------------------------------------
  describe('stamps data-tree-visible as the literal string (INV-15)', () => {
    it('renders "true" with the tree shown', () => {
      expect(mountBody({ treeVisible: true }).row.getAttribute('data-tree-visible')).toBe('true');
    });

    it('renders "false" with the tree hidden — never absent, never empty', () => {
      const harness = mountBody({ treeVisible: false });
      expect(harness.row.hasAttribute('data-tree-visible')).toBe(true);
      expect(harness.row.getAttribute('data-tree-visible')).toBe('false');
    });

    it('renders "true" when treeVisible is left to its default', () => {
      const result = render(
        <PreviewDrawerBody
          phase={READY}
          selectedPath="README.md"
          onSelectedPathChange={() => {}}
          files={FILES}
          changedPaths={[]}
          errorMessages={undefined}
          boundaryResetKey="reset"
          sourceRevision={null}
          importLinks={null}
          config={makeConfig()}
          provenance={null}
          onReveal={null}
          drawerOpen
          dockPosition="bottom"
        />
      );
      expect(
        result.container.querySelector('.rwa-code-preview')!.getAttribute('data-tree-visible')
      ).toBe('true');
    });
  });

  // -------------------------------------------------------------------------
  // INV-14 — the three inputs arrive as props, and the null guard degrades
  // -------------------------------------------------------------------------
  describe('threads the three new inputs as props (INV-14)', () => {
    it('renders rows against the provenance it was handed', () => {
      const harness = mountBody({ provenance: availableProvenance(tallGroups()).provenance });
      focus(harness.getByTestId('field-a'));
      expect(harness.rows()).toHaveLength(22);
    });

    it('renders the rows disabled, not missing, when onReveal is null', () => {
      const harness = mountBody({ onReveal: null });
      focus(harness.getByTestId('field-a'));
      const rows = harness.rows();
      expect(rows).toHaveLength(4);
      expect(rows.every((button) => button.disabled)).toBe(true);
      expect(() => act(() => rows[0]!.click())).not.toThrow();
    });

    it('renders no-preview when provenance is null, without disturbing the other regions', () => {
      const harness = mountBody({ provenance: null, onReveal: null });
      expect(harness.getByText('No code preview')).toBeInTheDocument();
      expect([...harness.row.children]).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // INV-42 — reachable from outside; the walk may not start inside the column
  // -------------------------------------------------------------------------
  describe('is reachable by keyboard from outside itself (INV-42)', () => {
    /**
     * Sequential tab order equals DOM order only when nothing carries a positive
     * `tabindex`. Asserted rather than assumed, because the walk below reads the
     * order off the DOM.
     */
    function focusOrder(harness: DrawerHarness): HTMLElement[] {
      const stops = [...harness.container.querySelectorAll('[tabindex]')];
      for (const stop of stops) {
        expect(
          ['0', '-1'],
          `a positive tabindex makes DOM order stop being the tab order: ${stop.outerHTML.slice(0, 80)}`
        ).toContain(stop.getAttribute('tabindex'));
      }
      return collectFocusable(harness.container);
    }

    it('the column root is a stop in the document tab order', () => {
      const harness = mountBody();
      expect(
        focusOrder(harness),
        'the column is not in the tab order at all — a user cannot reach it'
      ).toContain(harness.column);
    });

    it('tabbing forward from the code pane lands on the column, not past it', () => {
      // Reachability: the column root must sit in the tab order immediately after
      // the code pane. Preview-chrome reach keeps the field's rows while focus is
      // in the code pane (so the old "empty on the way" frame is gone); what this
      // still pins is that Tab from that chrome lands on the column root, not the
      // sentinel behind the drawer.
      const harness = mountBody();

      focus(harness.getByTestId('field-a'));
      expect(harness.rows().length, 'precondition: a focused field fills the column').toBe(4);

      const order = focusOrder(harness);
      const columnIndex = order.indexOf(harness.column);
      expect(columnIndex, 'the column root is not focusable').toBeGreaterThan(0);

      const beforeColumn = order[columnIndex - 1]!;
      expect(
        harness.column.contains(beforeColumn),
        'the walk must start OUTSIDE the column, or it cannot discover it is unreachable'
      ).toBe(false);

      focus(beforeColumn);
      // Preview-chrome reach: rows stay while the code pane holds focus.
      expect(harness.rows().length, "code-pane focus must keep the field's rows").toBe(4);

      const next = focusOrder(harness)[focusOrder(harness).indexOf(beforeColumn) + 1]!;
      expect(
        next,
        `Tab from the code pane reached ${next.getAttribute('data-testid') ?? next.tagName} instead of the column`
      ).toBe(harness.column);

      focus(harness.column);
      expect(document.activeElement).toBe(harness.column);
      expect(harness.rows().length).toBe(4);

      const afterLanding = focusOrder(harness);
      const rowStop = afterLanding[afterLanding.indexOf(harness.column) + 1]!;
      expect(harness.column.contains(rowStop), 'the next stop is outside the column').toBe(true);
      expect(rowStop.tagName).toBe('BUTTON');
      expect(rowStop).toBe(harness.rows()[0]);
    });

    it('never lands on the sentinel behind the drawer while the column is present', () => {
      const harness = mountBody();
      focus(harness.getByTestId('field-a'));
      const order = focusOrder(harness);
      const columnIndex = order.indexOf(harness.column);
      const sentinelIndex = order.indexOf(harness.getByTestId('sentinel'));

      // Both indices are pinned as *present* before they are compared. Without
      // this, an absent column is -1, `-1 < sentinelIndex` holds, and the test
      // reports the column correctly ordered at the exact moment it has left the
      // tab order altogether — the vacuous pass this sub-feature has already met
      // twice.
      expect(columnIndex, 'the column is not in the tab order').toBeGreaterThanOrEqual(0);
      expect(sentinelIndex, 'the sentinel is not in the tab order').toBeGreaterThanOrEqual(0);
      expect(columnIndex).toBeLessThan(sentinelIndex);
    });
  });

  // -------------------------------------------------------------------------
  // INV-44 clause 2 — the file tree's own mechanism is untouched
  // -------------------------------------------------------------------------
  describe('leaves the file tree mechanism exactly as it was (INV-44)', () => {
    for (const treeVisible of [true, false]) {
      it(`keeps the tree mounted, width-animated and inert-toggled at treeVisible=${treeVisible}`, () => {
        const harness = mountBody({ treeVisible });
        const wrapper = harness.row.children[0] as HTMLElement;

        expect(wrapper.style.width).toBe(treeVisible ? '280px' : '0px');
        expect(wrapper.getAttribute('aria-hidden')).toBe(treeVisible ? 'false' : 'true');
        expect(wrapper.className).toContain('transition-[width]');
        // Mounted either way, so the tree's expansion state survives the toggle.
        expect(wrapper.children.length).toBeGreaterThan(0);
      });
    }

    it('does not put the column inside the tree wrapper or the code pane', () => {
      const harness = mountBody({ treeVisible: true });
      expect((harness.row.children[0] as HTMLElement).contains(harness.column)).toBe(false);
      expect((harness.row.children[1] as HTMLElement).contains(harness.column)).toBe(false);
    });

    it('stamps SF-20 join classes on the tree slot and code pane (SC-017)', () => {
      const harness = mountBody({ treeVisible: true });
      const treeSlot = harness.row.children[0] as HTMLElement;
      const codePane = harness.row.children[1] as HTMLElement;
      expect(treeSlot.className).toContain('rwa-code-preview-tree-slot');
      // Selected file → opaque chrome; empty state uses a different root class.
      expect(codePane.className).toContain('rwa-code-preview-code-pane');
    });
  });

  // -------------------------------------------------------------------------
  // INV-13 — the column persists nothing
  // -------------------------------------------------------------------------
  describe('persists nothing (INV-13)', () => {
    it('leaves localStorage untouched across a full exercise of the column', () => {
      const before = { ...readStorage() };
      const recorder = createColumnRecorder();
      const harness = mountBody({
        provenance: recorder.watch(availableProvenance(mixedGroups())),
      });

      focus(harness.getByTestId('field-a'));
      act(() => harness.rows()[0]!.click());
      focus(harness.column);
      harness.unmount();

      expect(readStorage()).toEqual(before);
    });

    it('adds no storage key of its own — the key set stays the three the drawer had', () => {
      const harness = mountBody();
      focus(harness.getByTestId('field-a'));
      const keys = Object.keys(readStorage()).filter((key) => key.startsWith('rwa-wizard:'));
      const impactKeys = keys.filter((key) => /impact|field|provenance/i.test(key));
      expect(impactKeys, `the column added ${impactKeys.join(', ')}`).toHaveLength(0);
    });
  });
});

function readStorage(): Record<string, string> {
  const entries: Record<string, string> = {};
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key !== null) entries[key] = window.localStorage.getItem(key) ?? '';
  }
  return entries;
}
