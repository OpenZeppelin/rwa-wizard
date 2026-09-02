/**
 * SF-16 — inert-stub battery.
 *
 * Temporarily replaces the projection with selection-blind stubs and records
 * which of this stage's load-bearing assertions still pass. An earlier stage
 * found four genuinely hollow assertions among 37 that passed that way; the
 * ledger below is the deliverable, not a suite that must stay green under the
 * stub (the stub is the defect).
 *
 * Run under the real suite too: every `it` below asserts the stubbed world
 * behaves as the wrong implementation, then asserts the REAL implementation
 * disagrees — so the battery cannot go green by accidentally using the real
 * helpers.
 */
import { describe, expect, it } from 'vitest';

import {
  selectedClaimTopicIds as realIds,
  selectedClaimTopicIndices as realIndices,
} from '@openzeppelin/codegen-rwa-common';
import { isClaimTopicSelected } from '@openzeppelin/rwa-config';
import type { ClaimTopic, RWAConfig } from '@openzeppelin/rwa-config';

import { GENERATE_PATHS, textOf, topicUnselectedConfig } from './helpers';

const DEPLOY = 'scripts/deploy.sh';

/** Selection-blind: every defined topic is "selected". */
function inertSelected(_topic: ClaimTopic): boolean {
  return true;
}

/** Count-conflation: first `selectedCount` indices of the unfiltered array. */
function conflatedIndices(config: RWAConfig): readonly number[] {
  const { claimTopics } = config.identityVerification;
  // Under the inert predicate every topic is selected, so the count equals length
  // and the loop is `0..n-1`. The discriminating form uses the REAL selected
  // count as the bound — the trap INV-3 exists to catch.
  const selectedCount = claimTopics.filter((topic) => topic.selected !== false).length;
  return claimTopics.slice(0, selectedCount).map((_, index) => index);
}

function conflatedIds(config: RWAConfig): readonly number[] {
  return conflatedIndices(config).map(
    (index) => config.identityVerification.claimTopics[index]!.id
  );
}

function emittedTopicIds(content: string): number[] {
  return [...content.matchAll(/--claim_topic (\d+)\b/g)].map((match) => Number(match[1]));
}

describe('inert-stub battery — which assertions would pass against the wrong implementation', () => {
  const config = topicUnselectedConfig();

  it('ledger: the inert predicate agrees with the real one on ABSENT and TRUE, disagrees on FALSE', () => {
    // Exactly INV-1's trap: a stub that always returns true passes two of three
    // states. Recorded so the battery's "which cases pass" claim is checkable.
    const absent: ClaimTopic = { id: 1, name: 'KYC' };
    const truthy: ClaimTopic = { id: 1, name: 'KYC', selected: true };
    const falsy: ClaimTopic = { id: 1, name: 'KYC', selected: false };

    expect(inertSelected(absent)).toBe(isClaimTopicSelected(absent));
    expect(inertSelected(truthy)).toBe(isClaimTopicSelected(truthy));
    expect(inertSelected(falsy)).not.toBe(isClaimTopicSelected(falsy));
  });

  it('ledger: INV-3’s final-position row PASSES the count-conflation (vacuous control)', () => {
    // Final topic unselected → selected count 2, indices 0 and 1 — the
    // conflation emits the right ids. This is INV-13's restated vacuity.
    const finalUnselected: RWAConfig = {
      ...config,
      identityVerification: {
        ...config.identityVerification,
        claimTopics: [
          { id: 1, name: 'KYC' },
          { id: 2, name: 'AML' },
          { id: 7, name: 'Accredited Investor', selected: false },
        ],
        trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [1, 2] }],
      },
    };

    expect(conflatedIds(finalUnselected)).toEqual(realIds(finalUnselected));
    expect(conflatedIds(finalUnselected)).toEqual([1, 2]);
  });

  it('ledger: INV-3’s non-final row FAILS the count-conflation (the discriminating case)', () => {
    expect(conflatedIds(config)).toEqual([1, 2]);
    expect(realIds(config)).toEqual([2, 7]);
    expect(conflatedIds(config)).not.toEqual(realIds(config));
    expect(conflatedIndices(config)).not.toEqual(realIndices(config));
  });

  it('ledger: INV-14 against the real generator is green; against conflated ids it would be red', () => {
    for (const path of GENERATE_PATHS) {
      const content = textOf(path.run(config).files, DEPLOY);
      expect(emittedTopicIds(content)).toEqual([2, 7]);
      // What the conflation would have emitted — the assertion that must NOT
      // hold against the real tree.
      expect(emittedTopicIds(content)).not.toEqual([1, 2]);
    }
  });

  it('ledger: a hollow "length equals selected count" assertion PASSES the conflation', () => {
    // The shape that looks like coverage and is not: asserting the RESULT
    // length without checking which indices. Both implementations agree.
    expect(conflatedIndices(config)).toHaveLength(2);
    expect(realIndices(config)).toHaveLength(2);
    expect(conflatedIndices(config)).toHaveLength(realIndices(config).length);
  });

  it('ledger: INV-4’s derived-ids identity PASSES under both — and that is correct, not hollow', () => {
    // Deriving ids FROM indices cannot drift inside one implementation. The
    // cross-implementation drift is INV-14's job.
    expect(conflatedIds(config)).toEqual(
      conflatedIndices(config).map((index) => config.identityVerification.claimTopics[index]!.id)
    );
    expect(realIds(config)).toEqual(
      realIndices(config).map((index) => config.identityVerification.claimTopics[index]!.id)
    );
  });
});
