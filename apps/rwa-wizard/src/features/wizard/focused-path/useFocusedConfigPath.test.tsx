import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';

import type { ComplianceModuleSelection, RWAConfig } from '@openzeppelin/rwa-config';

import { createDefaultRwaConfig } from '../../../utils/defaultRwaConfig';
import type { FocusedConfigPath } from './useFocusedConfigPath';
import { useFocusedConfigPath } from './useFocusedConfigPath';

/**
 * INV-21 (the retained element is a cache; one test per invalidation input),
 * INV-22 (exactly two listeners, both released), INV-23 (no spurious `null`
 * between two controls; focus loss clears immediately), INV-24 (the SF-13 seam),
 * and INV-16 at the integration level.
 *
 * The hook holds the focused element in `useState`, which *is* a cache of "what
 * has focus". The repo's standing rule — for every memo, cache or skip key,
 * enumerate the inputs and write one test per input that varies only that input
 * — therefore applies here, and INV-21 names the three inputs: a `focusin`, a
 * `focusout` with a null `relatedTarget`, and the held element's `isConnected`
 * going false. One block each below.
 */

function draftWith(modules: ComplianceModuleSelection[] = []): RWAConfig {
  const base = createDefaultRwaConfig();
  return { ...base, compliance: { modules } };
}

const DRAFT = draftWith([{ moduleId: 'supply-limit' }, { moduleId: 'transfer-allow' }]);

/**
 * The probe component, defined once at module scope.
 *
 * It must be a *stable component type*: re-rendering with a freshly declared
 * inline component unmounts and remounts the tree, which resets the hook's state
 * and re-registers its listeners — turning "the draft changed" into "the hook
 * was remounted" and quietly passing tests that were meant to distinguish them.
 */
function Probe({ draft, sink }: { draft: RWAConfig; sink: FocusedConfigPath[] }) {
  const value = useFocusedConfigPath(draft);
  const seen = useRef(sink);
  seen.current.push(value);
  return null;
}

/**
 * Mounts the hook and records **every** value it returns, in render order.
 *
 * The log is what makes INV-23 checkable: sampling the current value after a
 * transition cannot see a `null` frame that landed and was replaced in the same
 * tick, which is precisely the flicker the invariant forbids.
 */
function mountHook(config: RWAConfig = DRAFT) {
  const renders: FocusedConfigPath[] = [];
  const result = render(<Probe draft={config} sink={renders} />);

  return {
    ...result,
    renders,
    latest: (): FocusedConfigPath => renders[renders.length - 1]!,
    /** Re-render the *same* component with a new draft. */
    setDraft: (draft: RWAConfig): void => {
      result.rerender(<Probe draft={draft} sink={renders} />);
    },
  };
}

const hosts: HTMLElement[] = [];

function mountFragment(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  hosts.push(host);
  return host;
}

function focusIn(target: Element): void {
  act(() => {
    target.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
  });
}

function focusOut(target: Element, relatedTarget: Element | null): void {
  act(() => {
    target.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget }));
  });
}

