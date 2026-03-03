import { describe, expect, it } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import { generate } from '../src/index';

function createFullConfig(): RWAConfig {
  return {
    token: {
      name: 'Syntax Test Token',
      symbol: 'SYNTX',
      decimals: 18,
      initialSupply: '1000000',
      documentManager: { enabled: true },
    },
    identityVerification: {
      claimTopics: [
        { id: 1, name: 'KYC' },
        { id: 2, name: 'AML' },
      ],
      trustedIssuers: [{ address: 'GCISSUER1', claimTopics: [1, 2] }],
    },
    compliance: {
      modules: [
        { moduleId: 'supply-cap', hook: 'creation' },
        { moduleId: 'max-balance', hook: 'transfer' },
        { moduleId: 'country-restrict', hook: 'transfer' },
      ],
    },
    accessControl: {
      ownership: { type: 'single-owner', ownerAddress: 'GCOWNER' },
      roles: [
        { name: 'Manager', symbol: 'manager', addresses: ['GCMGR1'] },
        { name: 'Agent', symbol: 'agent', addresses: ['GCAGENT1'] },
      ],
    },
    deployment: { network: 'testnet' },
  };
}

function createMinimalConfig(): RWAConfig {
  return {
    token: {
      name: 'Minimal',
      symbol: 'MIN',
      decimals: 0,
      documentManager: { enabled: false },
    },
    identityVerification: { claimTopics: [], trustedIssuers: [] },
    compliance: { modules: [] },
    accessControl: {
      ownership: { type: 'single-owner', ownerAddress: 'GCOWNER' },
      roles: [],
    },
    deployment: { network: 'testnet' },
  };
}

/**
 * SC-002 Rust Syntax Validation.
 *
 * Generates all contract .rs files and verifies basic syntactic validity
 * by checking structural patterns that valid Rust source must have.
 *
 * Note: Full `cargo check` validation against pinned soroban-sdk requires
 * a Rust toolchain and network access. These tests validate syntactic
 * structure without requiring external tooling.
 */
