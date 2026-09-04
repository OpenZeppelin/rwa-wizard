import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import { makeConfig } from '../../../test/fixtures/wizardFixtures';
import { mountProvider } from '../../../test/helpers/inspectedAnchorHarness';
import {
  claimTopicAnchor,
  CONFIG_ANCHOR_ATTR,
  issuerAnchor,
  issuerTopicsAnchor,
  moduleAnchor,
  type ConfigAnchorKey,
} from '../focused-path';
import { useInspectAnchor, useInspectedConfigPath, useIsInspected } from './useInspectedAnchor';

const TOPIC_1 = claimTopicAnchor(1);
const TOPIC_2 = claimTopicAnchor(2);
const ISSUER_A = issuerAnchor('GAAA');
const ISSUER_B = issuerAnchor('GBBB');

function identityConfig(
  topics: readonly { id: number; name: string }[],
  issuers: readonly { address: string; claimTopics: number[] }[]
): RWAConfig {
  const base = makeConfig();
  return makeConfig({
    identityVerification: {
      ...base.identityVerification,
      claimTopics: [...topics],
      trustedIssuers: [...issuers],
    },
  });
}

const TWO_TOPICS = [
  { id: 1, name: 'KYC' },
  { id: 2, name: 'AML' },
];
const TWO_ISSUERS = [
  { address: 'GAAA', claimTopics: [1] },
  { address: 'GBBB', claimTopics: [2] },
];

/** Anchored markup for whichever anchors a case needs to click. */
function anchors(keys: readonly ConfigAnchorKey[]): React.ReactElement {
  return (
    <>
      {keys.map((key) => (
        <button key={key} data-testid={key} type="button" {...{ [CONFIG_ANCHOR_ATTR]: key }}>
          {key}
        </button>
      ))}
    </>
  );
}

