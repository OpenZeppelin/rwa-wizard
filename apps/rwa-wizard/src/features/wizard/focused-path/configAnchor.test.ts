import { describe, expect, it } from 'vitest';

import { tokenPaths } from '../config-path';
import type { ConfigAnchor, ConfigAnchorKey } from './configAnchor';
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
  parseConfigAnchor,
  roleAnchor,
  tokenAnchor,
} from './configAnchor';

/**
 * INV-9 (the closed key union) and INV-10 (`parseConfigAnchor` totality).
 *
 * The two are one property seen from both ends: the type system stops a
 * malformed anchor being *written*, and the parser stops a malformed anchor
 * being *believed*. Neither is sufficient alone — the DOM is untrusted input, so
 * the parser must be total even though every anchor in the tree came from a
 * builder.
 */

/** Every builder's output, paired with the union member it must decode back to. */
const BUILDER_CASES: ReadonlyArray<readonly [ConfigAnchorKey, ConfigAnchor]> = [
  [tokenAnchor('name'), { kind: 'token', field: 'name' }],
  [tokenAnchor('symbol'), { kind: 'token', field: 'symbol' }],
  [tokenAnchor('decimals'), { kind: 'token', field: 'decimals' }],
  [tokenAnchor('initialSupply'), { kind: 'token', field: 'initialSupply' }],
  [tokenAnchor('documentManagerEnabled'), { kind: 'token', field: 'documentManagerEnabled' }],
  [adminAnchor('burnable'), { kind: 'admin', controlId: 'burnable' }],
  [
    identityControlAnchor('addressFreezing'),
    { kind: 'identityControl', controlId: 'addressFreezing' },
  ],
  [OWNERSHIP_TYPE_ANCHOR, { kind: 'ownershipType' }],
  [OWNERSHIP_ADDRESS_ANCHOR, { kind: 'ownershipAddress' }],
  [roleAnchor('Document Management'), { kind: 'role', roleName: 'Document Management' }],
  [moduleAnchor('transfer-allow'), { kind: 'module', moduleId: 'transfer-allow' }],
  [
    moduleConfigAnchor('transfer-allow', 'allowedUsers'),
    { kind: 'moduleConfig', moduleId: 'transfer-allow', fieldKey: 'allowedUsers' },
  ],
  [claimTopicAnchor(1), { kind: 'claimTopic', topicId: 1 }],
  [claimTopicAnchor(0), { kind: 'claimTopic', topicId: 0 }],
  [claimTopicAnchor(9001), { kind: 'claimTopic', topicId: 9001 }],
  [CLAIM_TOPIC_DRAFT_ANCHOR, { kind: 'claimTopicDraft' }],
  [issuerAnchor('GABC'), { kind: 'issuer', address: 'GABC' }],
  [issuerTopicsAnchor('GABC'), { kind: 'issuerTopics', address: 'GABC' }],
  [ISSUER_DRAFT_ANCHOR, { kind: 'issuerDraft' }],
];

