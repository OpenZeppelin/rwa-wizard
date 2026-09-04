import { isInspectableAnchor, parseConfigAnchor, type ConfigAnchorKey } from '../focused-path';

/**
 * The item the impact column is describing, or `null` for "nothing".
 *
 * A `ConfigAnchorKey` and **not** a `ConfigPath`: an anchor carries only
 * draft-independent identity (SF-12 INV-4), so it survives an index shift that
 * would make a stored path name a *different* item. That is not a refinement of
 * the latch it replaces — it removes the latch's premise. A stored path needed a
 * generate-key stamp to notice it had gone stale; there is nothing to stamp when
 * there is no stored index. INV-7, INV-25.
 *
 * It is also a **string**, which keeps `inspect`'s no-op bail-out a value
 * comparison. Were this ever to become an object or a per-resolution allocation,
 * the bail-out would compare by identity, always miss, and every `focusin`
 * inside an already-inspected cluster would notify — a re-render storm on the
 * drawer's hot path. INV-7.
 *
 * Single-slot and not a `Set`: no scenario asks for two inspected items, and a
 * `Set` would be a generality with no requirement behind it.
 */
export type InspectedAnchor = ConfigAnchorKey | null;

/**
 * An instance-scoped subject slot with a subscription.
 *
 * Deliberately *not* React state. The writers live in the wizard form subtree
 * and the only reader lives in the drawer, which is a **sibling** of
 * `WizardLayout` — so React state high enough to serve both would re-render the
 * whole form on every subject change, which is exactly what `useFieldImpact`
 * records as the reason SF-12's focus hook is mounted in the drawer and not in
 * `WizardPage`. A store keeps the writer stable (no re-render) and lets each
 * reader subscribe to a narrowed snapshot. INV-26.
 *
 * `subscribe`, `inspect` and `clear` are referentially stable for the store's
 * whole life, so a component that only writes never re-renders because of the
 * subject.
 */
export interface InspectedAnchorStore {
  readonly subscribe: (onChange: () => void) => () => void;
  readonly getSnapshot: () => InspectedAnchor;
  /**
   * Make `anchor` the subject. **A no-op in exactly two cases**, both of which
   * return without writing *and without notifying*: the anchor is already the
   * subject, and the anchor is not inspectable. INV-16.
   */
  readonly inspect: (anchor: ConfigAnchorKey) => void;
  /** Drop the subject. Called on scope change only; never by a focus event. */
  readonly clear: () => void;
}

/**
 * A fresh subject slot.
 *
 * State lives in this factory's closure — **never at module scope** — so two
 * mounts cannot see each other and a test cannot leak into the next one. A
 * module-level singleton is the obvious simplification and it is wrong: it would
 * leak a subject between tests, making the suite's failures depend on file
 * order, and let a stale subject from the previous draft reappear after a draft
 * switch. INV-14.
 */
export function createInspectedAnchorStore(): InspectedAnchorStore {
  let subject: InspectedAnchor = null;
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of listeners) listener();
  };

  return {
    subscribe: (onChange: () => void): (() => void) => {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },

    getSnapshot: (): InspectedAnchor => subject,

    inspect: (anchor: ConfigAnchorKey): void => {
      // Case 1: already the subject. A value comparison, and it must not
      // notify — an implementation that writes the same value and notifies
      // anyway passes a snapshot-equality assertion and still re-renders the
      // column on every focus move inside one anchored cluster. INV-16.
      if (anchor === subject) return;

      // Case 2: not inspectable. The two draft anchors name the slot the *next*
      // item will occupy, so the column would describe one slot past the item
      // the user just created — the reported defect, shipped inside the change
      // that fixes it. This refusal is also what makes an add handler's direct
      // write survive its own interaction under either handler ordering: the
      // competing write from the document listener resolves to the Add button's
      // draft anchor and lands here. INV-8, INV-19.
      //
      // A key that fails to decode cannot arrive through the type, and is
      // refused for the same reason a draft anchor is: an unrecognised subject
      // is one the reader could not resolve.
      const decoded = parseConfigAnchor(anchor);
      if (decoded === null || !isInspectableAnchor(decoded)) return;

      subject = anchor;
      notify();
    },

    clear: (): void => {
      // Bails when there is nothing to drop, for the same reason `inspect`
      // bails: the scope token changes on every step change, and a clear that
      // notified unconditionally would re-render the column each time even
      // though the subject was already null.
      if (subject === null) return;
      subject = null;
      notify();
    },
  };
}
