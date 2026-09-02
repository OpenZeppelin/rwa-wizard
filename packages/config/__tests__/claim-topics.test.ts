/**
 * SF-16 — `isClaimTopicSelected`, the one definition of `ClaimTopic.selected`.
 *
 * The standing rule is paid here in full: the field has three distinguishable
 * input states and each gets its own test (INV-1). Three tests for three states
 * looks like padding until you notice that the three plausible WRONG spellings
 * each agree with the right one on two of them — `=== true` agrees on `true`
 * and `false`, `?? true` agrees on all three until a truthiness test is put in
 * front of it. So a suite that tests one state, or two, is a suite the wrong
 * spelling passes. `disagrees with each wrong spelling` below is the assertion
 * that makes the enumeration load-bearing rather than decorative.
 *
 * INV-23's mechanism is checked with a runtime witness, not only a text scan.
 * Under a recording reader the `ownKeys` trap records a topic's BARE element
 * path terminally, and no pruning removes it — so an object spread inside this
 * predicate would add an eighteenth shape to a pinned 17-row inventory two
 * packages away and read as a placement bug. `refuses ownKeys` puts the trap in
 * front of the predicate so the failure is named here instead.
 */
import { describe, expect, it } from 'vitest';

import { isClaimTopicSelected } from '../src/claim-topics';
import * as configPackage from '../src/index';
import type { ClaimTopic } from '../src/types';

/* ------------------------------------------------------------------ *
 * INV-1 — three input states, one test each
 * ------------------------------------------------------------------ */

const ABSENT: ClaimTopic = { id: 1, name: 'KYC' };
const TRUE: ClaimTopic = { id: 1, name: 'KYC', selected: true };
const FALSE: ClaimTopic = { id: 1, name: 'KYC', selected: false };

describe('isClaimTopicSelected — INV-1 the three input states', () => {
  it('absent → selected: every draft written before this change carries no field', () => {
    expect(isClaimTopicSelected(ABSENT)).toBe(true);
  });

  it('true → selected: an imported or hand-edited config.json may spell it out', () => {
    expect(isClaimTopicSelected(TRUE)).toBe(true);
  });

  it('false → not selected: the only state that turns a topic off', () => {
    expect(isClaimTopicSelected(FALSE)).toBe(false);
  });

  it('has no fourth input state to test', () => {
    // `boolean | undefined` has exactly three inhabitants, so the enumeration
    // above is complete rather than merely long. Recorded as an assertion
    // because "one test per input state" is only checkable against a stated
    // count of states.
    const states: readonly ClaimTopic[] = [ABSENT, TRUE, FALSE];
    expect(new Set(states.map((topic) => topic.selected)).size).toBe(3);
  });

  it('disagrees with each of the three wrong spellings on the ABSENT state', () => {
    // This is the assertion that makes the three-state enumeration matter. Each
    // wrong spelling agrees with the predicate on two states out of three, so a
    // suite that omits `absent` passes all three of them — and `absent` is the
    // state every existing draft is in.
    expect(isClaimTopicSelected(ABSENT)).not.toBe(ABSENT.selected === true);
    expect(isClaimTopicSelected(ABSENT)).not.toBe(Boolean(ABSENT.selected));
    expect(isClaimTopicSelected(ABSENT)).toBe(ABSENT.selected ?? true);

    // …and `?? true` is the one that agrees everywhere, which is why INV-1 bans
    // it by SPELLING rather than by behaviour: it is correct until someone puts
    // a truthiness test in front of it, at which point it reads `false` as
    // `false` and `undefined` as `false` too.
    for (const topic of [ABSENT, TRUE, FALSE]) {
      expect(isClaimTopicSelected(topic)).toBe(topic.selected ?? true);
    }
  });
});

/* ------------------------------------------------------------------ *
 * INV-16 — purity
 * ------------------------------------------------------------------ */

