import { describe, expect, it, vi } from 'vitest';

import {
  adminAnchor,
  CLAIM_TOPIC_DRAFT_ANCHOR,
  claimTopicAnchor,
  identityControlAnchor,
  ISSUER_DRAFT_ANCHOR,
  issuerAnchor,
  issuerTopicsAnchor,
  moduleAnchor,
  moduleConfigAnchor,
  OWNERSHIP_ADDRESS_ANCHOR,
  OWNERSHIP_TYPE_ANCHOR,
  roleAnchor,
  tokenAnchor,
  type ConfigAnchorKey,
} from '../focused-path';
import { createInspectedAnchorStore, type InspectedAnchorStore } from './inspectedAnchorStore';

// ---------------------------------------------------------------------------
// INV-7 — the type-level precondition of the bail-out
// ---------------------------------------------------------------------------

/**
 * `ConfigAnchorKey extends string`, asserted at compile time.
 *
 * **The narrowed successor of SF-13's `CONFIG_PATH_IS_VALUE_COMPARABLE`**, which
 * lived in `useFieldImpact.test.tsx` and guarded the render-phase `setHeld`.
 * That write is deleted and the "Too many re-renders" hazard with it (INV-29),
 * so this is not the same assertion relocated — it is a strictly smaller claim
 * about a different mechanism, and it is recorded as a narrowing rather than as
 * a like-for-like move.
 *
 * What it still buys: `inspect`'s no-op bail-out below is `anchor === subject`.
 * A string comparison is by **value**. Were `ConfigAnchorKey` ever to become an
 * object or a per-resolution branded wrapper — a plausible future for an anchor
 * dialect that wanted to carry a parsed form — the comparison would compare by
 * identity, miss every time, and notify on every `focusin` inside an
 * already-inspected cluster. Moving from the address input to the Add button
 * inside one issuer row would re-render the impact column, which is the exact
 * cost SF-12's hook was pushed down into the drawer to avoid.
 *
 * A performance failure rather than a crash, which is why this is a narrowing.
 * When the anchor dialect widens the type, this line fails `tsc` with the storm
 * named, instead of the drawer getting slower for reasons nobody can locate.
 * SF-13 INV-12 restated; SF-14 INV-7, INV-16.
 */
const CONFIG_ANCHOR_KEY_IS_VALUE_COMPARABLE: ConfigAnchorKey extends string ? true : false = true;

const TOPIC = claimTopicAnchor(1);
const OTHER_TOPIC = claimTopicAnchor(2);
const ISSUER = issuerAnchor('GISSUER');

/** A store with a subscriber attached, so every no-op claim is about notification. */
function storeWithSubscriber(): {
  store: InspectedAnchorStore;
  onChange: ReturnType<typeof vi.fn>;
} {
  const store = createInspectedAnchorStore();
  const onChange = vi.fn();
  store.subscribe(onChange);
  return { store, onChange };
}

