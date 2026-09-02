import { describe, expect, expectTypeOf, it } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import { makeConfig } from '../../../test/fixtures/wizardFixtures';
import {
  ConfigPathSyntaxError,
  formatConfigPath,
  isAbsentOptionalConfigPath,
  isPendingCollectionSlot,
  parseConfigPath,
  resolveConfigPath,
  type ConfigPath,
  type ConfigPathSegment,
} from './configPath';

describe('ConfigPath type (INV-4)', () => {
  it('accepts every binding-table shape and rejects non-locations', () => {
    expectTypeOf<'token.name'>().toMatchTypeOf<ConfigPath>();
    expectTypeOf<'token.documentManager.enabled'>().toMatchTypeOf<ConfigPath>();
    expectTypeOf<'token.administrativeControls.burnable'>().toMatchTypeOf<ConfigPath>();
    expectTypeOf<'identityVerification.controls.recovery'>().toMatchTypeOf<ConfigPath>();
    expectTypeOf<'accessControl.ownership.type'>().toMatchTypeOf<ConfigPath>();
    expectTypeOf<'accessControl.ownership.ownerAddress'>().toMatchTypeOf<ConfigPath>();
    expectTypeOf<'accessControl.ownership.address'>().toMatchTypeOf<ConfigPath>();
    expectTypeOf<'identityVerification.trustedIssuers[2].address'>().toMatchTypeOf<ConfigPath>();
    expectTypeOf<'identityVerification.trustedIssuers[0].claimTopics'>().toMatchTypeOf<ConfigPath>();
    expectTypeOf<'identityVerification.claimTopics[3]'>().toMatchTypeOf<ConfigPath>();
    expectTypeOf<'compliance.modules[1]'>().toMatchTypeOf<ConfigPath>();
    expectTypeOf<'compliance.modules[1].config.limit'>().toMatchTypeOf<ConfigPath>();
    expectTypeOf<'accessControl.roles[0].addresses'>().toMatchTypeOf<ConfigPath>();
    expectTypeOf<'deployment.target.rpcUrl'>().toMatchTypeOf<ConfigPath>();

    expectTypeOf<'token.nmae'>().not.toMatchTypeOf<ConfigPath>();
    expectTypeOf<'token.name.length'>().not.toMatchTypeOf<ConfigPath>();
    expectTypeOf<'compliance.modules.0'>().not.toMatchTypeOf<ConfigPath>();
    expectTypeOf<'compliance.modules[0].moduleId.x'>().not.toMatchTypeOf<ConfigPath>();
    expectTypeOf<'deployment.target.rpcUrl.foo'>().not.toMatchTypeOf<ConfigPath>();
    expectTypeOf<'identityVerification.trustedIssuers[0][1]'>().not.toMatchTypeOf<ConfigPath>();
    expectTypeOf<'token[0]'>().not.toMatchTypeOf<ConfigPath>();
  });
});

const key = (k: string): ConfigPathSegment => ({ kind: 'key', key: k });
const index = (i: number): ConfigPathSegment => ({ kind: 'index', index: i });

describe('parseConfigPath / formatConfigPath (INV-5)', () => {
  it.each([
    ['token.name', [key('token'), key('name')]],
    [
      'identityVerification.trustedIssuers[2].address',
      [key('identityVerification'), key('trustedIssuers'), index(2), key('address')],
    ],
    [
      'compliance.modules[10].config.limit',
      [key('compliance'), key('modules'), index(10), key('config'), key('limit')],
    ],
    [
      'identityVerification.claimTopics[0]',
      [key('identityVerification'), key('claimTopics'), index(0)],
    ],
    ['a[1][2]', [key('a'), index(1), index(2)]],
    ['a[999]', [key('a'), index(999)]],
  ])('parses %s and round-trips', (path, expected) => {
    const segments = parseConfigPath(path);
    expect(segments).toEqual(expected);
    expect(formatConfigPath(segments)).toBe(path);
  });

  it.each([
    ['', 0],
    ['.a', 0],
    ['a.', 2],
    ['a..b', 2],
    ['a[]', 2],
    ['a[1', 3],
    ['a]1', 1],
    ['a[01]', 2],
    ['a[-1]', 2],
    ['a[1.5]', 3],
    ['a[ 1 ]', 2],
    ['a[x]', 2],
    ['a[1]b', 4],
    ['a b', 1],
    [' a', 0],
    ['a\t.b', 1],
  ])('rejects %j at offset %i', (path, offset) => {
    let caught: unknown;
    try {
      parseConfigPath(path);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConfigPathSyntaxError);
    const error = caught as ConfigPathSyntaxError;
    expect(error.code).toBe('CONFIG_PATH_SYNTAX');
    expect(error.path).toBe(path);
    expect(error.offset).toBe(offset);
  });

  it('never parses a mutated valid path into segments that format to something else', () => {
    const valid = 'compliance.modules[12].config.limit';
    for (let i = 0; i < valid.length; i += 1) {
      for (const ch of ['.', '[', ']', 'x', '0', ' ']) {
        const mutated = valid.slice(0, i) + ch + valid.slice(i + 1);
        try {
          expect(formatConfigPath(parseConfigPath(mutated))).toBe(mutated);
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigPathSyntaxError);
        }
      }
    }
  });
});