describe('isClaimTopicSelected — INV-16 purity', () => {
  it('returns the same answer twice for the same topic', () => {
    const topic: ClaimTopic = { id: 7, name: 'Accredited Investor', selected: false };
    expect(isClaimTopicSelected(topic)).toBe(isClaimTopicSelected(topic));
  });

  it('mutates nothing, so a frozen topic is readable', () => {
    const frozen = Object.freeze<ClaimTopic>({ id: 2, name: 'AML' });
    expect(isClaimTopicSelected(frozen)).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(frozen, 'selected')).toBe(false);
  });

  it('is not memoised: the answer follows the field, not the first call', () => {
    // A cache keyed on the topic object would return the first answer forever.
    // Under provenance the config is a recording proxy whose views are already
    // cached one per target, so a cache here would survive across `observe`
    // scopes and make the second call record no reads at all.
    const topic: { id: number; name: string; selected?: boolean } = { id: 1, name: 'KYC' };
    expect(isClaimTopicSelected(topic)).toBe(true);
    topic.selected = false;
    expect(isClaimTopicSelected(topic)).toBe(false);
    delete topic.selected;
    expect(isClaimTopicSelected(topic)).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * INV-23 — property access only, witnessed by a trap
 * ------------------------------------------------------------------ */

/** Trap names the recorder treats as an `ownKeys`-class read of the target. */
const OWN_KEYS_TRAPS = ['ownKeys', 'getPrototypeOf'] as const;

/**
 * `topic` behind a proxy that throws if the predicate reaches for its key list.
 *
 * A source scan for `{...topic}` catches the spelling that exists today; this
 * catches the class. `Object.keys`, `Object.entries`, `Object.assign`,
 * `JSON.stringify`, `structuredClone` and object spread all route through
 * `ownKeys`, and a future edit that reaches for any of them fails here by name
 * rather than as an eighteenth row in a pinned inventory in another package.
 */
function refusingOwnKeys(topic: ClaimTopic): {
  readonly probe: ClaimTopic;
  readonly witnessed: readonly string[];
} {
  const witnessed: string[] = [];
  // A fresh copy per call, so one test's probe cannot record another's reads —
  // the module-level ABSENT / TRUE / FALSE constants are shared.
  const probe = new Proxy(
    { ...topic },
    {
      ownKeys(target) {
        witnessed.push('ownKeys');
        return Reflect.ownKeys(target);
      },
      getPrototypeOf(target) {
        witnessed.push('getPrototypeOf');
        return Reflect.getPrototypeOf(target);
      },
    }
  );
  return { probe, witnessed };
}

describe('isClaimTopicSelected — INV-23 no ownKeys read of a topic', () => {
  it.each([
    ['absent', ABSENT],
    ['true', TRUE],
    ['false', FALSE],
  ])('reads %s by property access alone', (_label, topic) => {
    const { probe, witnessed } = refusingOwnKeys(topic);
    isClaimTopicSelected(probe);
    expect(witnessed).toEqual([]);
  });

  it('and the probe is not vacuous: a spread DOES trip it', () => {
    // Watch the guard fail. An absence assertion that has never been seen
    // firing is not evidence, and this one guards a mechanism (`ownKeys`
    // records the bare element path terminally) that nothing else in the
    // package would notice.
    const { probe, witnessed } = refusingOwnKeys(ABSENT);
    const spread = { ...probe };
    expect(spread.id).toBe(1);
    expect(witnessed).toContain('ownKeys');
    expect(OWN_KEYS_TRAPS).toContain('ownKeys');
  });

  it('and `in` / Object.hasOwn stay safe, so the safe spellings are named too', () => {
    // Both record `[i].selected` terminally, which is the RIGHT path — worth
    // pinning so a future edit that needs presence-detection knows which two
    // spellings it may use.
    const { probe, witnessed } = refusingOwnKeys(ABSENT);
    expect('selected' in probe).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(probe, 'selected')).toBe(false);
    expect(witnessed).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * INV-7 / INV-32 / INV-34 — the published surface
 * ------------------------------------------------------------------ */

describe('the published surface — INV-7, INV-32, INV-34', () => {
  it('exports isClaimTopicSelected from the package root', () => {
    expect(configPackage.isClaimTopicSelected).toBe(isClaimTopicSelected);
  });

  it('adds exactly one runtime export to this package', () => {
    // INV-7: three additions across two packages, all optional or new, nothing
    // removed. This package's share is one function; the two projection helpers
    // are `codegen-rwa-common`'s.
    const added = Object.keys(configPackage).filter((key) => key.startsWith('isClaimTopic'));
    expect(added).toEqual(['isClaimTopicSelected']);
  });

  it('leaves `selected` optional, so every pre-existing object literal still satisfies ClaimTopic', () => {
    // INV-34: no migration, no backfill, no default at load. The type-level half
    // is `pnpm typecheck`; this is the runtime half — a literal with no
    // `selected` is a valid `ClaimTopic` and reads as selected.
    const legacy: ClaimTopic = { id: 3, name: 'Residency' };
    expect(Object.prototype.hasOwnProperty.call(legacy, 'selected')).toBe(false);
    expect(isClaimTopicSelected(legacy)).toBe(true);
  });

  it('keeps MAX_CLAIM_TOPICS a bound on DEFINED topics, not selected ones', () => {
    // INV-28. The constant does not change; what would change it is a "switched
    // -off topics cost nothing" exemption, which returns delete-to-make-room as
    // soon as a user accumulates 15 selected topics among 60 defined.
    expect(configPackage.MAX_CLAIM_TOPICS).toBe(15);
  });
});