describe('createInspectedAnchorStore', () => {
  it('holds the type-level precondition its bail-out depends on (INV-7)', () => {
    expect(CONFIG_ANCHOR_KEY_IS_VALUE_COMPARABLE).toBe(true);
  });

  // -------------------------------------------------------------------------
  // INV-14 — closure state, never module state
  // -------------------------------------------------------------------------
  describe('holds its state in the factory closure (INV-14)', () => {
    it('starts at null', () => {
      expect(createInspectedAnchorStore().getSnapshot()).toBeNull();
    });

    /**
     * The behavioural half of the source scan in `inspectedAnchorSource.test.ts`.
     * A module-level singleton is the obvious simplification and it is wrong: it
     * would leak a subject between mounts, make the suite's failures depend on
     * file order, and let a stale subject from the previous draft reappear after
     * a draft switch. The scan says there is no module-level `let`; this says
     * two stores cannot see each other, which is the property the scan is a
     * proxy for.
     */
    it('two stores hold independent subjects', () => {
      const first = createInspectedAnchorStore();
      const second = createInspectedAnchorStore();

      first.inspect(TOPIC);
      expect(first.getSnapshot()).toBe(TOPIC);
      expect(second.getSnapshot()).toBeNull();

      second.inspect(ISSUER);
      expect(first.getSnapshot()).toBe(TOPIC);
      expect(second.getSnapshot()).toBe(ISSUER);
    });

    it('a subscriber of one store is never called by the other', () => {
      const first = createInspectedAnchorStore();
      const second = createInspectedAnchorStore();
      const onFirst = vi.fn();
      first.subscribe(onFirst);

      second.inspect(TOPIC);
      expect(onFirst).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // INV-15 (the store's half) / INV-16 — the writes and the two no-ops
  // -------------------------------------------------------------------------
  describe('writes on an inspectable anchor and notifies once (INV-15)', () => {
    it('inspect makes the anchor the subject and notifies', () => {
      const { store, onChange } = storeWithSubscriber();
      store.inspect(TOPIC);
      expect(store.getSnapshot()).toBe(TOPIC);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('a different anchor replaces the subject and notifies again', () => {
      const { store, onChange } = storeWithSubscriber();
      store.inspect(TOPIC);
      store.inspect(OTHER_TOPIC);
      expect(store.getSnapshot()).toBe(OTHER_TOPIC);
      expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('clear drops the subject and notifies', () => {
      const { store, onChange } = storeWithSubscriber();
      store.inspect(TOPIC);
      onChange.mockClear();

      store.clear();
      expect(store.getSnapshot()).toBeNull();
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('unsubscribing stops the callbacks and leaves the writes working', () => {
      const { store, onChange } = storeWithSubscriber();
      const second = vi.fn();
      const release = store.subscribe(second);

      release();
      store.inspect(TOPIC);

      expect(second).not.toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(store.getSnapshot()).toBe(TOPIC);
    });
  });

  describe('is a no-op in exactly two cases, and a no-op notifies nobody (INV-16)', () => {
    /**
     * **`not.toHaveBeenCalled()` and not merely "the snapshot is unchanged".**
     * An implementation that writes the same value and notifies anyway passes
     * the weaker assertion and fails the property: it would re-render the impact
     * column on every focus move inside one anchored cluster — the address input
     * to the Add button and back — which is exactly the cost the column was
     * pushed down into the drawer to avoid.
     */
    it('case 1 — the anchor already equals the subject: no write, no notify', () => {
      const { store, onChange } = storeWithSubscriber();
      store.inspect(TOPIC);
      onChange.mockClear();

      store.inspect(TOPIC);
      store.inspect(TOPIC);
      store.inspect(TOPIC);

      expect(store.getSnapshot()).toBe(TOPIC);
      expect(onChange).not.toHaveBeenCalled();
    });

    /**
     * Case 2, and the reason it is load-bearing rather than defensive: both
     * draft anchors resolve through `claimTopics.length` /
     * `nextTrustedIssuerIndex`, so they name the slot the *next* item will
     * occupy. A subject pointing there is the reported one-slot-past defect,
     * shipped inside the change that fixes it. INV-8, INV-19.
     */
    it.each<readonly [string, ConfigAnchorKey]>([
      ['claimTopicDraft', CLAIM_TOPIC_DRAFT_ANCHOR],
      ['issuerDraft', ISSUER_DRAFT_ANCHOR],
    ])('case 2 — a %s anchor: no write, no notify', (_kind, anchor) => {
      const { store, onChange } = storeWithSubscriber();
      store.inspect(anchor);
      expect(store.getSnapshot()).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('case 2 does not disturb a subject already held', () => {
      const { store, onChange } = storeWithSubscriber();
      store.inspect(TOPIC);
      onChange.mockClear();

      store.inspect(ISSUER_DRAFT_ANCHOR);
      store.inspect(CLAIM_TOPIC_DRAFT_ANCHOR);

      expect(store.getSnapshot()).toBe(TOPIC);
      expect(onChange).not.toHaveBeenCalled();
    });

    /** The two cases compose: a non-inspectable anchor that equals nothing. */
    it('the two cases compose', () => {
      const { store, onChange } = storeWithSubscriber();
      store.inspect(CLAIM_TOPIC_DRAFT_ANCHOR);
      store.inspect(CLAIM_TOPIC_DRAFT_ANCHOR);
      expect(store.getSnapshot()).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
    });

    /**
     * Recorded because the implementation refuses it and the type says it cannot
     * arrive: a key that fails to decode. It is refused for the same reason a
     * draft anchor is — an unresolvable subject is one the reader could not
     * resolve — and asserting it here is what stops the third undocumented
     * branch reading like an accident. The cast is confined to this line: no
     * production caller can produce the value.
     */
    it('a key that fails to decode is refused, like a draft anchor', () => {
      const { store, onChange } = storeWithSubscriber();
      store.inspect('claimTopic|not-an-integer' as ConfigAnchorKey);
      expect(store.getSnapshot()).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
    });

    /**
     * `clear`'s own bail-out, which the invariants do not specify and the
     * implementation records as strictly better: the scope token changes on
     * every step change, so an unconditional notify would re-render the column
     * on each one with nothing inspected.
     */
    it('clear with nothing inspected notifies nobody', () => {
      const { store, onChange } = storeWithSubscriber();
      store.clear();
      store.clear();
      expect(store.getSnapshot()).toBeNull();
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // INV-30 — the snapshot is a primitive and is stable between calls
  // -------------------------------------------------------------------------
  describe('publishes a stable primitive snapshot (INV-30)', () => {
    it.each([
      ['before any write', null as ConfigAnchorKey | null],
      ['after a write', TOPIC as ConfigAnchorKey | null],
    ])('getSnapshot returns the same value on consecutive calls %s', (_when, anchor) => {
      const store = createInspectedAnchorStore();
      if (anchor !== null) store.inspect(anchor);

      const first = store.getSnapshot();
      const second = store.getSnapshot();
      expect(Object.is(first, second)).toBe(true);
      expect(first).toBe(anchor);
    });

    /**
     * The type-level claim, made observable: no `ConfigPath` and no derived
     * object is read through the store. React sees a fresh object on every call
     * if this is ever widened, warns "getSnapshot should be cached", and in the
     * concurrent path re-renders in a loop.
     */
    it('the snapshot is a string or null, never an object', () => {
      const store = createInspectedAnchorStore();
      expect(store.getSnapshot()).toBeNull();
      store.inspect(TOPIC);
      expect(typeof store.getSnapshot()).toBe('string');
    });
  });

  // -------------------------------------------------------------------------
  // INV-26 — the writer is referentially stable
  // -------------------------------------------------------------------------
  it('inspect, clear and subscribe are stable for the store’s life (INV-26)', () => {
    const store = createInspectedAnchorStore();
    const { inspect, clear, subscribe } = store;

    store.inspect(TOPIC);
    store.clear();

    expect(store.inspect).toBe(inspect);
    expect(store.clear).toBe(clear);
    expect(store.subscribe).toBe(subscribe);
  });

  // -------------------------------------------------------------------------
  // INV-8 (the store's side) — every inspectable kind is accepted
  // -------------------------------------------------------------------------
  /**
   * One case per accepted arm, at the store's boundary rather than at
   * `isInspectableAnchor`'s. The predicate's own thirteen arms are asserted in
   * `configAnchor.inspectable.test.ts`; this is the store agreeing with it,
   * which is a separate claim — a store that hard-coded `kind === 'claimTopic'`
   * would pass the predicate's suite and fail here.
   */
  it.each<readonly [string, ConfigAnchorKey]>([
    ['token', tokenAnchor('name')],
    ['admin', adminAnchor('burnable')],
    ['identityControl', identityControlAnchor('recovery')],
    ['ownershipType', OWNERSHIP_TYPE_ANCHOR],
    ['ownershipAddress', OWNERSHIP_ADDRESS_ANCHOR],
    ['role', roleAnchor('Agent')],
    ['module', moduleAnchor('country-restrict')],
    ['moduleConfig', moduleConfigAnchor('country-restrict', 'countries')],
    ['claimTopic', claimTopicAnchor(7)],
    ['issuer', issuerAnchor('GABC')],
    ['issuerTopics', issuerTopicsAnchor('GABC')],
  ])('accepts a %s anchor as the subject (INV-8)', (_kind, anchor) => {
    const store = createInspectedAnchorStore();
    store.inspect(anchor);
    expect(store.getSnapshot()).toBe(anchor);
  });
});
