import { describe, expect, it } from 'vitest';

import {
  adminAnchor,
  CLAIM_TOPIC_DRAFT_ANCHOR,
  claimTopicAnchor,
  identityControlAnchor,
  isConfigAnchorKey,
  isInspectableAnchor,
  ISSUER_DRAFT_ANCHOR,
  issuerAnchor,
  issuerTopicsAnchor,
  moduleAnchor,
  moduleConfigAnchor,
  OWNERSHIP_ADDRESS_ANCHOR,
  OWNERSHIP_TYPE_ANCHOR,
  parseConfigAnchor,
  roleAnchor,
  tokenAnchor,
  type ConfigAnchor,
} from './configAnchor';

/**
 * SF-14 INV-8 (`isInspectableAnchor` is false for exactly the two draft anchors)
 * and INV-11 (`isConfigAnchorKey` accepts exactly what `parseConfigAnchor`
 * accepts).
 *
 * Both are predicates *over* SF-12's parser rather than second implementations
 * of it, and both are tested that way: INV-8 gets one explicit case per arm so a
 * fourteenth kind cannot be added without a decision here, and INV-11 is tested
 * as an equivalence over the parser's own accept and reject sets rather than
 * over a list of its own.
 */

function decode(key: string): ConfigAnchor {
  const anchor = parseConfigAnchor(key);
  if (anchor === null) throw new Error(`fixture key ${key} does not decode`);
  return anchor;
}

// ---------------------------------------------------------------------------
// INV-8 — one case per arm, written out
// ---------------------------------------------------------------------------

/**
 * **One `it` per arm, deliberately not `it.each` over a list.** A list is a
 * thing a fourteenth anchor kind can be omitted from silently; thirteen named
 * cases plus the completeness check below are a thing it cannot. The `never`
 * tail in the implementation makes the fourteenth kind a compile error there;
 * this is the matching decision point in the suite.
 */
