import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ComplianceModuleSelection, RWAConfig } from '@openzeppelin/rwa-config';
import { AddressListField } from '@openzeppelin/ui-components';

import { collectFocusable } from '../../../test/helpers/focusedPathHarness';
import { createDefaultRwaConfig } from '../../../utils/defaultRwaConfig';
import { moduleAnchor } from './configAnchor';
import { resolveFocusedConfigPath } from './resolveFocusedConfigPath';

/**
 * INV-20 (the cluster resolves to the field's own path through two channels) and
 * INV-26 (it does so in *every* reachable field state).
 *
 * These render `AddressListField` directly rather than through the compliance
 * step, because neither `maxItems` nor `disabled` is reachable through the
 * wizard today — no module descriptor declares a cap — and a test routed through
 * a step that cannot reach the state would be asserting over the state it *can*
 * reach while claiming to cover the one it cannot.
 *
 * The trap is latent and one descriptor field away from live: a module that
 * declares "at most N allowed users" arms it. From that moment the id-carrying
 * entry control is `disabled`, and any resolver reading `activeElement.id` alone
 * goes blank for every control the user can still reach — at exactly the point
 * they have done the most work on the field.
 */

const MODULE_ID = 'transfer-allow';
const FIELD_KEY = 'allowedUsers';
const FIELD_ID = `${MODULE_ID}-${FIELD_KEY}`;

const ADDRESSES = [
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
];

function draftWith(modules: ComplianceModuleSelection[]): RWAConfig {
  const base = createDefaultRwaConfig();
  return { ...base, compliance: { modules } };
}

/** The module sits at index 1, so a path that silently used 0 is a failure. */
const DRAFT = draftWith([{ moduleId: 'supply-limit' }, { moduleId: MODULE_ID }]);
const EXPECTED_PATH = 'compliance.modules[1].config.allowedUsers';

interface FieldState {
  readonly label: string;
  readonly props: Partial<Parameters<typeof AddressListField>[0]>;
}

/** Every reachable state INV-26 enumerates. */
const FIELD_STATES: readonly FieldState[] = [
  { label: 'empty', props: { value: [] } },
  { label: 'populated below maxItems', props: { value: ADDRESSES, maxItems: 5 } },
  { label: 'at maxItems', props: { value: ADDRESSES, maxItems: ADDRESSES.length } },
  { label: 'disabled', props: { value: ADDRESSES, disabled: true } },
  { label: 'single entry mode', props: { value: ADDRESSES, defaultEntryMode: 'single' } },
  { label: 'bulk entry mode', props: { value: ADDRESSES, defaultEntryMode: 'bulk' } },
];

/**
 * The cluster, mounted inside the panel-level anchor `ModuleConfigPanel` renders
 * — so the fixture reproduces the real nesting, and the backstop anchor is
 * present exactly as it is in the wizard.
 */
function renderCluster(props: FieldState['props']) {
  const result = render(
    <div data-config-anchor={moduleAnchor(MODULE_ID)} className="grid gap-3">
      <div data-field-id={FIELD_ID}>
        <AddressListField
          label="Allowed users"
          placeholder="G... or C... address"
          bulkPlaceholder="One address per line"
          formatHint="One address per line"
          value={[]}
          onChange={() => {}}
          {...props}
          id={FIELD_ID}
        />
      </div>
    </div>
  );
  const root = result.container.querySelector<HTMLElement>('[data-field-id]');
  if (root === null) throw new Error('the kit rendered no `data-field-id` root');
  return { ...result, root };
}

function describeControl(element: HTMLElement): string {
  const name = element.getAttribute('aria-label') ?? (element.textContent ?? '').trim();
  return `<${element.localName}${element.id ? ` id="${element.id}"` : ''}>${name}`;
}

/**
 * The resolver INV-26 exists to rule out: one that reads the focused element's
 * `id` and nothing else. It is written here rather than described, so the test
 * that distinguishes it from the real resolver can *show* the difference.
 */
function idOnlyResolver(element: HTMLElement): string | null {
  if (element.id === FIELD_ID) return EXPECTED_PATH;
  return null;
}

// ---------------------------------------------------------------------------
// INV-26 clauses 1 and 2 — every state, every control
// ---------------------------------------------------------------------------

