import { useEffect, useState } from 'react';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { ConfigPath } from '../config-path';
import { isFocusTarget, resolveFocusedConfigPath } from './resolveFocusedConfigPath';

/**
 * What has focus, and what it writes.
 *
 * Two fields rather than one nullable path, because `null` alone conflates two
 * states a consumer must render differently: *nothing is focused* and *a real
 * control is focused that writes no `RWAConfig` location*. A consumer cannot
 * recover the difference on its own — reading `activeElement` during render is
 * impure and stale, and the transition between the two publishes nothing, so no
 * re-render happens.
 *
 * The distinction is not cosmetic. `include-identity-support` on the Review step
 * is a **generation option**: it is threaded to `generateFileTree` / `generateZip`
 * and is part of `useCodePreview`'s cache key, so it demonstrably changes the
 * generated tree — and it still resolves to `null`, correctly, because
 * `ConfigPath` spans `RWAConfig` and generation options are not in `RWAConfig`.
 * A consumer that collapsed the two states would tell the user that control
 * affects no generated code, which is plainly false. INV-13, INV-24.
 */
export interface FocusedConfigPath {
  /**
   * The config location the focused element writes, or `null` when it writes
   * none. `path !== null` implies `hasFocusedElement`.
   */
  readonly path: ConfigPath | null;
  /**
   * Whether a live control currently holds focus. `false` for no focus, for
   * focus resting on the body, and — deliberately — for an element React has
   * already unmounted: a detached node is not focused, so reporting it as
   * "focused, writes nothing" would swap one false statement for another. Both
   * fields come off the same `isFocusTarget` gate, so they cannot disagree.
   */
  readonly hasFocusedElement: boolean;
}

/**
 * The config path the currently focused element writes.
 *
 * Recomputed on every render from live focus and the live draft, so an edit
 * that moves an array index is reflected in the same commit as the edit.
 *
 * **No memo, deliberately** (INV-21). The standing repo rule is that every memo,
 * cache or skip key must enumerate the inputs of the function it fronts and get
 * one test per input; the cheapest way to honour a rule about memo keys is to
 * have no key to get wrong. The computation is a `Map` lookup, at most one
 * linear scan of the selected modules, one `closest()` walk bounded by the
 * step's depth, and one array scan bounded by the wizard's own limits — bounded
 * and small, so a memo would cost more in correctness risk than it saves. The
 * rule's *substance* is honoured by testing one input at a time, both for the
 * pure resolver and for the retained element below.
 *
 * **Seam note for consumers:** the returned object is a fresh identity on every
 * render. Destructure it and depend on `path` and `hasFocusedElement` — both
 * primitives, both referentially stable — never on the object. Keeping the memo
 * on the consumer's side keeps its key where the consumer can see it.
 *
 * **No retention, deliberately** (AS-2). The hook reports live focus and nothing
 * else. A consumer that wants the answer to survive a click into its own UI owns
 * that latch, because only it can tell "focus moved into my subtree" from "focus
 * was lost". SF-12 answers *what is focused now*; the consumer decides how long
 * to keep an answer.
 */
export function useFocusedConfigPath(config: RWAConfig): FocusedConfigPath {
  // This `useState` *is* a cache of what has focus. Its invalidation inputs are
  // exactly three, one test each (INV-21): a `focusin`, whose target replaces
  // it; a `focusout` with a null `relatedTarget`, which clears it; and the held
  // element's `isConnected` going false, which is handled at read time below
  // rather than at write time, since no event fires when React unmounts a node.
  const [focused, setFocused] = useState<Element | null>(null);

  useEffect(() => {
    const handleFocusIn = (event: FocusEvent): void => {
      const target = event.target;
      setFocused(target instanceof Element ? target : null);
    };

    // A non-null `relatedTarget` means focus is moving to another control, and
    // the incoming `focusin` supplies it — so doing nothing here is what keeps a
    // spurious `null` frame from landing between two controls (INV-23). A null
    // one means focus left for the body or the browser chrome, and clears on
    // this event: no debounce, no transition state, no "last known" fallback.
    const handleFocusOut = (event: FocusEvent): void => {
      if (event.relatedTarget === null) setFocused(null);
    };

    // `focusin` bubbles; `focus` does not, so the capture-phase alternative is
    // strictly more fragile. Exactly two listeners, added once, both released.
    // INV-22.
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return {
    path: resolveFocusedConfigPath(focused, config),
    hasFocusedElement: isFocusTarget(focused),
  };
}
