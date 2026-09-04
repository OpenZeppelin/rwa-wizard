/**
 * SF-16 — the projection: `selectedClaimTopicIndices` / `selectedClaimTopicIds`.
 *
 * INV-3's ten distinguishable input states are enumerated once, as a table, and
 * every canonical property is asserted on every row. That shape is deliberate.
 * The trap this projection exists to remove is a COUNT standing in for an index
 * space, and a count is correct on eight of these ten rows — every row where the
 * unselected topics happen to sit at the end. So a suite that spot-checks two or
 * three states is a suite the count passes. `INDEX_STATES` names which rows
 * separate the two implementations, in the row itself, so a later reader
 * trimming the table can see what they would be deleting.
 *
 * INV-4 is asserted as a property over the same table rather than on one config:
 * the two helpers must not disagree for ANY input state, because `deploy.sh`
 * registers topics through the indices path while `bootstrap-demo-mint.sh`
 * allows the demo signing key through the ids path, and a one-state drift means
 * the demo mint signs claims for a topic the issuer was never allowed to sign.
 */
import { describe, expect, it } from 'vitest';

import type { ClaimTopic, RWAConfig } from '@openzeppelin/rwa-config';

import { selectedClaimTopicIds, selectedClaimTopicIndices } from '../src/claim-topics';
import * as commonPackage from '../src/index';

function withTopics(claimTopics: readonly ClaimTopic[]): RWAConfig {
  return {
    token: {
      name: 'Acme',
      symbol: 'ACME',
      decimals: 18,
      initialSupply: '1000',
      administrativeControls: { burnable: true, mintable: true, pausable: true },
      documentManager: { enabled: false },
    },
    identityVerification: {
      claimTopics: [...claimTopics],
      trustedIssuers: [],
      controls: {
        addressFreezing: true,
        partialTokenFreezing: true,
        recovery: true,
        forcedTransfers: true,
      },
    },
    compliance: { modules: [] },
    accessControl: {
      ownership: { type: 'single-owner', ownerAddress: 'GOWNER' },
      roles: [],
    },
    deployment: {
      target: { kind: 'preset', ecosystem: 'stellar', networkId: 'stellar-testnet' },
    },
  };
}

/* ------------------------------------------------------------------ *
 * INV-3 — the ten distinguishable input states
 * ------------------------------------------------------------------ */

interface InputState {
  readonly label: string;
  readonly topics: readonly ClaimTopic[];
  readonly indices: readonly number[];
  readonly ids: readonly number[];
  /**
   * Whether a loop bounded by the SELECTED COUNT over the unfiltered array
   * emits the wrong topics on this row.
   *
   * The count and the index space coincide whenever every unselected topic sits
   * at the end, which is eight of these ten rows — so these two rows are the
   * whole discriminating power of the table.
   */
  readonly separatesTheCount: boolean;
}