describe('INV-26 — the cluster resolves in every field state', () => {
  it.each(FIELD_STATES.map((state) => [state.label, state] as const))(
    'every focusable control resolves to the field path — %s',
    (_label, state) => {
      const { root, container } = renderCluster(state.props);
      const controls = collectFocusable(container);

      expect(controls.length).toBeGreaterThan(0);
      for (const control of controls) {
        expect(root.contains(control)).toBe(true);
        expect({
          control: describeControl(control),
          path: resolveFocusedConfigPath(control, DRAFT),
        }).toEqual({ control: describeControl(control), path: EXPECTED_PATH });
      }
    }
  );

  it.each(FIELD_STATES.map((state) => [state.label, state] as const))(
    'every element carrying the field identifier carries the same one, and nothing else does — %s (INV-20 clause 4)',
    (_label, state) => {
      const { container } = renderCluster(state.props);
      // The wrapper always carries `data-field-id` (the backstop for a kit that
      // ignores `id`). A kit that honours `id` (SF-12) stamps its own root as
      // well, nested inside the wrapper, so `closest('[data-field-id]')` from any
      // control still lands on FIELD_ID. One or two carriers, never a different id.
      const carriers = [...container.querySelectorAll('[data-field-id]')];
      expect(carriers.length).toBeGreaterThanOrEqual(1);
      expect(carriers.length).toBeLessThanOrEqual(2);
      expect(new Set(carriers.map((el) => el.getAttribute('data-field-id')))).toEqual(
        new Set([FIELD_ID])
      );
    }
  );

  /**
   * INV-26 clause 2. The active entry control changes from `<input>` to
   * `<textarea>` across the mode toggle; the resolved path must not.
   */
  it('toggling single ↔ bulk changes no resolved path', () => {
    const single = renderCluster({ value: ADDRESSES, defaultEntryMode: 'single' });
    const singleEntry = single.root.querySelector<HTMLElement>('input')!;
    expect(singleEntry.localName).toBe('input');
    expect(resolveFocusedConfigPath(singleEntry, DRAFT)).toBe(EXPECTED_PATH);
    single.unmount();

    const bulk = renderCluster({ value: ADDRESSES, defaultEntryMode: 'bulk' });
    const bulkEntry = bulk.root.querySelector<HTMLElement>('textarea')!;
    expect(bulkEntry.localName).toBe('textarea');
    expect(resolveFocusedConfigPath(bulkEntry, DRAFT)).toBe(EXPECTED_PATH);
  });

  it('the entry control resolves by leaf id and the others by `closest`, and they agree', () => {
    const { root, container } = renderCluster({ value: ADDRESSES });
    const entry = root.querySelector<HTMLElement>('input')!;
    const others = collectFocusable(container).filter((control) => control !== entry);

    expect(others.length).toBeGreaterThan(0);
    const entryPath = resolveFocusedConfigPath(entry, DRAFT);
    for (const control of others) {
      expect(control.id).toBe('');
      expect(resolveFocusedConfigPath(control, DRAFT)).toBe(entryPath);
    }
  });
});

// ---------------------------------------------------------------------------
// INV-26 clause 3 — the negative assertion that pins the mechanism
// ---------------------------------------------------------------------------

