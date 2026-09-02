import { act, fireEvent, render, type RenderResult } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import { CopyContext } from '../../../app/providers/CopyContext';
import { makeConfig } from '../../../test/fixtures/wizardFixtures';
import {
  availableProvenance,
  createColumnRecorder,
  mixedGroups,
  noneProvenance,
  tallGroups,
  TEST_IDENTITY,
  unsupportedProvenance,
  type ColumnRecorder,
} from '../../../test/helpers/impactHarness';
import type { ConfigPath } from '../../wizard/config-path';
import { CONFIG_ANCHOR_ATTR, roleAnchor, tokenAnchor } from '../../wizard/focused-path';
import { InspectedAnchorProvider } from '../../wizard/inspected-anchor';
import { PreviewImpactColumn } from '../components/PreviewImpactColumn';
import type { CodePreviewProvenance } from '../provenanceState';
import { humaniseConfigPath } from './humaniseConfigPath';

// ---------------------------------------------------------------------------
// INV-12 — the type-level precondition, moved and narrowed by SF-14
// ---------------------------------------------------------------------------

/**
 * > *Superseded assertion (kept, and relocated rather than deleted).*
 * > `const CONFIG_PATH_IS_VALUE_COMPARABLE: ConfigPath extends string ? true : false = true;`
 * > — the precondition of the render-phase `setHeld` in `useFieldImpact`, whose
 * > guard compared `live.path` against `held.path`. A string comparison is by
 * > value, so the update converged in one extra render pass; an object or a
 * > per-resolution branded wrapper would have made it true on every render and
 * > looped to React's update-depth limit.
 *
 * **The hazard is gone rather than relocated, and the guard is narrowed rather
 * than dropped.** There is no render-phase state write left in this unit
 * (SF-14 INV-29), so "Too many re-renders" is unreachable here. What still needs
 * a value comparison is the inspected store's no-op bail-out: a non-string
 * subject would make `inspect` compare by identity, always miss, and notify on
 * every `focusin` inside an already-inspected cluster — a re-render storm on
 * the drawer's hot path rather than a crash.
 *
 * So the assertion lives at
 * `features/wizard/inspected-anchor/inspectedAnchorStore.test.ts` as
 * `CONFIG_ANCHOR_KEY_IS_VALUE_COMPARABLE`. SF-13 INV-12, restated by SF-14
 * INV-7.
 */

const FIELD_A = 'token.name' as ConfigPath;
const FIELD_B = 'token.symbol' as ConfigPath;

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface HostProps {
  readonly config: RWAConfig;
  readonly provenance: CodePreviewProvenance | null;
  readonly onReveal: ((target: { path: string }) => void) | null;
}

/**
 * The column, mounted beside the two things the latch is defined against: real
 * anchored config controls that SF-12's resolver answers for, and an
 * unresolvable control outside the column.
 *
 * A stable component type, declared at module scope: re-rendering through a
 * freshly declared inline component would unmount and remount the column,
 * resetting the very `useState` values these tests are about and turning "the
 * prop changed" into "the hook was rebuilt".
 */
function Host({ config, provenance, onReveal }: HostProps) {
  return (
    // The provider is what preserves the column's answer across a reach into it
    // now that `HeldField` is gone: `columnHasFocus` narrowed to "do not clear
    // the subject", and the subject itself is what rows 4 and 5 of INV-22 keep.
    // In the app it wraps both the form subtree and the drawer; a harness that
    // omits it is not a smaller app, it is one with the feature switched off.
    // SF-14 INV-13, INV-22.
    <InspectedAnchorProvider scopeToken="test" modules={config.compliance.modules}>
      <div>
        <input data-testid="field-a" {...{ [CONFIG_ANCHOR_ATTR]: tokenAnchor('name') }} />
        <input data-testid="field-b" {...{ [CONFIG_ANCHOR_ATTR]: tokenAnchor('symbol') }} />
        <button data-testid="outside" type="button">
          outside
        </button>
        {/*
          A control naming a location that RESOLVES but does not EXIST — an
          operator role with no addresses. `roleAnchor` resolves to
          `accessControl.roles[0].addresses`, the pending slot, and
          `anchorItemExists` refuses it. This is the shape the layout probe's V9
          walks, and it is the one shape whose AS-3 latch SF-14 currently loses.
        */}
        <div {...{ [CONFIG_ANCHOR_ATTR]: roleAnchor('Manager') }}>
          <input data-testid="pending-role" />
        </div>
        {/*
          Drawer chrome mirror: form controls stay *outside* the sheet so clause 1
          still clears for wizard chrome (`outside`). Focus inside the sheet /
          `.rwa-code-preview` (code pane / tree) is reach; the dock menu portal
          stand-in sits *outside* the sheet with `data-rwa-preview-chrome` the way
          Radix portals DropdownMenuContent.
        */}
        <div className="rwa-code-preview-sheet" data-slot="bottom-sheet">
          <div data-slot="bottom-sheet-header">
            <div role="group" aria-label="Preview layout">
              <button data-testid="dock-trigger" type="button">
                Dock position
              </button>
            </div>
          </div>
          <div className="rwa-code-preview">
            <button data-testid="code-pane" type="button" className="rwa-code-preview-code-pane">
              code
            </button>
            <button data-testid="tree" type="button" className="rwa-code-preview-tree-slot">
              tree
            </button>
            <PreviewImpactColumn
              config={config}
              provenance={provenance}
              onReveal={onReveal}
              drawerOpen={false}
            />
          </div>
        </div>
        <div data-rwa-preview-chrome="" role="menu">
          <button data-testid="dock-menu-item" type="button" role="menuitemradio">
            Dock preview to left
          </button>
        </div>
      </div>
    </InspectedAnchorProvider>
  );
}