const INPUT_STATES: readonly InputState[] = [
  {
    label: 'field absent everywhere — every draft written before this change',
    topics: [
      { id: 1, name: 'KYC' },
      { id: 2, name: 'AML' },
      { id: 7, name: 'Accredited Investor' },
    ],
    indices: [0, 1, 2],
    ids: [1, 2, 7],
    separatesTheCount: false,
  },
  {
    label: 'true everywhere — an imported config.json that spells it out',
    topics: [
      { id: 1, name: 'KYC', selected: true },
      { id: 2, name: 'AML', selected: true },
      { id: 7, name: 'Accredited Investor', selected: true },
    ],
    indices: [0, 1, 2],
    ids: [1, 2, 7],
    separatesTheCount: false,
  },
  {
    label: 'false everywhere — reachable, and not a validation error (INV-11)',
    topics: [
      { id: 1, name: 'KYC', selected: false },
      { id: 2, name: 'AML', selected: false },
      { id: 7, name: 'Accredited Investor', selected: false },
    ],
    indices: [],
    ids: [],
    separatesTheCount: false,
  },
  {
    label: 'mixed absent / true / false',
    topics: [
      { id: 1, name: 'KYC' },
      { id: 2, name: 'AML', selected: true },
      { id: 7, name: 'Accredited Investor', selected: false },
    ],
    indices: [0, 1],
    ids: [1, 2],
    separatesTheCount: false,
  },
  {
    label: 'unselected at index 0 — the count emits [1, 2] where [2, 7] is right',
    topics: [
      { id: 1, name: 'KYC', selected: false },
      { id: 2, name: 'AML' },
      { id: 7, name: 'Accredited Investor' },
    ],
    indices: [1, 2],
    ids: [2, 7],
    separatesTheCount: true,
  },
  {
    label: 'unselected at the FINAL index — the count is right here, which is the trap',
    topics: [
      { id: 1, name: 'KYC' },
      { id: 2, name: 'AML' },
      { id: 7, name: 'Accredited Investor', selected: false },
    ],
    indices: [0, 1],
    ids: [1, 2],
    separatesTheCount: false,
  },
  {
    label: 'unselected at a MIDDLE index — the count emits [1, 2] where [1, 7] is right',
    topics: [
      { id: 1, name: 'KYC' },
      { id: 2, name: 'AML', selected: false },
      { id: 7, name: 'Accredited Investor' },
    ],
    indices: [0, 2],
    ids: [1, 7],
    separatesTheCount: true,
  },
  {
    label: 'empty array',
    topics: [],
    indices: [],
    ids: [],
    separatesTheCount: false,
  },
  {
    label: 'single topic, selected',
    topics: [{ id: 1, name: 'KYC' }],
    indices: [0],
    ids: [1],
    separatesTheCount: false,
  },
  {
    label: 'single topic, unselected',
    topics: [{ id: 1, name: 'KYC', selected: false }],
    indices: [],
    ids: [],
    separatesTheCount: false,
  },
];

describe('selectedClaimTopicIndices — INV-3 one test per input state', () => {
  it('enumerates ten distinguishable states, and the count is stated so a trim is visible', () => {
    expect(INPUT_STATES).toHaveLength(10);
    expect(new Set(INPUT_STATES.map((state) => state.label)).size).toBe(10);
  });

  it('two of them, and only two, separate the index space from the count', () => {
    // If this number ever drops to zero the table has been trimmed down to rows
    // the defect passes, which is the failure mode INV-3's enumeration exists to
    // prevent. Named here rather than left implicit in ten anonymous rows.
    expect(INPUT_STATES.filter((state) => state.separatesTheCount)).toHaveLength(2);
  });

  it.each(INPUT_STATES)('$label', (state) => {
    const config = withTopics(state.topics);
    const indices = selectedClaimTopicIndices(config);

    expect(indices).toEqual(state.indices);

    // Strictly ascending — a reorder is a byte change in `deploy.sh` for a
    // config whose content did not change, which no golden catches because no
    // golden has an unselected topic.
    expect([...indices]).toEqual([...indices].sort((a, b) => a - b));
    expect(indices.every((value, at) => at === 0 || value > indices[at - 1]!)).toBe(true);

    // Duplicate-free and in range.
    expect(new Set(indices).size).toBe(indices.length);
    for (const index of indices) {
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(state.topics.length);
    }

    // `length ≤ claimTopics.length`, with equality iff every topic is selected.
    expect(indices.length).toBeLessThanOrEqual(state.topics.length);
    const everySelected = state.topics.every((topic) => topic.selected !== false);
    expect(indices.length === state.topics.length).toBe(everySelected);
  });

  it.each(INPUT_STATES.filter((state) => state.separatesTheCount))(
    'and the count-conflated result is genuinely different here: $label',
    (state) => {
      // The wrong implementation, written out, so the assertion above is shown
      // to be discriminating rather than asserted to be. A loop bounded by the
      // selected COUNT reads the first n array positions.
      const conflated = state.topics.slice(0, state.indices.length).map((topic) => topic.id);
      expect(conflated).not.toEqual([...state.ids]);
    }
  );
});