describe('parseConfigAnchor — round trip (INV-10)', () => {
  it.each(BUILDER_CASES)('decodes %s back to its union member', (key, expected) => {
    expect(parseConfigAnchor(key)).toEqual(expected);
  });

  it('covers all thirteen anchor kinds', () => {
    const kinds = new Set(BUILDER_CASES.map(([, anchor]) => anchor.kind));
    expect([...kinds].sort()).toEqual(
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

  it('accepts every `tokenPaths` member, so no token field can be unreachable', () => {
    for (const field of Object.keys(tokenPaths)) {
      expect(parseConfigAnchor(`token|${field}`)).toEqual({ kind: 'token', field });
    }
  });
});

/**
 * The reject table (§ 8.1). Each row is `null` *and* does not throw — the two
 * halves are separate assertions because a parser that threw would also fail to
 * return a value, and a test that only checked the value would pass a throw as a
 * skipped assertion.
 */
const REJECT_TABLE: ReadonlyArray<readonly [string, string]> = [
  ['', 'the empty string'],
  ['nope', 'an unknown kind'],
  ['token', 'a known kind with no argument'],
  ['token|bogus', 'a token field that is not a `tokenPaths` member'],
  ['module', 'a one-argument kind with the argument missing'],
  ['module|', 'a one-argument kind with an empty argument'],
  ['moduleConfig|only-one', 'a two-argument kind given one'],
  ['moduleConfig|a|', 'a two-argument kind with an empty second argument'],
  ['moduleConfig||b', 'a two-argument kind with an empty first argument'],
  ['claimTopic|abc', 'a non-numeric topic id'],
  ['claimTopic|', 'an empty topic id'],
  ['claimTopic|1.5', 'a non-integer topic id'],
  ['claimTopic|01', 'a zero-padded topic id'],
  ['claimTopic|+1', 'a signed topic id'],
  ['claimTopic|1e3', 'an exponent-form topic id'],
  ['admin|', 'an empty control id'],
  ['token|name|extra', 'more segments than the kind takes'],
  ['ownershipType|x', 'an argument on a zero-argument kind'],
  ['claimTopicDraft|1', 'an argument on a zero-argument kind'],
  ['issuerDraft|a|b|c', 'a four-segment string'],
];

describe('parseConfigAnchor — malformed input (INV-10)', () => {
  it.each(REJECT_TABLE)('rejects %j — %s', (value) => {
    expect(parseConfigAnchor(value)).toBeNull();
  });

  it.each(REJECT_TABLE)('does not throw on %j', (value) => {
    expect(() => parseConfigAnchor(value)).not.toThrow();
  });

  it('never throws over 500 generated strings from a hostile alphabet', () => {
    // Deterministic PRNG: a seeded LCG, so a failure is reproducible rather than
    // "it went red once on CI".
    let seed = 0x5f12;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const alphabet = [...'abcdefghijklmnopqrstuvwxyz0123456789|-.[]+ ', 'é', '\u{1f600}'];

    for (let i = 0; i < 500; i += 1) {
      const length = Math.floor(next() * 24);
      let value = '';
      for (let c = 0; c < length; c += 1) {
        value += alphabet[Math.floor(next() * alphabet.length)];
      }
      expect(() => parseConfigAnchor(value)).not.toThrow();
      const result = parseConfigAnchor(value);
      expect(result === null || typeof result === 'object').toBe(true);
    }
  });

  it('treats a `claimTopic` id that is negative as a legitimate integer', () => {
    // Not reachable from the wizard, but the property under test is totality,
    // and `-3` is a well-formed integer the grammar admits. Pinned so nobody
    // "fixes" the regex into rejecting it and calls that a tightening.
    expect(parseConfigAnchor('claimTopic|-3')).toEqual({ kind: 'claimTopic', topicId: -3 });
  });
});

describe('ConfigAnchorKey is closed (INV-9)', () => {
  /**
   * These are compile-time assertions. `pnpm typecheck` is the gate: each
   * `@ts-expect-error` fails the build if the expression it guards *stops* being
   * an error, which is what catches `ConfigAnchorKey` being widened to `string`
   * "for now" during a future refactor.
   */
  it('rejects malformed anchor keys at compile time', () => {
    const accept = (key: ConfigAnchorKey): ConfigAnchorKey => key;

    // @ts-expect-error — a raw string is not a ConfigAnchorKey.
    accept('not-an-anchor');
    // @ts-expect-error — `nope` is not a `tokenPaths` member.
    accept('token|nope');
    // @ts-expect-error — `moduleConfig` takes two arguments, not one.
    accept('moduleConfig|only-one');
    // @ts-expect-error — `ownershipType` takes none.
    accept('ownershipType|extra');

    const anchor = (value: ConfigAnchor): ConfigAnchor => value;
    // @ts-expect-error — `teleport` is not a member of the union.
    anchor({ kind: 'teleport' });
    // @ts-expect-error — `token` carries `field`, not `controlId`.
    anchor({ kind: 'token', controlId: 'name' });

    // Positive control: without this the block could pass by every line being
    // an error for an unrelated reason.
    expect(accept(tokenAnchor('name'))).toBe('token|name');
  });

  /**
   * The mechanism a fourteenth kind meets, recorded for the next reader.
   *
   * Adding `| { readonly kind: 'vault' }` to `ConfigAnchor` makes
   * `anchorToConfigPath` fail to compile at its `const exhaustive: never =
   * anchor` tail with
   *   "Type '{ kind: "vault"; }' is not assignable to type 'never'".
   * That is the guard working: a new kind is a compile error at the resolver
   * before it can be a runtime hole. It is written here rather than left to be
   * rediscovered, because the error surfaces in a file the author of the new
   * kind has no reason to open.
   */
  it('documents the exhaustiveness mechanism', () => {
    expect(true).toBe(true);
  });
});