describe('useInspectedConfigPath', () => {
  // -------------------------------------------------------------------------
  // INV-10 / INV-20 — existence is checked at read time, against the live draft
  // -------------------------------------------------------------------------
  describe('resolves against the live draft, and drops a removed item (INV-10, INV-20)', () => {
    it('resolves an existing item to its path', () => {
      const harness = mountProvider({
        candidates: [TOPIC_2],
        config: identityConfig(TWO_TOPICS, []),
        children: anchors([TOPIC_2]),
      });
      fireEvent.click(harness.getByTestId(TOPIC_2));
      expect(harness.probe.path()).toBe('identityVerification.claimTopics[1]');
    });

    /**
     * **The failure this closes is not hypothetical.** `pendingIndex` never
     * returns `-1`, so a removed claim topic's anchor resolves cleanly to
     * `claimTopics[length]` — a *different, later* item's slot — and, measured
     * against real Stellar output, a pending slot returns a **non-empty**
     * provenance group. So without the read-time check the column would describe
     * topic *n+1*'s lines under topic *n*'s name as a populated, confident answer
     * rather than as an obvious blank.
     */
    it('returns null in the same commit the item is removed', () => {
      const harness = mountProvider({
        candidates: [TOPIC_1],
        config: identityConfig(TWO_TOPICS, []),
        children: anchors([TOPIC_1]),
      });
      fireEvent.click(harness.getByTestId(TOPIC_1));
      expect(harness.probe.path()).toBe('identityVerification.claimTopics[0]');

      harness.setProps({ config: identityConfig([TWO_TOPICS[1]!], []) });

      expect(harness.probe.path()).toBeNull();
      // The subject itself is untouched: nothing clears on removal (INV-20).
      expect(harness.probe.inspected()).toBe(TOPIC_1);
    });

    it('never resolves to a pending index, for any removed keyed kind (INV-10)', () => {
      for (const [anchor, present, emptied] of [
        [TOPIC_1, identityConfig(TWO_TOPICS, []), identityConfig([], [])],
        [ISSUER_A, identityConfig(TWO_TOPICS, TWO_ISSUERS), identityConfig(TWO_TOPICS, [])],
        [
          issuerTopicsAnchor('GAAA'),
          identityConfig(TWO_TOPICS, TWO_ISSUERS),
          identityConfig(TWO_TOPICS, []),
        ],
        [moduleAnchor('does-not-exist'), makeConfig(), makeConfig()],
      ] as const) {
        const harness = mountProvider({
          candidates: [anchor],
          config: present,
          children: anchors([anchor]),
        });
        fireEvent.click(harness.getByTestId(anchor));

        harness.setProps({ config: emptied });
        expect(harness.probe.path(), `${anchor} resolved after removal`).toBeNull();
        harness.unmount();
      }
    });
  });

  // -------------------------------------------------------------------------
  // INV-25 — the property the retired identity stamp used to guard
  // -------------------------------------------------------------------------
  describe('names the same-identity item or nothing, never a different one (INV-25)', () => {
    /**
     * **This is why deleting the identity stamp is not a regression.** SF-13's
     * latch stored a resolved `ConfigPath`, which carries array indices the draft
     * can shift underneath it, so it needed a `PreviewGenerateKey` stamp to
     * notice its answer had gone stale. Storing an anchor removes the premise
     * rather than the guard: there is nothing to stamp, because there is no
     * stored index. Store a path again — the obvious "optimisation", since the
     * reader resolves one on every render — and the stamp becomes necessary
     * again, silently, with nothing else in the suite to say so.
     */
    it('follows the address when an earlier issuer is removed, not the old index', () => {
      const harness = mountProvider({
        candidates: [ISSUER_B],
        config: identityConfig(TWO_TOPICS, TWO_ISSUERS),
        children: anchors([ISSUER_B]),
      });
      fireEvent.click(harness.getByTestId(ISSUER_B));
      expect(harness.probe.path()).toBe('identityVerification.trustedIssuers[1]');

      // Remove the *earlier* issuer. A stored path would still name index 1 —
      // which is now nothing — while the anchor follows GBBB to index 0.
      harness.setProps({ config: identityConfig(TWO_TOPICS, [TWO_ISSUERS[1]!]) });
      expect(harness.probe.path()).toBe('identityVerification.trustedIssuers[0]');
      expect(harness.probe.inspected()).toBe(ISSUER_B);
    });

    it('survives a whole-config replacement when the same identity is present', () => {
      const harness = mountProvider({
        candidates: [ISSUER_B],
        config: identityConfig(TWO_TOPICS, TWO_ISSUERS),
        children: anchors([ISSUER_B]),
      });
      fireEvent.click(harness.getByTestId(ISSUER_B));

      // A different object entirely, same issuer address, different position.
      harness.setProps({
        config: identityConfig(
          [{ id: 9, name: 'Other' }],
          [
            { address: 'GCCC', claimTopics: [] },
            { address: 'GDDD', claimTopics: [] },
            { address: 'GBBB', claimTopics: [9] },
          ]
        ),
      });
      expect(harness.probe.path()).toBe('identityVerification.trustedIssuers[2]');
    });

    it('resolves to null, never to a different item, when the identity is gone', () => {
      const harness = mountProvider({
        candidates: [ISSUER_B],
        config: identityConfig(TWO_TOPICS, TWO_ISSUERS),
        children: anchors([ISSUER_B]),
      });
      fireEvent.click(harness.getByTestId(ISSUER_B));

      harness.setProps({
        config: identityConfig(TWO_TOPICS, [{ address: 'GZZZ', claimTopics: [] }]),
      });
      expect(harness.probe.path()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // INV-28 / INV-30 — recomputed per render, no memo, no cached snapshot
  // -------------------------------------------------------------------------
  describe('recomputes per render and publishes a stable snapshot (INV-28, INV-30)', () => {
    /**
     * The behavioural counterpart of the no-memo source scan. A `useMemo` keyed
     * on `[subject]` and not on the config would defeat the read-time existence
     * check in the one place nobody looks: this drives the config alone, with the
     * subject held fixed, and requires the answer to move with it.
     */
    it('a config change alone moves the answer, with the subject untouched', () => {
      const harness = mountProvider({
        candidates: [ISSUER_A],
        config: identityConfig(TWO_TOPICS, TWO_ISSUERS),
        children: anchors([ISSUER_A]),
      });
      fireEvent.click(harness.getByTestId(ISSUER_A));
      expect(harness.probe.path()).toBe('identityVerification.trustedIssuers[0]');

      harness.setProps({
        config: identityConfig(TWO_TOPICS, [TWO_ISSUERS[1]!, TWO_ISSUERS[0]!]),
      });
      expect(harness.probe.inspected()).toBe(ISSUER_A);
      expect(harness.probe.path()).toBe('identityVerification.trustedIssuers[1]');
    });

    /**
     * `getSnapshot` returning a fresh object on every call makes React warn and,
     * in the concurrent path, re-render in a loop — a failure that surfaces as a
     * React warning about a file nobody suspects. The reader subscribes to the
     * **key** and resolves the path during render precisely so this cannot
     * happen.
     */
    it('React logs no getSnapshot warning across a config change', () => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      const harness = mountProvider({
        candidates: [ISSUER_A],
        config: identityConfig(TWO_TOPICS, TWO_ISSUERS),
        children: anchors([ISSUER_A]),
      });
      fireEvent.click(harness.getByTestId(ISSUER_A));
      harness.setProps({ config: identityConfig(TWO_TOPICS, [TWO_ISSUERS[0]!]) });
      harness.setProps({ config: identityConfig(TWO_TOPICS, TWO_ISSUERS) });

      const messages = errors.mock.calls.map((call) => String(call[0] ?? ''));
      expect(messages.filter((message) => message.includes('getSnapshot'))).toEqual([]);
      expect(messages.filter((message) => message.includes('Maximum update depth'))).toEqual([]);
      errors.mockRestore();
    });
  });
});

describe('useIsInspected', () => {
  // -------------------------------------------------------------------------
  // INV-26 — a subject change re-renders only the items whose answer flipped
  // -------------------------------------------------------------------------
  describe('re-renders only the items whose answer flipped (INV-26)', () => {
    const MANY = Array.from({ length: 15 }, (_, index) => claimTopicAnchor(index + 1));

    /**
     * The cost being avoided: `useIsInspected` returning the *subject* and
     * letting the caller compare would re-render all fifteen chips on every
     * subject change, and the subject changes on every `focusin` anywhere in the
     * wizard — the whole form re-rendering on every tab press. That is exactly
     * the cost `useFieldImpact` records as the reason SF-12's hook was mounted in
     * the drawer rather than in `WizardPage`, reintroduced through the store
     * instead of through the hook.
     */
    it('exactly two of fifteen items re-render when the subject moves between them', () => {
      const harness = mountProvider({
        candidates: MANY,
        config: identityConfig(
          MANY.map((_, index) => ({ id: index + 1, name: `T${index + 1}` })),
          []
        ),
        children: anchors(MANY),
      });

      fireEvent.click(harness.getByTestId(MANY[3]!));
      expect(harness.probe.inspected()).toBe(MANY[3]);

      harness.probe.reset();
      fireEvent.click(harness.getByTestId(MANY[9]!));

      const rerendered = MANY.filter((anchor) => harness.probe.rendersOf(anchor) > 0);
      expect(rerendered.sort()).toEqual([MANY[3], MANY[9]].sort());
    });

    it('an item whose answer did not change does not re-render on a no-op write', () => {
      const harness = mountProvider({
        candidates: MANY,
        config: identityConfig(
          MANY.map((_, index) => ({ id: index + 1, name: `T${index + 1}` })),
          []
        ),
        children: anchors(MANY),
      });
      fireEvent.click(harness.getByTestId(MANY[3]!));

      harness.probe.reset();
      // The same anchor again: `inspect` bails out without notifying (INV-16).
      fireEvent.click(harness.getByTestId(MANY[3]!));

      expect(MANY.filter((anchor) => harness.probe.rendersOf(anchor) > 0)).toEqual([]);
    });
  });

  it('returns false for undefined, inside the provider (INV-13)', () => {
    const harness = mountProvider({ candidates: [TOPIC_1], children: anchors([TOPIC_1]) });
    fireEvent.click(harness.getByTestId(TOPIC_1));

    const seen: boolean[] = [];
    function UndefinedProbe(): null {
      seen.push(useIsInspected(undefined));
      return null;
    }
    const bare = render(
      <>
        <UndefinedProbe />
      </>
    );
    expect(seen).toEqual([false]);
    bare.unmount();
  });
});

// ---------------------------------------------------------------------------
// INV-13 — inertness outside the provider
// ---------------------------------------------------------------------------
describe('the three hooks are inert outside the provider (INV-13)', () => {
  /**
   * **Inertness is a real silent-failure surface and it is bought deliberately.**
   * `anchoredComponents.test.tsx`, `renderStep` and the 25-file markup guard all
   * render these components with no provider, and a throwing hook would take all
   * three down. The cost is that forgetting the provider in `WizardPage` ships
   * the entire feature inert with a fully green suite — which is why the
   * structural assertion in `WizardPage.provider.test.ts` is required rather than
   * optional. This is the half that says inertness itself works.
   */
  interface Observed {
    isInspected: boolean;
    path: unknown;
    writers: Array<(anchor: ConfigAnchorKey) => void>;
  }

  function BareProbe({ observed }: { observed: Observed }): null {
    observed.isInspected = useIsInspected(TOPIC_1);
    observed.path = useInspectedConfigPath(identityConfig(TWO_TOPICS, []));
    observed.writers.push(useInspectAnchor());
    return null;
  }

  it('render, both readers and the writer, with no provider and no throw', () => {
    const observed: Observed = { isInspected: true, path: 'unset', writers: [] };
    let result!: ReturnType<typeof render>;

    expect(() => {
      result = render(<BareProbe observed={observed} />);
    }).not.toThrow();

    expect(observed.isInspected).toBe(false);
    expect(observed.path).toBeNull();

    // Calling the no-op writer changes nothing and throws nothing.
    expect(() => observed.writers[0]!(TOPIC_1)).not.toThrow();
    expect(observed.isInspected).toBe(false);

    // Referential stability across renders: a component that only writes must
    // not re-render because its writer identity churned.
    act(() => {
      result.rerender(<BareProbe observed={observed} />);
    });
    expect(observed.writers.length).toBeGreaterThan(1);
    expect(observed.writers[1]).toBe(observed.writers[0]);

    result.unmount();
  });

  /**
   * The inert case must also be inert to the *document listeners*: with no
   * provider mounted there are none, so a click on anchored markup writes
   * nowhere and nothing observes it.
   */
  it('a click on anchored markup with no provider selects nothing', () => {
    const observed: Observed = { isInspected: true, path: 'unset', writers: [] };
    const result = render(
      <>
        <BareProbe observed={observed} />
        {anchors([TOPIC_1])}
      </>
    );

    fireEvent.click(result.getByTestId(TOPIC_1));
    expect(observed.isInspected).toBe(false);
    result.unmount();
  });
});