/* ------------------------------------------------------------------ *
 * INV-4 — the two helpers cannot disagree, on any input state
 * ------------------------------------------------------------------ */

describe('selectedClaimTopicIds — INV-4 derived, so it cannot drift', () => {
  it.each(INPUT_STATES)('$label', (state) => {
    const config = withTopics(state.topics);

    expect(selectedClaimTopicIds(config)).toEqual(state.ids);
    // The stated identity, asserted rather than assumed by construction.
    expect(selectedClaimTopicIds(config)).toEqual(
      selectedClaimTopicIndices(config).map((index) => state.topics[index]!.id)
    );
  });

  it('carries duplicate ids through, because ids are not the projection’s business', () => {
    // Duplicate topic ids are a validation error (INV-10) regardless of
    // selection, and it is `validateClaimTopics` that reports them. The
    // projection must not silently de-duplicate: doing so would make an invalid
    // config generate plausible-looking output.
    const config = withTopics([
      { id: 1, name: 'KYC' },
      { id: 1, name: 'KYC again' },
    ]);
    expect(selectedClaimTopicIds(config)).toEqual([1, 1]);
    expect(selectedClaimTopicIndices(config)).toEqual([0, 1]);
  });
});

/* ------------------------------------------------------------------ *
 * INV-16 / INV-28 — purity, and no memoisation
 * ------------------------------------------------------------------ */

describe('the projection is pure — INV-16, INV-28', () => {
  it.each(INPUT_STATES)('returns equal values on two calls: $label', (state) => {
    const config = withTopics(state.topics);
    expect(selectedClaimTopicIndices(config)).toEqual(selectedClaimTopicIndices(config));
    expect(selectedClaimTopicIds(config)).toEqual(selectedClaimTopicIds(config));
  });

  it('mutates nothing: the config’s topic array is unchanged after both walks', () => {
    const topics: ClaimTopic[] = [
      { id: 1, name: 'KYC', selected: false },
      { id: 2, name: 'AML' },
    ];
    const config = withTopics(topics);
    const before = JSON.stringify(config);

    selectedClaimTopicIndices(config);
    selectedClaimTopicIds(config);

    expect(JSON.stringify(config)).toBe(before);
  });

  it('is NOT memoised — the answer follows the config, not the first call on it', () => {
    // Under provenance the config is a recording PROXY, and the recorder already
    // caches one view per target. A `WeakMap` keyed on the config would
    // therefore survive across `observe` scopes and make the second call record
    // no reads at all: the `Claim Topics (N)` heading loses every path, the
    // range becomes pathless, and `significance-matrix.test.ts` fires with
    // nothing to say a cache caused it.
    const config = withTopics([
      { id: 1, name: 'KYC' },
      { id: 2, name: 'AML' },
    ]);

    expect(selectedClaimTopicIndices(config)).toEqual([0, 1]);
    config.identityVerification.claimTopics[0]!.selected = false;
    expect(selectedClaimTopicIndices(config)).toEqual([1]);
    expect(selectedClaimTopicIds(config)).toEqual([2]);
  });

  it('allocates one array per call, and reads the array once per topic', () => {
    // O(n) with n ≤ MAX_CLAIM_TOPICS, called once per generated file. The
    // observable form of "once per topic" is a getter counter on `selected`.
    const reads: number[] = [];
    const topics = [0, 1, 2].map((at) => {
      const topic: ClaimTopic = { id: at + 1, name: `T${at}` };
      Object.defineProperty(topic, 'selected', {
        get() {
          reads.push(at);
          return undefined;
        },
        enumerable: true,
      });
      return topic;
    });

    selectedClaimTopicIndices(withTopics(topics));
    expect(reads).toEqual([0, 1, 2]);
  });

  it('and the ids walk reads `selected` per topic exactly once more, never per line', () => {
    const reads: number[] = [];
    const topics = [0, 1, 2].map((at) => {
      const topic: ClaimTopic = { id: at + 1, name: `T${at}` };
      Object.defineProperty(topic, 'selected', {
        get() {
          reads.push(at);
          return at === 0 ? false : undefined;
        },
        enumerable: true,
      });
      return topic;
    });

    selectedClaimTopicIds(withTopics(topics));
    // One pass for the derived indices; the ids walk then reads `.id` only.
    expect(reads).toEqual([0, 1, 2]);
  });
});

