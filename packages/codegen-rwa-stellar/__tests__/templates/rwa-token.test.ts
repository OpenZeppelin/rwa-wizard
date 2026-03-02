import { describe, expect, it } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import { generateRwaTokenContract } from '../../src/templates/contracts/rwa-token';

function createMinimalConfig(overrides: Partial<RWAConfig> = {}): RWAConfig {
  return {
    token: {
      name: 'Test Token',
      symbol: 'TEST',
      decimals: 18,
      documentManager: { enabled: false },
      ...overrides.token,
    },
    identityVerification: {
      claimTopics: [],
      trustedIssuers: [],
      ...overrides.identityVerification,
    },
    compliance: {
      modules: [],
      ...overrides.compliance,
    },
    accessControl: {
      ownership: { type: 'single-owner', ownerAddress: 'GCOWNER...' },
      roles: [],
      ...overrides.accessControl,
    },
    deployment: {
      network: 'testnet',
      ...overrides.deployment,
    },
  };
}

describe('RWA Token Contract Template', () => {
  describe('traits', () => {
    it('should include FungibleToken with ContractType = RWA', () => {
      const config = createMinimalConfig();
      const output = generateRwaTokenContract(config);

      expect(output).toContain('impl FungibleToken for RwaTokenContract');
      expect(output).toContain('type ContractType = RWA;');
    });

    it('should include AccessControl trait implementation', () => {
      const config = createMinimalConfig();
      const output = generateRwaTokenContract(config);

      expect(output).toContain('impl AccessControl for RwaTokenContract');
    });

    it('should include Pausable trait implementation', () => {
      const config = createMinimalConfig();
      const output = generateRwaTokenContract(config);

      expect(output).toContain('impl Pausable for RwaTokenContract');
      expect(output).toContain('fn pause(');
      expect(output).toContain('fn unpause(');
    });

    it('should include correct imports', () => {
      const config = createMinimalConfig();
      const output = generateRwaTokenContract(config);

      expect(output).toContain('use stellar_tokens::');
      expect(output).toContain('use stellar_access::access_control');
      expect(output).toContain('use stellar_contract_utils::pausable');
    });
  });

  describe('constructor (__constructor)', () => {
    it('should have correct base arguments per SR-016', () => {
      const config = createMinimalConfig();
      const output = generateRwaTokenContract(config);

      expect(output).toContain('pub fn __constructor(');
      expect(output).toContain('e: &Env,');
      expect(output).toContain('name: String,');
      expect(output).toContain('symbol: String,');
      expect(output).toContain('admin: Address,');
      expect(output).toContain('initial_supply: i128,');
    });

    it('should call Base::set_metadata with configured decimals', () => {
      const config = createMinimalConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 7,
          documentManager: { enabled: false },
        },
      });
      const output = generateRwaTokenContract(config);

      expect(output).toContain('Base::set_metadata(e, 7, name, symbol)');
    });

    it('should call access_control::set_admin', () => {
      const config = createMinimalConfig();
      const output = generateRwaTokenContract(config);

      expect(output).toContain('access_control::set_admin(e, &admin)');
    });

    it('should set default token version per SR-012 via RWAStorageKey', () => {
      const config = createMinimalConfig();
      const output = generateRwaTokenContract(config);

      expect(output).toContain('RWAStorageKey::Version');
      expect(output).toContain('"1.0.0"');
    });

    it('should include mint call when initialSupply is defined', () => {
      const config = createMinimalConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          initialSupply: '1000000',
          documentManager: { enabled: false },
        },
      });
      const output = generateRwaTokenContract(config);

      expect(output).toContain('Base::mint(e, &admin, initial_supply)');
    });

    it('should omit mint call when initialSupply is undefined', () => {
      const config = createMinimalConfig();
      const output = generateRwaTokenContract(config);

      expect(output).not.toContain('Base::mint');
    });
  });

  describe('conditional DocumentManager (SR-004)', () => {
    it('should include DocumentManager when enabled', () => {
      const config = createMinimalConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          documentManager: { enabled: true },
        },
      });
      const output = generateRwaTokenContract(config);

      expect(output).toContain('impl DocumentManager for RwaTokenContract');
      expect(output).toContain('use stellar_tokens::rwa::extensions::doc_manager');
    });

    it('should omit DocumentManager when disabled', () => {
      const config = createMinimalConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          documentManager: { enabled: false },
        },
      });
      const output = generateRwaTokenContract(config);

      expect(output).not.toContain('DocumentManager');
      expect(output).not.toContain('doc_manager');
    });
  });

  describe('role grants (SR-005)', () => {
    it('should add role grant calls for configured roles', () => {
      const config = createMinimalConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNER...' },
          roles: [
            { name: 'Manager', symbol: 'manager', addresses: ['GCMGR...'] },
            { name: 'Agent', symbol: 'agent', addresses: ['GCAGNT...'] },
          ],
        },
      });
      const output = generateRwaTokenContract(config);

      expect(output).toContain('symbol_short!("manager")');
      expect(output).toContain('symbol_short!("agent")');
      expect(output).toContain('grant_role_no_auth');
    });

    it('should add role address parameters to constructor', () => {
      const config = createMinimalConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNER...' },
          roles: [{ name: 'Manager', symbol: 'manager', addresses: ['GCMGR...'] }],
        },
      });
      const output = generateRwaTokenContract(config);

      expect(output).toContain('manager: Address,');
    });

    it('should auto-generate symbol when not provided', () => {
      const config = createMinimalConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNER...' },
          roles: [{ name: 'Custom Role', addresses: ['GCADDR...'] }],
        },
      });
      const output = generateRwaTokenContract(config);

      expect(output).toContain('symbol_short!("customrol")');
    });

    it('should produce no grant calls when roles array is empty', () => {
      const config = createMinimalConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNER...' },
          roles: [],
        },
      });
      const output = generateRwaTokenContract(config);

      expect(output).not.toContain('grant_role_no_auth');
      expect(output).not.toContain('symbol_short!');
    });

    it('should import symbol_short only when roles exist', () => {
      const noRoles = createMinimalConfig();
      const outputNoRoles = generateRwaTokenContract(noRoles);
      expect(outputNoRoles).not.toContain('symbol_short');

      const withRoles = createMinimalConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNER...' },
          roles: [{ name: 'Manager', symbol: 'manager', addresses: ['GCMGR...'] }],
        },
      });
      const outputWithRoles = generateRwaTokenContract(withRoles);
      expect(outputWithRoles).toContain('symbol_short');
    });
  });

  describe('struct declaration', () => {
    it('should declare the contract struct', () => {
      const config = createMinimalConfig();
      const output = generateRwaTokenContract(config);

      expect(output).toContain('#[contract]');
      expect(output).toContain('pub struct RwaTokenContract;');
    });
  });

  describe('multi-sig and dao ownership', () => {
    it('should work with multi-sig ownership', () => {
      const config = createMinimalConfig({
        accessControl: {
          ownership: { type: 'multi-sig', address: 'GCMULTISIG...' },
          roles: [],
        },
      });
      const output = generateRwaTokenContract(config);

      expect(output).toContain('pub fn __constructor(');
      expect(output).toContain('admin: Address,');
    });

    it('should work with dao ownership', () => {
      const config = createMinimalConfig({
        accessControl: {
          ownership: { type: 'dao', address: 'GCDAO...' },
          roles: [],
        },
      });
      const output = generateRwaTokenContract(config);

      expect(output).toContain('pub fn __constructor(');
      expect(output).toContain('admin: Address,');
    });
  });
});
