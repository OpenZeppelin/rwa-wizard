import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';

import type { ComplianceModuleSelection } from '@openzeppelin/rwa-config';

import { resolveFocusedAnchorKey } from '../focused-path';
import { InspectedAnchorContext } from './InspectedAnchorContext';
import { createInspectedAnchorStore, type InspectedAnchorStore } from './inspectedAnchorStore';

export interface InspectedAnchorProviderProps {
  /**
   * Opaque token whose change drops the subject. Whatever it names, the subject
   * did not survive it. Passed as
   * `` `${resetKey}-${activeDraftId ?? 'none'}-${currentStep}` `` — the same
   * three facts, in the same shape, as `ResetDeployReadinessOnDraftChange`'s
   * existing `token` prop. INV-23.
   */
  readonly scopeToken: string;
  /**
   * The selected compliance modules, for the key walk's dynamic module-config
   * channel.
   *
   * **A deviation from the design, which gave this provider only `scopeToken`.**
   * The walk needs the selected modules to split a module-config field's own id
   * (`` `${moduleId}-${fieldKey}` ``) into an anchor; without them a click on a
   * scalar module-config field would fall through to the enclosing panel's
   * `module|<id>` and the column would describe the *module* rather than the
   * field the user is typing in — coarser than today's answer, which is a
   * regression the design did not intend. It is the narrowest slice that closes
   * that: the resolver's own second parameter, not the whole draft. The store
   * still holds no draft, so nothing in this directory can go stale.
   */
  readonly modules: readonly ComplianceModuleSelection[];
  readonly children: ReactNode;
}

/**
 * Mounts the subject slot and its two writers.
 *
 * Must sit above **both** `WizardLayout` (the writers) and `CodePreviewDrawer`
 * (the reader). The context value is the store handle, created once by `useRef`,
 * so this provider re-rendering never re-renders a consumer and a subject change
 * never re-renders this provider. INV-13, INV-26.
 *
 * Exactly two listeners, both bubble-phase, both **write-only**:
 *
 *  - `focusin` — the default writer. Every control that resolves today keeps
 *    working with no change to its markup, and a keyboard user tabbing to an
 *    issuer row's `×` selects the row by the resolver's outward walk, with no
 *    new tab stop and no `tabIndex` anywhere. INV-34, INV-35.
 *  - `click` — the writer that makes selection work on Safari, where clicking a
 *    `<button>` does not focus it *and* actively pulls focus off whatever was
 *    focused before. Bubble phase, so a React `onClick` on the same element runs
 *    first and this still fires. INV-18.
 *
 * **Neither listener ever clears, and `focusout` is not listened for at all.**
 * Focus landing nowhere is exactly the case the subject exists to survive — the
 * add button disables itself after an add and focus falls to the body — so a
 * clear-on-focus-departure would ship the reported defect. The property is the
 * *absence* of a listener rather than the behaviour of one, which is the only
 * way to assert it: no CI job here runs Safari, and disabling the focused button
 * fires no `focusout` in the harness at all. INV-15, INV-17.
 *
 * The "a live control writes nothing" statement is made by the *reader* from
 * live focus, not here, because only the reader knows where the column's own
 * boundary is. INV-22.
 */
export function InspectedAnchorProvider({
  scopeToken,
  modules,
  children,
}: InspectedAnchorProviderProps): ReactElement {
  const storeRef = useRef<InspectedAnchorStore | null>(null);
  storeRef.current ??= createInspectedAnchorStore();
  const store = storeRef.current;

  // Read by the listeners at event time and never during render, so it is kept
  // fresh from a committed render rather than assigned mid-render. This is what
  // lets the listener effect below hold an empty dependency array.
  const modulesRef = useRef(modules);
  useEffect(() => {
    modulesRef.current = modules;
  }, [modules]);

  useEffect(() => {
    const write = (target: EventTarget | null): void => {
      if (!(target instanceof Element)) return;

      // `event.target`, never `composedPath()`, and plain `closest` inside the
      // walk, never a composed one. A click inside the code preview's shadow
      // root retargets to a host that carries no anchor, so browsing generated
      // files cannot change what the column claims the user's form field does.
      // Same choice, for the same reason, as the column's own blur handler.
      // INV-24.
      const key = resolveFocusedAnchorKey(target, modulesRef.current);
      if (key === null) return;
      storeRef.current?.inspect(key);
    };

    const handleClick = (event: MouseEvent): void => write(event.target);
    const handleFocusIn = (event: FocusEvent): void => write(event.target);

    // Added once and both released. The dependency array is empty on purpose:
    // depending on the store handle or on `scopeToken` would re-subscribe on
    // every change, accumulating listeners across a long session and racing
    // their writes. INV-27.
    document.addEventListener('click', handleClick);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  // The fourth and last writer: a scope change drops the subject outright.
  // Without the step half of the token the user could inspect a claim topic,
  // navigate to Compliance, and leave the column describing an item that is
  // nowhere on screen with the marker attached to nothing. INV-15, INV-23.
  useEffect(() => {
    storeRef.current?.clear();
  }, [scopeToken]);

  return (
    <InspectedAnchorContext.Provider value={store}>{children}</InspectedAnchorContext.Provider>
  );
}