describe('INV-26 clause 3 — at `maxItems`, the id-carrying control is gone', () => {
  /**
   * The state under test has to be the *real* one. Without this assertion a
   * fixture that failed to reach `maxItems` would sail through every other check
   * in this file, and clause 3 would be proving nothing.
   */
  it('the entry control is genuinely absent from the focusable collection', () => {
    const { container, root } = renderCluster({ value: ADDRESSES, maxItems: ADDRESSES.length });
    const entry = root.querySelector<HTMLElement>('input');

    expect(entry).not.toBeNull();
    expect(entry!.hasAttribute('disabled')).toBe(true);
    expect(collectFocusable(container)).not.toContain(entry);
  });

  it('the per-row remove buttons stay focusable and still resolve', () => {
    const { container } = renderCluster({ value: ADDRESSES, maxItems: ADDRESSES.length });
    const removeButtons = collectFocusable(container).filter((control) =>
      (control.getAttribute('aria-label') ?? '').startsWith('Remove address')
    );

    expect(removeButtons).toHaveLength(ADDRESSES.length);
    for (const button of removeButtons) {
      expect(resolveFocusedConfigPath(button, DRAFT)).toBe(EXPECTED_PATH);
    }
  });

  /**
   * *A resolver written from `activeElement.id` alone passes every other
   * assertion in this artifact and fails this one.*
   *
   * Shown rather than asserted abstractly: the id-only resolver answers `null`
   * for every control the user can still reach at `maxItems`, while the real
   * resolver answers the field's path for all of them. That gap is the entire
   * reason `data-field-id` exists as a second channel.
   */
  it('an `activeElement.id`-only resolver goes blank here; the real one does not', () => {
    const { container } = renderCluster({ value: ADDRESSES, maxItems: ADDRESSES.length });
    const reachable = collectFocusable(container);

    expect(reachable.length).toBeGreaterThan(0);
    expect(reachable.map(idOnlyResolver)).toEqual(reachable.map(() => null));
    expect(reachable.map((control) => resolveFocusedConfigPath(control, DRAFT))).toEqual(
      reachable.map(() => EXPECTED_PATH)
    );
  });

  /**
   * **INV-26 clause 1's `disabled` half, corrected against the kit.**
   *
   * The invariant says the per-row remove buttons "stay focusable in both
   * states" — at `maxItems` *and* when `disabled`. Verified against the kit,
   * that is true at `maxItems` and false when `disabled`:
   * `AddressListEntries` disables its remove buttons from the `disabled` prop,
   * so they leave the focusable collection along with the entry control.
   *
   * The *property* survives, and this is the test for it: the cluster still
   * contributes focusable controls when disabled — the entry-mode toggle and one
   * copy control per chip — none of which carries an id, so `data-field-id` is
   * the only channel that can reach them. If anything, the disabled state is the
   * purer statement of INV-26, because there the id-only resolver has nothing at
   * all to work with.
   */
  it('when `disabled`, the survivors are the mode toggle and the copy controls — and they resolve', () => {
    const { container, root } = renderCluster({ value: ADDRESSES, disabled: true });
    const reachable = collectFocusable(container);

    // Not an empty cluster: the state contributes real, reachable controls.
    expect(reachable.length).toBeGreaterThan(0);

    // The entry control and every remove button are out.
    const entry = root.querySelector<HTMLElement>('input')!;
    expect(reachable).not.toContain(entry);
    expect(
      reachable.filter((control) =>
        (control.getAttribute('aria-label') ?? '').startsWith('Remove address')
      )
    ).toHaveLength(0);

    // What is left carries no id at all, so only `data-field-id` can reach it.
    for (const control of reachable) {
      expect(control.id).toBe('');
      expect(resolveFocusedConfigPath(control, DRAFT)).toBe(EXPECTED_PATH);
      expect(idOnlyResolver(control)).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// INV-20 clause 6 — the panel-level backstop
// ---------------------------------------------------------------------------

describe('INV-20 clause 6 — the panel anchor is retained as a backstop', () => {
  it('a control in the panel but outside the field root coarsens to the module entry', () => {
    const { container } = render(
      <div data-config-anchor={moduleAnchor(MODULE_ID)} className="grid gap-3">
        <button type="button">a future field type with no identifier</button>
      </div>
    );
    const button = container.querySelector('button')!;

    // Coarse, not silent. Removing the panel anchor would turn this into `null`,
    // which is the wrong direction for a feature whose failure mode is silence.
    expect(resolveFocusedConfigPath(button, DRAFT)).toBe('compliance.modules[1]');
  });

  it('the field root still wins over the panel anchor for controls inside it', () => {
    const { root, container } = renderCluster({ value: ADDRESSES });
    expect(root.getAttribute('data-field-id')).toBe(FIELD_ID);
    for (const control of collectFocusable(container)) {
      expect(resolveFocusedConfigPath(control, DRAFT)).toBe(EXPECTED_PATH);
    }
  });
});

// ---------------------------------------------------------------------------
// The index is read at resolve time, not at render time
// ---------------------------------------------------------------------------

describe('INV-20 — the cluster index tracks the live draft', () => {
  it('the same rendered cluster answers a different index for a different draft', () => {
    const { container } = renderCluster({ value: ADDRESSES });
    const controls = collectFocusable(container);

    const moved = draftWith([
      { moduleId: 'supply-limit' },
      { moduleId: 'max-balance' },
      { moduleId: MODULE_ID },
    ]);

    for (const control of controls) {
      expect(resolveFocusedConfigPath(control, DRAFT)).toBe(EXPECTED_PATH);
      expect(resolveFocusedConfigPath(control, moved)).toBe(
        'compliance.modules[2].config.allowedUsers'
      );
    }
  });
});