/* ------------------------------------------------------------------ *
 * INV-23 — no ownKeys read of a topic, inside either helper
 * ------------------------------------------------------------------ */

describe('the projection reads topics by property access alone — INV-23', () => {
  function refusingOwnKeys(topics: readonly ClaimTopic[]): {
    readonly config: RWAConfig;
    readonly witnessed: readonly string[];
  } {
    const witnessed: string[] = [];
    const guarded = topics.map(
      (topic) =>
        new Proxy(
          { ...topic },
          {
            ownKeys(target) {
              witnessed.push('ownKeys');
              return Reflect.ownKeys(target);
            },
          }
        )
    );
    return { config: withTopics(guarded), witnessed };
  }

  it.each(INPUT_STATES)('selectedClaimTopicIndices trips no ownKeys trap: $label', (state) => {
    const { config, witnessed } = refusingOwnKeys(state.topics);
    selectedClaimTopicIndices(config);
    expect(witnessed).toEqual([]);
  });

  it.each(INPUT_STATES)('selectedClaimTopicIds trips no ownKeys trap: $label', (state) => {
    const { config, witnessed } = refusingOwnKeys(state.topics);
    selectedClaimTopicIds(config);
    expect(witnessed).toEqual([]);
  });

  it('and the probe is not vacuous: a spread inside a walk DOES trip it', () => {
    // Watch the absence assertion fail. `ownKeys` records the topic's BARE
    // element path terminally and no pruning removes it, so a spread here
    // becomes an eighteenth row in a pinned 17-shape inventory in another
    // package and reads as a placement bug.
    const { config, witnessed } = refusingOwnKeys([{ id: 1, name: 'KYC' }]);
    const copies = config.identityVerification.claimTopics.map((topic) => ({ ...topic }));
    expect(copies).toHaveLength(1);
    expect(witnessed).toContain('ownKeys');
  });
});

/* ------------------------------------------------------------------ *
 * INV-32 / INV-33 — placement and chain-agnosticism
 * ------------------------------------------------------------------ */

describe('placement — INV-32, INV-33', () => {
  it('exports exactly the two projection helpers from this package', () => {
    expect(commonPackage.selectedClaimTopicIndices).toBe(selectedClaimTopicIndices);
    expect(commonPackage.selectedClaimTopicIds).toBe(selectedClaimTopicIds);
  });

  it('does NOT re-export isClaimTopicSelected — one export path per concept', () => {
    // Two import paths for one concept is INV-2's failure with a package
    // boundary in the way of noticing it.
    expect(Object.keys(commonPackage)).not.toContain('isClaimTopicSelected');
  });

  it('returns integers, so a generator for a chain that does not exist yet can consume it', () => {
    // INV-33's behavioural half: nothing chain-shaped comes out. The source-scan
    // half — that the module mentions no chain name and imports only
    // `@openzeppelin/rwa-config` — lives with the other scans in
    // `codegen-rwa-stellar`, where it can see both packages.
    const config = withTopics([
      { id: 1, name: 'KYC', selected: false },
      { id: 2, name: 'AML' },
    ]);
    for (const value of [...selectedClaimTopicIndices(config), ...selectedClaimTopicIds(config)]) {
      expect(Number.isInteger(value)).toBe(true);
    }
    expect(JSON.stringify(selectedClaimTopicIds(config))).toBe('[2]');
  });
});