describe('SC-002 Rust syntax validation', () => {
  describe('full config (all contracts + modules)', () => {
    const config = createFullConfig();
    const result = generate(config);

    const contractFiles = Object.entries(result.files).filter(
      ([path]) => path.endsWith('.rs') && path.includes('contract.rs')
    );

    it('should generate all expected contract.rs files', () => {
      const paths = contractFiles.map(([p]) => p);
      expect(paths).toContain('contracts/rwa-token/src/contract.rs');
      expect(paths).toContain('contracts/compliance/src/contract.rs');
      expect(paths).toContain('contracts/identity-verifier/src/contract.rs');
      expect(paths).toContain('contracts/claim-topics-issuers/src/contract.rs');
      expect(paths).toContain('contracts/identity-registry-storage/src/contract.rs');
      expect(paths).toContain('contracts/modules/supply-cap/src/contract.rs');
      expect(paths).toContain('contracts/modules/max-balance/src/contract.rs');
      expect(paths).toContain('contracts/modules/country-restrict/src/contract.rs');
    });

    it.each(contractFiles)('contract %s should have valid Rust structure', (_path, content) => {
      const source = content as string;

      expect(source.length).toBeGreaterThan(0);

      expect(source).toContain('use soroban_sdk');

      expect(source).toMatch(/#\[contract(type)?\]/);

      expect(source).toMatch(/pub struct \w+/);

      expect(source).toMatch(/#\[contractimpl\]/);

      expect(source).toMatch(/impl \w+/);
    });

    it.each(contractFiles)('contract %s should have balanced braces', (_path, content) => {
      const source = content as string;

      let braceCount = 0;
      for (const char of source) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
        expect(braceCount).toBeGreaterThanOrEqual(0);
      }
      expect(braceCount).toBe(0);
    });

    it.each(contractFiles)('contract %s should have balanced parentheses', (_path, content) => {
      const source = content as string;

      let parenCount = 0;
      for (const char of source) {
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        expect(parenCount).toBeGreaterThanOrEqual(0);
      }
      expect(parenCount).toBe(0);
    });

    it.each(contractFiles)(
      'contract %s should not contain TypeScript artifacts',
      (_path, content) => {
        const source = content as string;

        expect(source).not.toMatch(/\bfunction\b/);
        expect(source).not.toMatch(/\bconsole\./);
        expect(source).not.toMatch(/\bexport\s+(default|const|function|class)\b/);
        expect(source).not.toMatch(/\bimport\b\s+\{/);
        expect(source).not.toContain('undefined');
        expect(source).not.toContain('null');
      }
    );
  });

  describe('lib.rs files', () => {
    const config = createFullConfig();
    const result = generate(config);

    const libFiles = Object.entries(result.files).filter(([path]) => path.endsWith('lib.rs'));

    it('should generate lib.rs for each contract crate', () => {
      expect(libFiles.length).toBeGreaterThanOrEqual(5);
    });

    it.each(libFiles)(
      'lib.rs at %s should have #![no_std] and mod declarations',
      (_path, content) => {
        const source = content as string;

        expect(source).toContain('#![no_std]');
        expect(source).toContain('mod contract;');
        expect(source).toContain('pub use contract::*;');
      }
    );
  });

  describe('Cargo.toml files', () => {
    const config = createFullConfig();
    const result = generate(config);

    const cargoFiles = Object.entries(result.files).filter(([path]) => path.endsWith('Cargo.toml'));

    it('should generate Cargo.toml for each crate and workspace', () => {
      expect(cargoFiles.length).toBeGreaterThanOrEqual(6);
    });

    it.each(cargoFiles)('Cargo.toml at %s should be valid TOML structure', (_path, content) => {
      const source = content as string;

      expect(source.length).toBeGreaterThan(0);
      expect(source).not.toContain('undefined');
      expect(source).not.toContain('null');
    });

    it('workspace Cargo.toml should have all members', () => {
      const workspaceToml = result.files['Cargo.toml'] as string;

      expect(workspaceToml).toContain('[workspace]');
      expect(workspaceToml).toContain('contracts/rwa-token');
      expect(workspaceToml).toContain('contracts/compliance');
      expect(workspaceToml).toContain('contracts/identity-verifier');
      expect(workspaceToml).toContain('contracts/claim-topics-issuers');
      expect(workspaceToml).toContain('contracts/identity-registry-storage');
      expect(workspaceToml).toContain('contracts/modules/supply-cap');
      expect(workspaceToml).toContain('contracts/modules/max-balance');
      expect(workspaceToml).toContain('contracts/modules/country-restrict');
    });
  });

  describe('core contracts with __constructor', () => {
    const config = createFullConfig();
    const result = generate(config);

    it('all core contracts should have pub fn __constructor', () => {
      const coreContracts = [
        'contracts/rwa-token/src/contract.rs',
        'contracts/compliance/src/contract.rs',
        'contracts/identity-verifier/src/contract.rs',
        'contracts/claim-topics-issuers/src/contract.rs',
        'contracts/identity-registry-storage/src/contract.rs',
      ];

      for (const path of coreContracts) {
        const source = result.files[path] as string;
        expect(source).toContain('pub fn __constructor');
        expect(source).toContain('e: &Env');
      }
    });
  });

  describe('minimal config produces valid Rust', () => {
    const config = createMinimalConfig();
    const result = generate(config);

    const contractFiles = Object.entries(result.files).filter(([path]) =>
      path.endsWith('contract.rs')
    );

    it.each(contractFiles)(
      'minimal config contract %s should have balanced braces',
      (_path, content) => {
        const source = content as string;
        let braceCount = 0;
        for (const char of source) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
        expect(braceCount).toBe(0);
      }
    );

    it('should not include modules directory when no modules selected', () => {
      const paths = Object.keys(result.files);
      const modulePaths = paths.filter((p) => p.includes('modules/'));
      expect(modulePaths).toHaveLength(0);
    });

    it('should not include DocumentManager when disabled', () => {
      const tokenContract = result.files['contracts/rwa-token/src/contract.rs'] as string;
      expect(tokenContract).not.toContain('DocumentManager');
    });
  });
});