interface Harness extends RenderResult {
  readonly recorder: ColumnRecorder;
  readonly root: HTMLElement;
  readonly rows: () => HTMLButtonElement[];
  readonly setProps: (next: Partial<HostProps>) => void;
}

function mountColumn(initial: Partial<HostProps> = {}): Harness {
  const recorder = createColumnRecorder();
  let props: HostProps = {
    config: makeConfig(),
    provenance: recorder.watch(availableProvenance(mixedGroups())),
    onReveal: vi.fn(),
    ...initial,
  };

  const tree = (value: HostProps) => (
    <CopyContext.Provider value={recorder.copy}>
      <Host {...value} />
    </CopyContext.Provider>
  );

  const result = render(tree(props));
  const root = result.container.querySelector<HTMLElement>('.rwa-code-preview-impact')!;

  return {
    ...result,
    recorder,
    root,
    rows: () => [...root.querySelectorAll<HTMLButtonElement>('li > button')],
    setProps: (next) => {
      props = { ...props, ...next };
      result.rerender(tree(props));
    },
  };
}

function focus(element: HTMLElement): void {
  act(() => {
    element.focus();
  });
}

function blurToBody(): void {
  act(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
}

/** What the column says it is describing, read from the header it always renders. */
/**
 * The field the column says it is describing, read off the accessible-name node
 * rather than the whole header — the header also carries the "Generated from"
 * caption, which is chrome and is not part of the answer.
 *
 * Compared against `described(path)` rather than the raw path: the header
 * renders the humanised form of the same `ConfigPath` (a pure function of it),
 * so the assertion still says *"the column is describing FIELD_A"* and still
 * fails if it describes anything else.
 */
function describedField(root: HTMLElement): string {
  return root.querySelector('.rwa-code-preview-impact-subject')!.textContent ?? '';
}

function described(path: ConfigPath): string {
  const { context, field } = humaniseConfigPath(path);
  return `${context}${field}`;
}

/**
 * A pending slot (a path the draft does not hold yet) renders the `uncreated`
 * resting state: the header still names the slot, the rail holds no rows, and
 * the resting copy says why. The clause-4 tests below reach into the column
 * through its root, which is a tab stop (INV-42), because there is no row.
 */
function expectUncreated(harness: Harness): void {
  expect(harness.rows()).toHaveLength(0);
  expect(harness.root.querySelector('.rwa-code-preview-impact-resting')).not.toBeNull();
  expect(harness.getByText('Not added yet')).toBeInTheDocument();
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useFieldImpact', () => {
  // -------------------------------------------------------------------------
  // INV-29 (SF-14) — there is no render-phase update left to converge
  // -------------------------------------------------------------------------
  /**
   * > *Superseded heading (kept).* `the render-phase latch update converges
   * > (INV-12)` — the two tests below bounded the extra render passes the
   * > render-phase `setHeld` was allowed to take before settling.
   *
   * The write is deleted and nothing replaces it, so the property is no longer
   * "it converges" but "there is nothing to converge": the render count is
   * bounded by the events, and React logs no update-depth warning across a full
   * subject change. Asserted rather than assumed, because the failure the
   * superseded tests guarded against — an unrecoverable loop in the drawer —
   * returns the moment a render-phase write does. SF-14 INV-29.
   */
  describe('holds no render-phase state write to converge (INV-29)', () => {
    it('logs no update-depth warning across a full subject change', () => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      focus(harness.getByTestId('field-b'));
      fireEvent.pointerDown(harness.root);
      focus(harness.rows()[0]!);
      blurToBody();

      const messages = errors.mock.calls.map((call) => String(call[0] ?? ''));
      expect(messages.filter((message) => message.includes('Too many re-renders'))).toEqual([]);
      expect(
        messages.filter((message) => message.includes('Maximum update depth exceeded'))
      ).toEqual([]);
      errors.mockRestore();
    });

    it('settles at a bounded render count for a stable focused field', () => {
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));

      const settled = harness.recorder.records().length;
      expect(settled).toBeLessThanOrEqual(4);

      // Nothing else happens; the count must not keep climbing.
      act(() => {});
      expect(harness.recorder.records().length).toBe(settled);
    });

    it('does not amplify repeated focusin events for the same field', () => {
      const harness = mountColumn();
      const field = harness.getByTestId('field-a');
      focus(field);
      const settled = harness.recorder.records().length;

      const repeats = 5;
      for (let attempt = 0; attempt < repeats; attempt += 1) {
        act(() => {
          field.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
        });
      }

      // The subject already equals this anchor, so `inspect`'s bail-out returns
      // without notifying and nothing is re-set. React may still
      // render the component once per event before bailing out — that is
      // documented React behaviour, not a defect, so the property is that growth
      // is *bounded by the events*, not that it is zero. An identity comparison
      // in the store's bail-out would fail here by notifying every time
      // (SF-14 INV-7, INV-16).
      const added = harness.recorder.records().length - settled;
      expect(added, `${added} renders for ${repeats} no-op focus events`).toBeLessThanOrEqual(
        repeats
      );
      expect(describedField(harness.root)).toBe(described(FIELD_A));
      expect(harness.rows().length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // INV-16 — the latch keeps the field across a pointer activation
  // -------------------------------------------------------------------------
  describe('keeps the described field across a pointer activation (INV-16)', () => {
    it('shows no frame describing anything but the pinned field', () => {
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      expect(describedField(harness.root)).toBe(described(FIELD_A));

      harness.recorder.reset();
      fireEvent.pointerDown(harness.root);
      focus(harness.rows()[0]!);

      const records = harness.recorder.records();
      expect(records.length, 'the sequence must render at least once').toBeGreaterThan(0);
      for (const [index, record] of records.entries()) {
        expect(record.kind, `frame ${index} left the groups state`).toBe('groups');
        expect(record.path, `frame ${index} described a different field`).toBe(FIELD_A);
      }
      expect(describedField(harness.root)).toBe(described(FIELD_A));
    });

    it('survives a pointer press that moves focus nowhere — the browser-ordering case', () => {
      // The pointer arm exists for a browser that does not focus a `<button>` on
      // mousedown, and for an unlucky interleaving of `focusin` against React's
      // synthetic `onFocus`. Both look like this: the press lands, focus leaves
      // the input for the body, and nothing in the column ever receives focus.
      // With only `onFocus` arming the latch, this frame is `no-focus` — the
      // rows vanish under the cursor at the instant the user reaches for one.
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));

      fireEvent.pointerDown(harness.root);
      blurToBody();

      expect(describedField(harness.root)).toBe(described(FIELD_A));
      expect(harness.rows().length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // INV-17 — release on blur out of the column, and only then
  // -------------------------------------------------------------------------
  describe('releases the latch on blur out of the column, and only then (INV-17)', () => {
    function latched(): Harness {
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      fireEvent.pointerDown(harness.root);
      focus(harness.rows()[0]!);
      return harness;
    }

    it('row to row inside the column keeps it', () => {
      const harness = latched();
      const rows = harness.rows();
      expect(rows.length).toBeGreaterThan(1);
      focus(rows[1]!);
      expect(describedField(harness.root)).toBe(described(FIELD_A));
      expect(harness.rows().length).toBe(rows.length);
    });

    it('row to an unresolvable control outside yields not-a-field', () => {
      const harness = latched();
      focus(harness.getByTestId('outside'));
      expect(harness.rows()).toHaveLength(0);
      expect(harness.getByText('Not a configuration field')).toBeInTheDocument();
    });

    /**
     * **Restated by SF-14, and this is the AS-2 fix itself rather than a
     * casualty of it.**
     *
     * > *Superseded assertion (kept).* `row to the body — a null relatedTarget —
     * > yields no-focus`: with the latch released and nothing focused, the
     * > column showed "No field selected" and tore its rows down.
     *
     * That is the reported defect, stated as a passing test. Focus landing
     * nowhere is exactly the state SF-14 exists to survive — the Add button
     * disables itself after an add and focus falls to `<body>` — so the column
     * now keeps describing the subject. INV-22 row 3: `inspectedPath` non-null,
     * `livePath` null, `liveHasFocus` false, `columnHasFocus` false → the
     * subject.
     *
     * What is **not** relaxed is the release itself: `columnHasFocus` still goes
     * false here, which is asserted below by the fact that a subsequent live
     * control with no subject can still clear the column (clause 1 needs
     * `!columnHasFocus`). The latch narrowed from "keep the held path" to "do
     * not clear the subject"; it did not disappear.
     */
    it('row to the body keeps the subject — focus landing nowhere is AS-2, not no-focus', () => {
      const harness = latched();
      blurToBody();
      expect(describedField(harness.root)).toBe(described(FIELD_A));
      expect(harness.rows().length).toBeGreaterThan(0);
    });

    /**
     * The counterweight, and it is required: the assertion above is satisfied by
     * a column that has stopped listening to focus altogether. With **nothing**
     * inspected, a blur to the body must still reach `no-focus` — clause 3
     * falling through to a null `livePath`.
     */
    it('row to the body with nothing inspected still yields no-focus', () => {
      const harness = mountColumn();
      // No anchored control is ever focused, so the subject is never written.
      fireEvent.pointerDown(harness.root);
      focus(harness.root);
      blurToBody();
      expect(harness.rows()).toHaveLength(0);
      expect(harness.getByText('No field selected')).toBeInTheDocument();
    });

    it('row to a resolving input describes that field, through live.path', () => {
      const harness = latched();
      focus(harness.getByTestId('field-b'));
      expect(describedField(harness.root)).toBe(described(FIELD_B));
      expect(harness.rows().length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // INV-18 — exactly four invalidation inputs, one test each
  // -------------------------------------------------------------------------
  describe('has exactly four invalidation inputs (INV-18)', () => {
    /** Latched: a field resolved, then the column reached for and focused. */
    function heldColumn(): Harness {
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      fireEvent.pointerDown(harness.root);
      focus(harness.rows()[0]!);
      return harness;
    }

    it('input 1 — a new non-null resolved path replaces held', () => {
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      focus(harness.getByTestId('field-b'));

      // Reach for the column: what it pins must be the *latest* field, not the
      // first one it ever saw.
      fireEvent.pointerDown(harness.root);
      blurToBody();
      expect(describedField(harness.root)).toBe(described(FIELD_B));
    });

    it('input 2a — a pointer press on the column root arms the latch', () => {
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      fireEvent.pointerDown(harness.root);
      blurToBody();
      expect(describedField(harness.root)).toBe(described(FIELD_A));
    });

    it('input 2b — a focus arrival on the column root arms the latch', () => {
      // This is the keyboard route, and it is the whole reason the root carries
      // a tab stop: arriving here is what restores `held` and renders the rows.
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      focus(harness.root);
      expect(describedField(harness.root)).toBe(described(FIELD_A));
      expect(harness.rows().length).toBeGreaterThan(0);
    });

    it('input 3 — a blur whose relatedTarget is outside the column releases it', () => {
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      focus(harness.root);
      focus(harness.getByTestId('outside'));
      expect(harness.rows()).toHaveLength(0);
    });

    /**
     * **Restated by SF-14: input 4 has no successor, and that is the substance
     * of the change rather than a dropped assertion.**
     *
     * > *Superseded assertion (kept).* `input 4 — the live identity moving away
     * > from the stamp drops the held path`: varying only `liveIdentity`, the
     * > column stopped naming the field and rendered "Not a configuration
     * > field", because a held `ConfigPath` carries array indices the draft can
     * > shift underneath it and the stamp was the only way to notice.
     *
     * The premise is gone, not the property. The subject is a
     * `ConfigAnchorKey`, which carries only draft-independent identity, and it
     * is re-resolved against the live draft on every render — so there is no
     * stored index to go stale and nothing left to stamp. SF-14 INV-25 states
     * the property in its new form and this test asserts it: after a draft
     * mutation the subject names the **same-identity item**, never a different
     * one.
     *
     * The staleness fact is not lost either; it moves to where it was always
     * true. The column keeps a *true* answer and marks it in flight
     * (`aria-busy`, `data-impact-stale`) rather than replacing a true answer
     * with a false one. Dropping the name was the old cost of the stamp, and
     * "Not a configuration field" about `token.name` was itself a wrong
     * statement — the very kind SF-14 INV-22 refuses elsewhere.
     */
    it('input 4 is retired — an identity move keeps the same-identity subject, marked stale (INV-25)', () => {
      const harness = heldColumn();
      expect(describedField(harness.root)).toBe(described(FIELD_A));

      harness.setProps({
        provenance: harness.recorder.watch(
          availableProvenance(mixedGroups(), { identity: TEST_IDENTITY, liveIdentity: 'moved' })
        ),
      });

      // Same item, not a different one, and not nothing.
      expect(describedField(harness.root)).toBe(described(FIELD_A));
      expect(harness.rows().length).toBeGreaterThan(0);
      // The fact the stamp used to express by deletion, expressed by marking.
      expect(harness.root.getAttribute('aria-busy')).toBe('true');
      expect(harness.root.getAttribute('data-impact-stale')).toBe('true');
      expect(harness.queryByText('Not a configuration field')).not.toBeInTheDocument();
    });

    it('input 4 — a live path re-stamps, so the user editing their own field keeps the answer', () => {
      // The other half of input 4, and the reason the stamp is refreshed at
      // render rather than only at capture: typing into the described field
      // moves the live identity on every keystroke. Were the stamp taken once,
      // the first character the user typed would invalidate their own latch and
      // reaching for the column afterwards would show nothing.
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      harness.setProps({
        provenance: harness.recorder.watch(
          availableProvenance(mixedGroups(), { identity: 'typed', liveIdentity: 'typed' })
        ),
      });

      fireEvent.pointerDown(harness.root);
      blurToBody();
      expect(describedField(harness.root)).toBe(described(FIELD_A));
      expect(harness.rows().length).toBeGreaterThan(0);
    });

    describe('and nothing else — one negative test per non-input', () => {
      it('elapsed time is not an input', () => {
        vi.useFakeTimers();
        const harness = heldColumn();
        act(() => {
          vi.advanceTimersByTime(600_000);
        });
        expect(describedField(harness.root)).toBe(described(FIELD_A));
        expect(harness.rows().length).toBeGreaterThan(0);
      });

      it('the config object is not an input — only the identity derived from it is', () => {
        // The hook reads `config` for one purpose only: to hand to SF-12's
        // resolver. It never compares it, hashes it or stores it, and the stamp
        // is `liveIdentity`, not the object. In the app the two move together —
        // `computeGenerateKey` hashes the whole filled config — so this is a
        // statement about *where* input 4 is read, not a claim that a config
        // change leaves the latch alone. Here the identity is held fixed and
        // the config prop changed alone, which cannot happen in the app and is
        // exactly why it isolates the question.
        const harness = heldColumn();
        harness.setProps({ config: makeConfig({ token: { ...makeConfig().token, name: 'X' } }) });
        expect(describedField(harness.root)).toBe(described(FIELD_A));
      });

      it('the row set is not an input', () => {
        const harness = heldColumn();
        harness.setProps({ provenance: harness.recorder.watch(availableProvenance(tallGroups())) });
        expect(describedField(harness.root)).toBe(described(FIELD_A));
        expect(harness.rows()).toHaveLength(22);
      });

      it('the viewport width is not an input', () => {
        const harness = heldColumn();
        act(() => {
          window.dispatchEvent(new Event('resize'));
        });
        expect(describedField(harness.root)).toBe(described(FIELD_A));
        expect(harness.rows().length).toBeGreaterThan(0);
      });

      it('the drawer having no preview is not an input — it is a view state', () => {
        const harness = heldColumn();
        harness.setProps({ provenance: noneProvenance() });
        expect(harness.getByText('No code preview')).toBeInTheDocument();
        harness.setProps({
          provenance: harness.recorder.watch(availableProvenance(mixedGroups())),
        });
        expect(describedField(harness.root)).toBe(described(FIELD_A));
      });
    });
  });

  // -------------------------------------------------------------------------
  // INV-20 — the parts of the construction argument that are checkable here
  // -------------------------------------------------------------------------
  describe('the latch and the config (INV-20)', () => {
    it('(b) operating a config control while latched releases the latch in the same event', () => {
      // The interactive path, which the stamp does not replace: a control
      // outside the column is reached, the column blurs, and the answer changes
      // in the same event rather than waiting for a generate key to move.
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      fireEvent.pointerDown(harness.root);
      focus(harness.rows()[0]!);
      expect(describedField(harness.root)).toBe(described(FIELD_A));

      focus(harness.getByTestId('field-b'));
      expect(describedField(harness.root)).toBe(described(FIELD_B));
    });

    /**
     * **Restated by SF-14, on the footing SF-13 INV-20 now rests on.**
     *
     * > *Superseded assertion (kept).* `(c) a config change with no focus move
     * > names no field at all, and does not throw`: the held path was not used
     * > once the identity moved, so the column named nothing — "the column names
     * > nothing it cannot stand behind".
     *
     * A declared non-interactive draft mutation is no longer safe *because it
     * moves the generate key*; it is safe because it cannot make the subject
     * name a **different item**. That is a strictly weaker requirement on the
     * mutation and a strictly stronger guarantee for the column, and it is why
     * the tick the write lands in stops mattering. `token.name` is a constant
     * token-scope location that exists in every draft, so the subject survives
     * and the answer stays true; the rebuild in flight is marked rather than
     * blanked. SF-14 INV-25, and SF-13 INV-20 restated.
     *
     * The not-throwing half is unchanged and still the point of the `expect`
     * wrapper: this is the render in which a partner function that read into an
     * absent record would throw inside the drawer.
     */
    it('(c) a config change with no focus move keeps a true answer, and does not throw', () => {
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      fireEvent.pointerDown(harness.root);
      focus(harness.rows()[0]!);

      expect(() =>
        harness.setProps({
          config: makeConfig({ token: { ...makeConfig().token, name: 'edited elsewhere' } }),
          provenance: harness.recorder.watch(
            availableProvenance(mixedGroups(), { identity: TEST_IDENTITY, liveIdentity: 'moved' })
          ),
        })
      ).not.toThrow();

      expect(describedField(harness.root)).toBe(described(FIELD_A));
      expect(harness.root.getAttribute('data-impact-stale')).toBe('true');
      expect(harness.queryByText('Regenerating')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // INV-35 (restated) — freshness is decided in the commit the identity moves,
  // and the rows resolved against the tree ON SCREEN are kept through it
  // -------------------------------------------------------------------------
  describe('freshness lands in the same commit (INV-35)', () => {
    it('marks the refresh in the same commit, without tearing the rows down', () => {
      // The behaviour this replaces: the identity moving used to swap the whole
      // column for the "Regenerating" placeholder. Regeneration is debounced per
      // keystroke, so that blinked once per character typed into the field the
      // user is looking at — the flicker AS-5 forbids, produced by the freshness
      // gate rather than by the state table's order.
      //
      // What is NOT relaxed: the decision still happens at render, from the two
      // published identities, and NO frame between the two identities shows
      // anything but the rows. That is asserted per recorded frame rather than
      // on the settled DOM, because a final-state assertion is exactly what an
      // `act`-flushed effect would satisfy while still having blinked.
      //
      // Two frames, not one, and the second is not a deferred decision: the
      // live identity moving re-stamps the latch during render (INV-12, INV-18
      // input 4), which converges in one extra pass. Both frames are `groups`.
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      const before = harness.rows().length;
      expect(before).toBeGreaterThan(0);
      harness.recorder.reset();

      harness.setProps({
        provenance: harness.recorder.watch(
          availableProvenance(mixedGroups(), { identity: TEST_IDENTITY, liveIdentity: 'moved' })
        ),
      });

      const records = harness.recorder.records();
      expect(records.length, 'the identity change must render').toBeGreaterThan(0);
      expect(records.length, 'the render-phase re-stamp must converge').toBeLessThanOrEqual(2);
      for (const [index, record] of records.entries()) {
        expect(record.kind, `frame ${index} tore the rows down`).toBe('groups');
        expect(record.path, `frame ${index} stopped describing the field`).toBe(FIELD_A);
      }
      expect(harness.rows()).toHaveLength(before);
      expect(harness.root.getAttribute('aria-busy')).toBe('true');
      expect(harness.root.getAttribute('data-impact-stale')).toBe('true');
      expect(harness.queryByText('Regenerating')).not.toBeInTheDocument();
    });

    it('still falls back to pending when there is no answer to keep', () => {
      // The narrowed `pending`, and the reason it survives rather than being
      // deleted: `empty` is the only state permitted to claim anything about
      // the generated code (INV-37), so a field the tree on screen does not know
      // about yet may not be told "nothing generated from this field" while a
      // rebuild is in flight. Reachable by ticking a compliance module while
      // focus rests inside its config panel.
      const harness = mountColumn({
        provenance: availableProvenance([], { identity: TEST_IDENTITY, liveIdentity: 'moved' })
          .provenance,
      });
      focus(harness.getByTestId('field-a'));

      expect(harness.getByText('Regenerating')).toBeInTheDocument();
      expect(harness.rows()).toHaveLength(0);
      expect(harness.root.getAttribute('aria-busy')).toBe('true');
    });

    it('clears the mark in the render the identities agree again', () => {
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      harness.setProps({
        provenance: harness.recorder.watch(
          availableProvenance(mixedGroups(), { identity: TEST_IDENTITY, liveIdentity: 'moved' })
        ),
      });
      expect(harness.root.getAttribute('aria-busy')).toBe('true');

      harness.recorder.reset();
      harness.setProps({
        provenance: harness.recorder.watch(
          availableProvenance(mixedGroups(), { identity: 'settled', liveIdentity: 'settled' })
        ),
      });
      expect(harness.recorder.records()[0]!.kind).toBe('groups');
      expect(harness.rows().length).toBeGreaterThan(0);
      expect(harness.root.getAttribute('aria-busy')).toBe('false');
    });
  });

  // -------------------------------------------------------------------------
  // INV-40 — ordinary interaction produces no oscillation
  // -------------------------------------------------------------------------
  describe('does not oscillate over an ordinary interaction sequence (INV-40)', () => {
    it('no state appears, disappears and reappears across a scripted sequence', () => {
      const harness = mountColumn();
      harness.recorder.reset();

      // Click a resolving input, a second resolving input, a non-form area, a
      // column row, then type a character elsewhere.
      focus(harness.getByTestId('field-a'));
      focus(harness.getByTestId('field-b'));
      focus(harness.getByTestId('outside'));
      focus(harness.getByTestId('field-a'));
      fireEvent.pointerDown(harness.root);
      focus(harness.rows()[0]!);
      fireEvent.input(harness.getByTestId('field-b'), { target: { value: 'typed' } });

      const kinds = harness.recorder.records().map((record) => record.kind);
      expect(kinds.length).toBeGreaterThan(0);

      // Collapse consecutive duplicates: what is left is one entry per state
      // *change*. The property is that there are exactly as many changes as
      // there were actions that should cause one — moving onto the unresolvable
      // control, and moving back off it. A spurious frame anywhere in the
      // sequence adds an entry and fails, which a set or a contiguity check
      // would not: both are satisfied by a state that flickers and returns.
      const changes = kinds.filter((kind, index) => index === 0 || kind !== kinds[index - 1]);
      expect(changes, `unexpected state changes in ${JSON.stringify(kinds)}`).toEqual([
        'groups',
        'not-a-field',
        'groups',
      ]);

      // Reaching into the column must not change what it describes: the two
      // frames after the pointer press still name the field, not the row.
      expect(describedField(harness.root)).toBe(described(FIELD_A));
    });

    it('does not flicker an unfocused column while the identity churns', () => {
      // With no field there is nothing to be stale about, so the state table's
      // order keeps an unfocused column out of `pending` entirely. Without it,
      // every keystroke anywhere in the wizard flips this between two states.
      const harness = mountColumn();
      blurToBody();
      harness.recorder.reset();

      for (const liveIdentity of ['a', 'b', 'c']) {
        harness.setProps({
          provenance: harness.recorder.watch(
            availableProvenance(mixedGroups(), { identity: TEST_IDENTITY, liveIdentity })
          ),
        });
      }

      const kinds = new Set(harness.recorder.records().map((record) => record.kind));
      expect([...kinds]).toEqual(['no-focus']);
    });
  });

  // -------------------------------------------------------------------------
  // FIXED — a pending location keeps the AS-3 latch (SF-14 clause 4; found by
  // the layout probe at V9, reproduced here browser-free)
  // -------------------------------------------------------------------------
  /**
   * **Promoted from `it.fails` to a plain `it`.** It was written expected-to-fail
   * so that fixing the defect would turn it red and force this promotion rather
   * than let it rot as a skip. The defect is fixed by `resolveImpactSubject`'s
   * clause 4 and this now asserts the property directly.
   *
   * ## The defect
   *
   * A control can name a location that **resolves but does not exist yet** — an
   * operator role with no addresses, a pending trusted issuer, a deselected
   * predefined claim topic. For those, `livePath` is the pending slot and, as
   * INV-22 rows 7 and 10 correctly say, the column's answer is *unchanged from
   * today*: it renders `groups`, because a pending slot has non-empty provenance
   * against the real Stellar generator.
   *
   * Then the user reaches into the column. `columnHasFocus` goes true, so
   * `livePath` is now `null` — and `inspectedPath` is *also* null, because
   * `anchorItemExists` refuses the subject at read time (INV-20). Clause 2 has
   * nothing and clause 3 has nothing, so the column renders **`not-a-field`**:
   * *"Not part of the configuration, so no generated code is attributed to it"*
   * — about a control that plainly writes `accessControl.roles`. Under SF-13's
   * `held` latch the answer was kept.
   *
   * So this is a **regression of AS-3** confined to pending locations, and it
   * renders the exact false statement INV-22's own violation scenario says must
   * never ship. It was found by the real-browser layout probe (V9: *"landing on
   * the column root did not repopulate its rows"*), not by any harness here,
   * because no case table row covers it: INV-22's twelve rows describe the state
   * *before* the reach into the column, and rows 4 and 5 assume the subject is
   * non-null.
   *
   * **The fix taken was option 2**: the reader keeps the last *rendered* answer
   * while `columnHasFocus`, restoring exactly what SF-13's held latch did. Option
   * 1 — yielding the pending path — was refused because a pending slot names a
   * different, later item and would render as a confident populated answer, which
   * INV-10 calls Critical. Option 3, the fifth `FieldImpactView` kind, remains the
   * honest answer and remains out of scope; it has now been wanted twice, and a
   * third case should promote it from refinement to fix.
   *
   * **Promoted.** `FieldImpactView` now has that kind — `uncreated` — so a
   * pending slot renders a resting state with no rows instead of borrowing rows
   * for an item that does not exist. The held answer (the header) is what these
   * tests keep checking; the reach into the column goes through the root.
   */
  it('a pending location keeps its answer when the user reaches into the column (clause 4)', () => {
    // No roles configured, so `role|Manager` resolves to the pending slot
    // `accessControl.roles[0].addresses` and does not exist.
    const config = makeConfig({
      accessControl: { ...makeConfig().accessControl, roles: [] },
    });
    const harness = mountColumn({ config });

    const pending = harness.container.querySelector<HTMLElement>('[data-testid="pending-role"]');
    expect(pending, 'the harness must render a pending-location control').not.toBeNull();
    focus(pending!);

    // Unchanged from today, and this half passes: INV-22 rows 7 and 10.
    const answer = describedField(harness.root);
    expect(answer).not.toBe('');
    expectUncreated(harness);

    // AS-3: reaching into the column must not change what it describes.
    fireEvent.pointerDown(harness.root);
    focus(harness.root);

    expect(describedField(harness.root)).toBe(answer);
    expectUncreated(harness);
    expect(harness.queryByText('Not a configuration field')).not.toBeInTheDocument();
  });

  /**
   * The layout probe's V9 walk, browser-free — and the coverage whose absence
   * let the regression ship. Every earlier test reached the column *directly*
   * from the control it was describing, so an arm-time capture would have
   * passed all of them. A real Tab walk does not: it passes through the drawer
   * chrome, which writes no config, and clause 1 empties the column on the way.
   * The remembered answer therefore has to survive an intermediate control, not
   * merely the reach itself.
   */
  it('keeps a pending answer across an unanchored control on the way to the column', () => {
    const config = makeConfig({ accessControl: { ...makeConfig().accessControl, roles: [] } });
    const harness = mountColumn({ config });

    focus(harness.container.querySelector<HTMLElement>('[data-testid="pending-role"]')!);
    const answer = describedField(harness.root);
    expect(answer, 'precondition: the pending control describes something').not.toBe('');
    expectUncreated(harness);

    // Wizard chrome outside the preview root: focusable, connected, writes no
    // config. Clause 1 fires and the column empties — distinct from the code
    // pane, which is reach (see the suite below).
    focus(harness.getByTestId('outside'));
    expect(describedField(harness.root)).toBe('');

    // Now Tab lands on the column root itself.
    focus(harness.root);
    expect(describedField(harness.root)).toBe(answer);
    // Landing on the root must restore the answer's rendering — here the
    // `uncreated` resting state, since the slot still does not exist.
    expectUncreated(harness);
  });

  // -------------------------------------------------------------------------
  // Preview-chrome reach — code pane (and tree) keep the subject
  // -------------------------------------------------------------------------
  describe('keeps the described field across code-pane focus (preview-chrome reach)', () => {
    it('a resolvable field keeps its ranges when focus moves into the code pane', () => {
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      expect(describedField(harness.root)).toBe(described(FIELD_A));
      expect(harness.rows().length).toBeGreaterThan(0);

      focus(harness.getByTestId('code-pane'));

      expect(describedField(harness.root)).toBe(described(FIELD_A));
      expect(harness.rows().length).toBeGreaterThan(0);
      expect(harness.queryByText('Not a configuration field')).not.toBeInTheDocument();
    });

    it('focusing a different resolvable field still updates the column', () => {
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      focus(harness.getByTestId('code-pane'));
      expect(describedField(harness.root)).toBe(described(FIELD_A));

      focus(harness.getByTestId('field-b'));
      expect(describedField(harness.root)).toBe(described(FIELD_B));
      expect(harness.rows().length).toBeGreaterThan(0);
    });

    it('code-pane focus with no prior field does not invent a subject', () => {
      const harness = mountColumn();
      focus(harness.getByTestId('code-pane'));
      expect(harness.rows()).toHaveLength(0);
      expect(describedField(harness.root)).toBe('');
    });

    it('a pending location keeps its answer across the code pane (clause 4)', () => {
      const config = makeConfig({ accessControl: { ...makeConfig().accessControl, roles: [] } });
      const harness = mountColumn({ config });

      focus(harness.container.querySelector<HTMLElement>('[data-testid="pending-role"]')!);
      const answer = describedField(harness.root);
      expect(answer).not.toBe('');
      expectUncreated(harness);

      focus(harness.getByTestId('code-pane'));
      expect(describedField(harness.root)).toBe(answer);
      expectUncreated(harness);
      expect(harness.queryByText('Not a configuration field')).not.toBeInTheDocument();
    });

    it('the file tree is the same hole — one-line adjacent', () => {
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      focus(harness.getByTestId('tree'));
      expect(describedField(harness.root)).toBe(described(FIELD_A));
      expect(harness.rows().length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Preview-chrome reach — dock tools + portaled menu (same hole as code pane)
  // -------------------------------------------------------------------------
  describe('keeps the described field across dock-menu focus (preview-chrome reach)', () => {
    it('a resolvable field keeps its ranges when focus moves to the dock trigger', () => {
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      expect(describedField(harness.root)).toBe(described(FIELD_A));
      expect(harness.rows().length).toBeGreaterThan(0);

      focus(harness.getByTestId('dock-trigger'));

      expect(describedField(harness.root)).toBe(described(FIELD_A));
      expect(harness.rows().length).toBeGreaterThan(0);
      expect(harness.queryByText('Not a configuration field')).not.toBeInTheDocument();
    });

    it('a resolvable field keeps its ranges when focus moves into the portaled dock menu', () => {
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      expect(describedField(harness.root)).toBe(described(FIELD_A));
      expect(harness.rows().length).toBeGreaterThan(0);

      focus(harness.getByTestId('dock-menu-item'));

      expect(describedField(harness.root)).toBe(described(FIELD_A));
      expect(harness.rows().length).toBeGreaterThan(0);
      expect(harness.queryByText('Not a configuration field')).not.toBeInTheDocument();
    });

    it('dock-menu focus with no prior field does not invent a subject', () => {
      const harness = mountColumn();
      focus(harness.getByTestId('dock-trigger'));
      expect(harness.rows()).toHaveLength(0);
      expect(describedField(harness.root)).toBe('');

      focus(harness.getByTestId('dock-menu-item'));
      expect(harness.rows()).toHaveLength(0);
      expect(describedField(harness.root)).toBe('');
    });

    it('drops a stale remembered answer after config replace while focus is in preview chrome', () => {
      const config = makeConfig({ accessControl: { ...makeConfig().accessControl, roles: [] } });
      const harness = mountColumn({ config });

      focus(harness.container.querySelector<HTMLElement>('[data-testid="pending-role"]')!);
      const answer = describedField(harness.root);
      expect(answer).not.toBe('');

      focus(harness.getByTestId('outside'));
      expect(describedField(harness.root)).toBe('');

      focus(harness.getByTestId('code-pane'));
      expect(describedField(harness.root)).toBe(answer);

      harness.setProps({
        config: makeConfig({ accessControl: { ...makeConfig().accessControl, roles: [] } }),
      });
      expect(describedField(harness.root)).toBe('');
    });

    it('focusing a different resolvable field after the dock menu still updates', () => {
      const harness = mountColumn();
      focus(harness.getByTestId('field-a'));
      focus(harness.getByTestId('dock-menu-item'));
      expect(describedField(harness.root)).toBe(described(FIELD_A));

      focus(harness.getByTestId('field-b'));
      expect(describedField(harness.root)).toBe(described(FIELD_B));
      expect(harness.rows().length).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Clause 4's held answer IS a cache — its inputs, one test each
  // -------------------------------------------------------------------------
  /**
   * The standing rule: every cache, skip key or held value enumerates its inputs
   * and gets one test per input that varies **only** that input, plus a negative
   * test per deliberate non-input. Clause 4 re-introduces a cache — the answer
   * the column was rendering when the user reached into it — so it pays the
   * rule in full. A cache introduced to repair a latch is exactly where a
   * forgotten input hides.
   *
   * Inputs: **3 writes** (arm by pointer, arm by focus, release by blur-out) and
   * **1 invalidation** (the draft is replaced).
   */
  describe('the reach latch has exactly four inputs (clause 4)', () => {
    /** A config whose `role|Manager` control resolves to a slot that does not exist. */
    const pendingConfig = () =>
      makeConfig({ accessControl: { ...makeConfig().accessControl, roles: [] } });

    function armable() {
      const harness = mountColumn({ config: pendingConfig() });
      const pending = harness.container.querySelector<HTMLElement>('[data-testid="pending-role"]')!;
      focus(pending);
      const answer = describedField(harness.root);
      expect(answer, 'precondition: the pending control must describe something').not.toBe('');
      return { harness, answer };
    }

    it('input 1 — a pointer press on the column arms it, and the answer survives', () => {
      const { harness, answer } = armable();
      fireEvent.pointerDown(harness.root);
      focus(harness.root);
      expect(describedField(harness.root)).toBe(answer);
    });

    it('input 2 — a focus arrival on the column arms it, with no pointer press', () => {
      const { harness, answer } = armable();
      focus(harness.root);
      expect(describedField(harness.root)).toBe(answer);
    });

    it('input 3 — a blur out of the column releases it, and the answer is not kept', () => {
      const { harness, answer } = armable();
      fireEvent.pointerDown(harness.root);
      focus(harness.root);
      expect(describedField(harness.root)).toBe(answer);

      fireEvent.blur(harness.root, { relatedTarget: document.body });
      blurToBody();
      expect(describedField(harness.root)).not.toBe(answer);
    });

    it('input 4 — replacing the draft while latched drops the held answer', () => {
      const { harness, answer } = armable();
      fireEvent.pointerDown(harness.root);
      focus(harness.root);
      expect(describedField(harness.root)).toBe(answer);

      // A whole-config replacement, which is what the four non-interactive
      // mutations do. The held value is a resolved path carrying indices, so it
      // must not be trusted across this — a different object means a different
      // draft, and the answer is dropped rather than re-pointed.
      harness.setProps({ config: pendingConfig() });
      expect(describedField(harness.root)).not.toBe(answer);
    });

    /**
     * The non-inputs. Each asserts the held answer does **not** move, and the
     * list is the load-bearing half: an input list is only as good as its
     * complement.
     */
    describe('and nothing else — one negative test per non-input', () => {
      it('elapsed time is not an input', () => {
        vi.useFakeTimers();
        const { harness, answer } = armable();
        fireEvent.pointerDown(harness.root);
        focus(harness.root);
        act(() => {
          vi.advanceTimersByTime(60_000);
        });
        expect(describedField(harness.root)).toBe(answer);
      });

      it('moving between rows inside the column is not a re-arm', () => {
        // Rows need a resolvable field (a pending slot renders `uncreated`, no
        // rows); the latch under test is the same.
        const harness = mountColumn();
        focus(harness.getByTestId('field-a'));
        const answer = describedField(harness.root);
        expect(harness.rows().length).toBeGreaterThan(1);
        fireEvent.pointerDown(harness.root);
        focus(harness.rows()[0]!);
        // Re-arming here would capture whatever the latch is currently
        // producing rather than what was on screen when the user reached in.
        focus(harness.rows()[1]!);
        expect(describedField(harness.root)).toBe(answer);
      });

      it('a blur whose relatedTarget is inside the column does not release it', () => {
        const { harness, answer } = armable();
        fireEvent.pointerDown(harness.root);
        focus(harness.root);
        const inside = harness.root.querySelector<HTMLElement>('.rwa-code-preview-impact-resting')!;
        expect(inside).not.toBeNull();
        fireEvent.blur(harness.root, { relatedTarget: inside });
        expect(describedField(harness.root)).toBe(answer);
      });

      it('the same draft object re-rendered is not a replacement', () => {
        const config = pendingConfig();
        const harness = mountColumn({ config });
        const pending = harness.container.querySelector<HTMLElement>(
          '[data-testid="pending-role"]'
        )!;
        focus(pending);
        const answer = describedField(harness.root);
        fireEvent.pointerDown(harness.root);
        focus(harness.root);
        harness.setProps({ config });
        expect(describedField(harness.root)).toBe(answer);
      });
    });
  });

  it('renders unsupported without ever consulting the latch (INV-10 ordering, integrated)', () => {
    const harness = mountColumn({ provenance: unsupportedProvenance() });
    focus(harness.getByTestId('field-a'));
    expect(harness.getByText('Impact not reported')).toBeInTheDocument();
    expect(harness.rows()).toHaveLength(0);
  });
});