describe('isInspectableAnchor — one case per arm (INV-8)', () => {
  const tested = new Set<ConfigAnchor['kind']>();

  function assertArm(anchor: ConfigAnchor, expected: boolean): void {
    tested.add(anchor.kind);
    expect(isInspectableAnchor(anchor)).toBe(expected);
  }

  it('token is inspectable', () => assertArm(decode(tokenAnchor('name')), true));
  it('admin is inspectable', () => assertArm(decode(adminAnchor('burnable')), true));
  it('identityControl is inspectable', () =>
    assertArm(decode(identityControlAnchor('recovery')), true));
  it('ownershipType is inspectable', () => assertArm(decode(OWNERSHIP_TYPE_ANCHOR), true));
  it('ownershipAddress is inspectable', () => assertArm(decode(OWNERSHIP_ADDRESS_ANCHOR), true));
  it('role is inspectable', () => assertArm(decode(roleAnchor('Manager')), true));
  it('module is inspectable', () => assertArm(decode(moduleAnchor('transfer-allow')), true));
  it('moduleConfig is inspectable', () =>
    assertArm(decode(moduleConfigAnchor('transfer-allow', 'allowedUsers')), true));
  it('claimTopic is inspectable', () => assertArm(decode(claimTopicAnchor(1)), true));
  it('issuer is inspectable', () => assertArm(decode(issuerAnchor('GAAA')), true));
  it('issuerTopics is inspectable', () => assertArm(decode(issuerTopicsAnchor('GAAA')), true));

  /**
   * The two refusals, and the reason they are load-bearing rather than
   * defensive: `anchorToConfigPath` resolves `claimTopicDraft` through
   * `claimTopics.length` and `issuerDraft` through `nextTrustedIssuerIndex`, so
   * both name the slot the *next* item will occupy. An inspectable draft anchor
   * makes the column describe one slot past the item the user just created —
   * shipping the reported defect inside the change that fixes it.
   */
  it('claimTopicDraft is NOT inspectable', () =>
    assertArm(decode(CLAIM_TOPIC_DRAFT_ANCHOR), false));
  it('issuerDraft is NOT inspectable', () => assertArm(decode(ISSUER_DRAFT_ANCHOR), false));

  it('covers all thirteen kinds — a fourteenth needs a decision here', () => {
    expect([...tested].sort()).toEqual(
      [
        'admin',
        'claimTopic',
        'claimTopicDraft',
        'identityControl',
        'issuer',
        'issuerDraft',
        'issuerTopics',
        'module',
        'moduleConfig',
        'ownershipAddress',
        'ownershipType',
        'role',
        'token',
      ].sort()
    );
  });

  /**
   * Exactly two refusals, counted rather than asserted arm by arm — so widening
   * the refusal set (say, refusing `moduleConfig` while "simplifying") fails
   * here even if every individual arm above were edited to match.
   */
  it('exactly two of the thirteen kinds are refused', () => {
    const arms: readonly ConfigAnchor[] = [
      decode(tokenAnchor('name')),
      decode(adminAnchor('burnable')),
      decode(identityControlAnchor('recovery')),
      decode(OWNERSHIP_TYPE_ANCHOR),
      decode(OWNERSHIP_ADDRESS_ANCHOR),
      decode(roleAnchor('Manager')),
      decode(moduleAnchor('transfer-allow')),
      decode(moduleConfigAnchor('transfer-allow', 'allowedUsers')),
      decode(claimTopicAnchor(1)),
      decode(issuerAnchor('GAAA')),
      decode(issuerTopicsAnchor('GAAA')),
      decode(CLAIM_TOPIC_DRAFT_ANCHOR),
      decode(ISSUER_DRAFT_ANCHOR),
    ];
    expect(arms).toHaveLength(13);
    expect(
      arms
        .filter((anchor) => !isInspectableAnchor(anchor))
        .map((a) => a.kind)
        .sort()
    ).toEqual(['claimTopicDraft', 'issuerDraft']);
  });

  it('the argument values do not change the answer — the kind does', () => {
    for (const address of ['GAAA', 'G', 'a b c', '0x0']) {
      expect(isInspectableAnchor(decode(issuerAnchor(address)))).toBe(true);
    }
    for (const topicId of [0, 1, -3, 9001]) {
      expect(isInspectableAnchor(decode(claimTopicAnchor(topicId)))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// INV-11 — the predicate accepts exactly what the parser accepts
// ---------------------------------------------------------------------------

/**
 * Every builder's output, so the accept side is the real key space rather than a
 * sample of it.
 */
const WELL_FORMED: readonly string[] = [
  tokenAnchor('name'),
  tokenAnchor('symbol'),
  tokenAnchor('decimals'),
  tokenAnchor('initialSupply'),
  tokenAnchor('documentManagerEnabled'),
  adminAnchor('burnable'),
  identityControlAnchor('addressFreezing'),
  OWNERSHIP_TYPE_ANCHOR,
  OWNERSHIP_ADDRESS_ANCHOR,
  roleAnchor('Document Management'),
  moduleAnchor('transfer-allow'),
  moduleConfigAnchor('transfer-allow', 'allowedUsers'),
  claimTopicAnchor(0),
  claimTopicAnchor(9001),
  CLAIM_TOPIC_DRAFT_ANCHOR,
  issuerAnchor('GABC'),
  issuerTopicsAnchor('GABC'),
  ISSUER_DRAFT_ANCHOR,
];

/**
 * The rejection set `parseConfigAnchor` already has tests for (SF-12 INV-10),
 * repeated here because the property being asserted is the **agreement of two
 * functions**, not the behaviour of either — so both sides must be driven over
 * the same values in the same file.
 */
const MALFORMED: readonly string[] = [
  '',
  'nope',
  'token',
  'token|bogus',
  'module',
  'module|',
  'moduleConfig|only-one',
  'moduleConfig|a|',
  'moduleConfig||b',
  'claimTopic|abc',
  'claimTopic|',
  'claimTopic|1.5',
  'claimTopic|01',
  'claimTopic|+1',
  'claimTopic|1e3',
  'admin|',
  'token|name|extra',
  'ownershipType|x',
  'claimTopicDraft|1',
  'issuerDraft|a|b|c',
  '|',
  '||||',
  '🙂|🙃',
];

describe('isConfigAnchorKey accepts exactly what parseConfigAnchor accepts (INV-11)', () => {
  it.each(WELL_FORMED)('accepts %j, and so does the parser', (value) => {
    expect(isConfigAnchorKey(value)).toBe(true);
    expect(parseConfigAnchor(value)).not.toBeNull();
  });

  it.each(MALFORMED)('rejects %j, and so does the parser', (value) => {
    expect(isConfigAnchorKey(value)).toBe(false);
    expect(parseConfigAnchor(value)).toBeNull();
  });

  /**
   * The equivalence stated once, over both sets at once. The two predicates
   * disagreeing is the failure this closes: a cast in the key walk instead of a
   * predicate type-checks and is invisible in review, and a corrupted
   * `data-config-anchor` would then be stored as the subject and decode to
   * `null` at read time — the column silently describing nothing while an
   * element that does resolve sits focused.
   */
  it('the two never disagree, over the whole accept and reject space', () => {
    const disagreements = [...WELL_FORMED, ...MALFORMED].filter(
      (value) => isConfigAnchorKey(value) !== (parseConfigAnchor(value) !== null)
    );
    expect(disagreements).toEqual([]);
    // Non-vacuity: the sets are non-empty and contain both answers.
    expect(WELL_FORMED.length).toBeGreaterThan(10);
    expect(MALFORMED.length).toBeGreaterThan(10);
  });

  it('never throws, for any of them', () => {
    for (const value of [...WELL_FORMED, ...MALFORMED, 'x'.repeat(10_000)]) {
      expect(() => isConfigAnchorKey(value)).not.toThrow();
    }
  });
});