describe('resolveConfigPath (INV-7)', () => {
  const config: RWAConfig = makeConfig({
    token: {
      name: 'T',
      symbol: 'T',
      decimals: 7,
      initialSupply: undefined,
      administrativeControls: { burnable: true, mintable: true, pausable: true },
      documentManager: { enabled: false },
    },
    identityVerification: {
      claimTopics: [{ id: 1, name: 'KYC' }],
      trustedIssuers: [
        { address: 'A', claimTopics: [1] },
        { address: 'B', claimTopics: [] },
        { address: 'C', claimTopics: [1] },
      ],
      controls: {
        addressFreezing: true,
        partialTokenFreezing: true,
        recovery: true,
        forcedTransfers: true,
      },
    },
    compliance: { modules: [{ moduleId: 'm0' }, { moduleId: 'm1', config: { limit: 5 } }] },
    accessControl: {
      ownership: { type: 'single-owner', ownerAddress: 'OWNER' },
      roles: [{ name: 'Agent', addresses: ['X'] }],
    },
  });

  it.each([
    ['token.name', 'T'],
    ['token.administrativeControls.burnable', true],
    ['identityVerification.trustedIssuers[2].address', 'C'],
    ['identityVerification.trustedIssuers[1].claimTopics', []],
    ['identityVerification.claimTopics[0]', { id: 1, name: 'KYC' }],
    ['compliance.modules[1]', { moduleId: 'm1', config: { limit: 5 } }],
    ['compliance.modules[1].config.limit', 5],
    ['accessControl.ownership.type', 'single-owner'],
    ['accessControl.ownership.ownerAddress', 'OWNER'],
    ['accessControl.roles[0].addresses', ['X']],
  ])('finds %s', (path, value) => {
    expect(resolveConfigPath(config, path)).toEqual({ found: true, value });
  });

  it('reports an own property holding undefined as found', () => {
    expect(resolveConfigPath(config, 'token.initialSupply')).toEqual({
      found: true,
      value: undefined,
    });
  });

  it.each([
    'identityVerification.trustedIssuers[3]',
    'identityVerification.trustedIssuers.length',
    'token[0]',
    'token.name.length',
    'accessControl.ownership.address',
    'token.constructor',
    'token.__proto__',
    'token.toString',
    'compliance.modules[0].config.limit',
    'compliance.modules[9].config.limit',
    'nope',
  ])('does not find %s', (path) => {
    expect(resolveConfigPath(config, path)).toEqual({ found: false, value: undefined });
  });

  it.each(['', '.a', 'a[01]', 'a[-1]', 'a[1]b', 'a b'])(
    'returns not-found for malformed %j',
    (path) => {
      expect(() => resolveConfigPath(config, path)).not.toThrow();
      expect(resolveConfigPath(config, path)).toEqual({ found: false, value: undefined });
    }
  );
});

describe('isPendingCollectionSlot / isAbsentOptionalConfigPath', () => {
  const withIssuers = makeConfig({
    identityVerification: {
      claimTopics: [{ id: 1, name: 'KYC' }],
      trustedIssuers: [
        { address: 'A', claimTopics: [1] },
        { address: 'B', claimTopics: [] },
        { address: 'C', claimTopics: [1] },
      ],
      controls: {
        addressFreezing: true,
        partialTokenFreezing: true,
        recovery: true,
        forcedTransfers: true,
      },
    },
  });

  it('treats the next append index as a pending collection slot', () => {
    expect(isPendingCollectionSlot(withIssuers, 'identityVerification.trustedIssuers[3]')).toBe(
      true
    );
    expect(
      isPendingCollectionSlot(withIssuers, 'identityVerification.trustedIssuers[3].address')
    ).toBe(true);
  });

  it('does not treat an omitted optional leaf as a pending slot', () => {
    const sparse = makeConfig();
    expect('initialSupply' in sparse.token).toBe(false);
    expect(isPendingCollectionSlot(sparse, 'token.initialSupply')).toBe(false);
    expect(isAbsentOptionalConfigPath(sparse, 'token.initialSupply')).toBe(true);
  });

  it('does not treat a missing module config key as a pending slot', () => {
    const sparse = makeConfig({
      compliance: { modules: [{ moduleId: 'm1' }] },
    });
    expect(isPendingCollectionSlot(sparse, 'compliance.modules[0].config.limit')).toBe(false);
    expect(isAbsentOptionalConfigPath(sparse, 'compliance.modules[0].config.limit')).toBe(true);
  });
});