afterEach(() => {
  for (const host of hosts.splice(0)) host.remove();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// INV-21 — the retained element's three invalidation inputs, one test each
// ---------------------------------------------------------------------------

describe('INV-21 — the retained element has exactly three invalidation inputs', () => {
  it('input (i): a `focusin` replaces the held element', () => {
    const host = mountFragment('<div><input id="token-name" /><input id="token-symbol" /></div>');
    const hook = mountHook();

    expect(hook.latest()).toEqual({ path: null, hasFocusedElement: false });

    focusIn(host.querySelector('#token-name')!);
    expect(hook.latest()).toEqual({ path: 'token.name', hasFocusedElement: true });

    focusIn(host.querySelector('#token-symbol')!);
    expect(hook.latest()).toEqual({ path: 'token.symbol', hasFocusedElement: true });
  });

  it('input (ii): a `focusout` with a null `relatedTarget` clears it', () => {
    const host = mountFragment('<div><input id="token-name" /></div>');
    const hook = mountHook();
    const input = host.querySelector('#token-name')!;

    focusIn(input);
    expect(hook.latest().path).toBe('token.name');

    focusOut(input, null);
    expect(hook.latest()).toEqual({ path: null, hasFocusedElement: false });
  });

  /**
   * Input (iii). No event fires when React unmounts a node, so this input is
   * handled at *read* time rather than write time — which is why it needs its
   * own test: nothing else in the hook would notice.
   */
  it('input (iii): the held element becoming detached clears the answer at read time', () => {
    const host = mountFragment(
      '<div data-config-anchor="module|transfer-allow"><input id="transfer-allow-allowedUsers" /></div>'
    );
    const hook = mountHook();
    const input = host.querySelector('#transfer-allow-allowedUsers')!;

    focusIn(input);
    expect(hook.latest()).toEqual({
      path: 'compliance.modules[1].config.allowedUsers',
      hasFocusedElement: true,
    });

    // What React does when a module is deselected: the subtree goes away, and no
    // focus event fires. The held element is still a perfectly usable `Element`.
    act(() => {
      host.remove();
    });

    // Same hook instance, same held element, a re-render with the same draft:
    // the *only* thing that changed is `isConnected`.
    hook.setDraft(DRAFT);
    expect(hook.latest()).toEqual({ path: null, hasFocusedElement: false });
  });

  it('a `focusout` with a non-null `relatedTarget` changes nothing (INV-23)', () => {
    const host = mountFragment('<div><input id="token-name" /><input id="token-symbol" /></div>');
    const hook = mountHook();
    const first = host.querySelector('#token-name')!;
    const second = host.querySelector('#token-symbol')!;

    focusIn(first);
    const before = hook.renders.length;

    focusOut(first, second);

    // The value is unchanged; a re-render may or may not have happened, but the
    // answer must not have moved.
    expect(hook.latest()).toEqual({ path: 'token.name', hasFocusedElement: true });
    expect(hook.renders.slice(before).every((value) => value.path === 'token.name')).toBe(true);
  });

  it('there is no memo: the same element answers a new path when the draft moves', () => {
    const host = mountFragment('<div><input id="transfer-allow-allowedUsers" /></div>');
    const hook = mountHook(DRAFT);
    focusIn(host.querySelector('#transfer-allow-allowedUsers')!);
    expect(hook.latest().path).toBe('compliance.modules[1].config.allowedUsers');

    const moved = draftWith([
      { moduleId: 'supply-limit' },
      { moduleId: 'max-balance' },
      { moduleId: 'transfer-allow' },
    ]);
    hook.setDraft(moved);

    expect(hook.latest().path).toBe('compliance.modules[2].config.allowedUsers');
  });
});

// ---------------------------------------------------------------------------
// INV-22 — listener allocation and release
// ---------------------------------------------------------------------------

describe('INV-22 — exactly two listeners, both released', () => {
  it('adds `focusin` and `focusout` on mount and removes both on unmount', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');

    const hook = mountHook();
    const added = add.mock.calls.filter(([type]) => type === 'focusin' || type === 'focusout');
    expect(added.map(([type]) => type).sort()).toEqual(['focusin', 'focusout']);

    hook.unmount();
    const removed = remove.mock.calls.filter(([type]) => type === 'focusin' || type === 'focusout');
    expect(removed.map(([type]) => type).sort()).toEqual(['focusin', 'focusout']);

    // The same handler references, so the removes actually match the adds.
    expect(removed.map(([, handler]) => handler)).toEqual(added.map(([, handler]) => handler));
  });

  it('holds add/remove parity over 100 mount-unmount cycles', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');

    for (let i = 0; i < 100; i += 1) {
      const hook = mountHook();
      hook.unmount();
    }

    const count = (calls: readonly unknown[][], type: string): number =>
      calls.filter(([t]) => t === type).length;

    expect(count(add.mock.calls, 'focusin')).toBe(100);
    expect(count(add.mock.calls, 'focusout')).toBe(100);
    expect(count(remove.mock.calls, 'focusin')).toBe(100);
    expect(count(remove.mock.calls, 'focusout')).toBe(100);
  });

  /**
   * The effect's dependency array is empty, so the pair is not torn down and
   * rebuilt on every render. Asserted through behaviour rather than by reading
   * the source: re-rendering with a *new* draft object must not re-register.
   */
  it('does not re-register the pair when the draft changes', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const hook = mountHook(draftWith([]));
    const afterMount = add.mock.calls.filter(([type]) => type === 'focusin').length;

    for (let i = 0; i < 5; i += 1) {
      hook.setDraft(draftWith([{ moduleId: `m-${i}` }]));
    }

    expect(add.mock.calls.filter(([type]) => type === 'focusin').length).toBe(afterMount);
  });

  it('uses `focusin`, never a capture-phase `focus`', () => {
    const add = vi.spyOn(document, 'addEventListener');
    mountHook();
    expect(add.mock.calls.filter(([type]) => type === 'focus')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// INV-23 — transitions
// ---------------------------------------------------------------------------

describe('INV-23 — focus transitions publish no spurious `null`', () => {
  /**
   * The real event sequence when a user tabs between two controls: `focusout`
   * on the old one carrying the new one as `relatedTarget`, then `focusin` on
   * the new one. If the hook cleared on every `focusout`, a `null` frame would
   * land between them — the column would blank and repaint on every tab, which
   * at a fixed drawer height reads as content jumping.
   */
  it('moving between two controls yields exactly one answer change, with no `null` in between', () => {
    const host = mountFragment('<div><input id="token-name" /><input id="token-symbol" /></div>');
    const hook = mountHook();
    const first = host.querySelector('#token-name')!;
    const second = host.querySelector('#token-symbol')!;

    focusIn(first);
    const from = hook.renders.length;

    focusOut(first, second);
    focusIn(second);

    const sequence = hook.renders.slice(from).map((value) => value.path);
    expect(sequence).not.toContain(null);
    expect(hook.latest()).toEqual({ path: 'token.symbol', hasFocusedElement: true });
  });

  it('holds when the destination control resolves to `null`', () => {
    const host = mountFragment(
      '<div><input id="token-name" /><button id="unanchored">x</button></div>'
    );
    const hook = mountHook();
    const first = host.querySelector('#token-name')!;
    const second = host.querySelector('#unanchored')!;

    focusIn(first);
    focusOut(first, second);
    focusIn(second);

    // `path` is null because the destination writes nothing — but the hook says
    // something *is* focused, which is the distinction INV-24 clause 1 exists for.
    expect(hook.latest()).toEqual({ path: null, hasFocusedElement: true });
  });

  it('clears on the `focusout` event itself, not on a timer', () => {
    vi.useFakeTimers();
    try {
      const host = mountFragment('<div><input id="token-name" /></div>');
      const hook = mountHook();
      const input = host.querySelector('#token-name')!;

      focusIn(input);
      focusOut(input, null);

      // No timer advance: the answer is already cleared.
      expect(hook.latest()).toEqual({ path: null, hasFocusedElement: false });
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('focus resting on the body reads as no focus', () => {
    const hook = mountHook();
    focusIn(document.body);
    expect(hook.latest()).toEqual({ path: null, hasFocusedElement: false });
  });
});

// ---------------------------------------------------------------------------
// INV-24 — the SF-13 seam
// ---------------------------------------------------------------------------

describe('INV-24 — the consumer seam', () => {
  it('`path !== null` implies `hasFocusedElement`', () => {
    const host = mountFragment(
      '<div><input id="token-name" /><button id="unanchored">x</button></div>'
    );
    const hook = mountHook();

    for (const selector of ['#token-name', '#unanchored']) {
      focusIn(host.querySelector(selector)!);
      const value = hook.latest();
      if (value.path !== null) expect(value.hasFocusedElement).toBe(true);
    }

    expect(hook.renders.every((v) => v.path === null || v.hasFocusedElement)).toBe(true);
  });

  it('there is no third state — the answer is always the two fields, never undefined', () => {
    const host = mountFragment('<div><input id="token-name" /></div>');
    const hook = mountHook();
    focusIn(host.querySelector('#token-name')!);
    focusOut(host.querySelector('#token-name')!, null);

    for (const value of hook.renders) {
      expect(Object.keys(value).sort()).toEqual(['hasFocusedElement', 'path']);
      expect(value.path === null || typeof value.path === 'string').toBe(true);
      expect(typeof value.hasFocusedElement).toBe('boolean');
    }
  });

  /**
   * **The returned object is a fresh identity on every render.** INV-21 forbids a
   * memo inside `focused-path/`, and the code honours that as written, so a
   * consumer that put the returned object in a dependency array would re-run its
   * effect on every render of its parent.
   *
   * SF-13 must destructure and depend on `path` and `hasFocusedElement` — both
   * primitives, both referentially stable when the answer has not changed.
   * Pinned here so nobody reads the absence of a memo as an accident and "fixes"
   * it, and so nothing downstream is written against a stability the hook never
   * promised.
   */
  it('returns a fresh object identity per render, and stable primitives', () => {
    const hook = mountHook(DRAFT);
    hook.setDraft(DRAFT);
    hook.setDraft(DRAFT);
    const identities = hook.renders;

    expect(identities.length).toBeGreaterThanOrEqual(3);
    const [a, b] = identities;
    expect(a).not.toBe(b);
    expect(a).toEqual(b);

    // The two primitives are what a consumer should depend on.
    expect(new Set(identities.map((v) => v.path)).size).toBe(1);
    expect(new Set(identities.map((v) => v.hasFocusedElement)).size).toBe(1);
  });

  it('retains nothing: unmounting and remounting starts from no focus', () => {
    const host = mountFragment('<div><input id="token-name" /></div>');
    const first = mountHook();
    focusIn(host.querySelector('#token-name')!);
    expect(first.latest().path).toBe('token.name');
    first.unmount();

    const second = mountHook();
    expect(second.latest()).toEqual({ path: null, hasFocusedElement: false });
  });
});
