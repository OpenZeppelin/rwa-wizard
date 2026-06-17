import { describe, expect, it } from 'vitest';

import { CRATE_NAMES } from '../../src/constants';
import { generateBuildSh } from '../../src/templates/scripts/build-sh';
import { generateDeploySh } from '../../src/templates/scripts/deploy-sh';
import { shellEscape } from '../../src/templates/scripts/deploy-sh-helpers';
import {
  createCustomDeploymentTarget,
  createPresetDeploymentTarget,
  createValidConfig,
} from '../helpers/config';

describe('build.sh template', () => {
  it('should be a bash script with shebang', () => {
    const config = createValidConfig();
    const script = generateBuildSh(config);

    expect(script).toMatch(/^#!/);
    expect(script).toContain('#!/bin/bash');
  });

  it('should set -e for exit on error', () => {
    const config = createValidConfig();
    const script = generateBuildSh(config);

    expect(script).toContain('set -e');
  });

  it('should build all workspace contracts using stellar contract build', () => {
    const config = createValidConfig();
    const script = generateBuildSh(config);

    expect(script).toContain('stellar contract build');
  });

  it('should be executable (include a shebang line)', () => {
    const config = createValidConfig();
    const script = generateBuildSh(config);

    expect(script.startsWith('#!/bin/bash')).toBe(true);
  });
});

describe('deploy.sh template', () => {
  describe('deployment order per SR-006', () => {
    it('should deploy contracts in correct dependency order: CTI → IRS → Identity Verifier → Compliance → RWA Token', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      const ctiPos = script.indexOf(CRATE_NAMES.claimTopicsIssuers);
      const irsPos = script.indexOf(CRATE_NAMES.identityRegistryStorage);
      const ivPos = script.indexOf(CRATE_NAMES.identityVerifier);
      const compPos = script.indexOf(CRATE_NAMES.compliance);
      const tokenPos = script.indexOf(CRATE_NAMES.rwaToken);

      expect(ctiPos).toBeLessThan(irsPos);
      expect(irsPos).toBeLessThan(ivPos);
      expect(ivPos).toBeLessThan(compPos);
      expect(compPos).toBeLessThan(tokenPos);
    });

    it('should deploy modules after Compliance and before RWA Token when modules are present', () => {
      const config = createValidConfig({
        compliance: {
          modules: [{ moduleId: 'supply-limit', config: { limit: 1000000 } }],
        },
      });
      const script = generateDeploySh(config);

      const compDeployPos = script.indexOf('COMPLIANCE_ADDRESS=$(');
      const moduleDeployPos = script.indexOf('MODULE_SUPPLY_LIMIT_ADDRESS=$(');
      const tokenDeployPos = script.indexOf('RWA_TOKEN_ADDRESS=$(');

      expect(compDeployPos).toBeGreaterThan(-1);
      expect(moduleDeployPos).toBeGreaterThan(-1);
      expect(tokenDeployPos).toBeGreaterThan(-1);
      expect(compDeployPos).toBeLessThan(moduleDeployPos);
      expect(moduleDeployPos).toBeLessThan(tokenDeployPos);
    });
  });

  describe('address capture threading', () => {
    it('should capture deployed addresses into shell variables', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toMatch(/CTI_ADDRESS=.*stellar contract deploy/s);
      expect(script).toMatch(/IRS_ADDRESS=.*stellar contract deploy/s);
      expect(script).toMatch(/IDENTITY_VERIFIER_ADDRESS=.*stellar contract deploy/s);
      expect(script).toMatch(/COMPLIANCE_ADDRESS=.*stellar contract deploy/s);
      expect(script).toMatch(/RWA_TOKEN_ADDRESS=.*stellar contract deploy/s);
    });

    it('should thread CTI address into Identity Verifier deployment', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      const ivSection = extractDeploySection(script, 'IDENTITY_VERIFIER_ADDRESS');
      expect(ivSection).toContain('$CTI_ADDRESS');
      expect(ivSection).toContain('$IRS_ADDRESS');
      expect(ivSection).toContain('$MANAGER');
    });

    it('should serialize all configured non-manager role members into token constructor args', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNERADDR' },
          roles: [
            { name: 'Manager', symbol: 'manager', addresses: ['GCMANAGER1'] },
            { name: 'minter', addresses: ['GCMINTER1', 'GCMINTER2'] },
          ],
        },
      });
      const script = generateDeploySh(config);
      const tokenSection = extractDeploySection(script, 'RWA_TOKEN_ADDRESS');
      const expectedMinterAddresses = shellEscape('["GCMINTER1", "GCMINTER2"]');

      expect(tokenSection).toContain(`--minter "${expectedMinterAddresses}"`);
      expect(tokenSection).not.toContain('--minter "GCMINTER1"');
      expect(tokenSection).not.toContain('--minter "GCMINTER2"');
    });

    it('should shell-escape role address vectors before embedding them in deploy args', () => {
      const minterAddresses = ['GCROLE$ONE"1', "GCROLE'TWO\\\\2"];
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNERADDR' },
          roles: [
            { name: 'Manager', symbol: 'manager', addresses: ['GCMANAGER1'] },
            { name: 'minter', addresses: minterAddresses },
          ],
        },
      });
      const script = generateDeploySh(config);
      const tokenSection = extractDeploySection(script, 'RWA_TOKEN_ADDRESS');
      const expectedSerializedAddresses = shellEscape(
        `[${minterAddresses.map((address) => JSON.stringify(address)).join(', ')}]`
      );

      expect(tokenSection).toContain(`--minter "${expectedSerializedAddresses}"`);
    });
  });

  describe('error handling (exit code checks)', () => {
    it('should be a bash script with set -e', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('#!/bin/bash');
      expect(script).toContain('set -e');
    });

    it('should check exit codes after deployments', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('$?');
    });

    it('should abort with descriptive messages on deployment failure', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('Failed to deploy');
    });

    it('should fail early with a clear source-account message when no source account is set', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('SOURCE_ACCOUNT="${SOURCE_ACCOUNT:-${STELLAR_ACCOUNT:-}}"');
      expect(script).toContain('Missing Stellar source account.');
      expect(script).toContain('Example: export STELLAR_ACCOUNT=alice');
    });
  });

  describe('stellar cli source-account plumbing', () => {
    it('should thread SOURCE_ACCOUNT into every deploy command', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('stellar contract deploy \\');
      expect(script).toContain('--source-account "$SOURCE_ACCOUNT"');
    });

    it('should define role-specific invoke signers with SOURCE_ACCOUNT defaults', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('ADMIN_SOURCE_ACCOUNT="${ADMIN_SOURCE_ACCOUNT:-$SOURCE_ACCOUNT}"');
      expect(script).toContain('MANAGER_SOURCE_ACCOUNT="${MANAGER_SOURCE_ACCOUNT:-$SOURCE_ACCOUNT}"');
    });

    it('should warn when admin and manager addresses differ', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('if [ "$ADMIN" != "$MANAGER" ]; then');
      expect(script).toContain('ADMIN_SOURCE_ACCOUNT and MANAGER_SOURCE_ACCOUNT');
    });

    it('should verify CLI identity addresses when admin and manager differ', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('resolve_cli_identity_address()');
      expect(script).toContain('verify_role_signer "Admin" "$ADMIN" "$ADMIN_SOURCE_ACCOUNT"');
      expect(script).toContain('verify_role_signer "Manager" "$MANAGER" "$MANAGER_SOURCE_ACCOUNT"');
      expect(script).toContain('stellar keys address "$identity"');
    });

    it('should only run role signer verification inside an admin != manager guard', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      const guardStart = script.indexOf('if [ "$ADMIN" != "$MANAGER" ]; then');
      const adminVerify = script.indexOf('verify_role_signer "Admin"');
      const managerVerify = script.indexOf('verify_role_signer "Manager"');

      expect(guardStart).toBeGreaterThan(-1);
      expect(adminVerify).toBeGreaterThan(guardStart);
      expect(managerVerify).toBeGreaterThan(adminVerify);
    });

    it('should use role-specific signers for post-deploy invoke commands', () => {
      const config = createValidConfig({
        compliance: {
          modules: [{ moduleId: 'supply-limit', config: { limit: 1000000 } }],
        },
      });
      const script = generateDeploySh(config);

      const bindSection = script.slice(script.indexOf('stellar contract invoke \\'));
      expect(bindSection).toContain('--source-account "$MANAGER_SOURCE_ACCOUNT"');

      expect(script).toMatch(
        /--source-account "\$ADMIN_SOURCE_ACCOUNT" \\\n[\s\S]*?set_compliance_address/
      );
      expect(script).toContain(
        'set_compliance_address \\\n  --token "$RWA_TOKEN_ADDRESS" --compliance "$COMPLIANCE_ADDRESS" --operator "$ADMIN"'
      );
    });
  });

  describe('post-deploy configuration per SR-013', () => {
    it('should bind token on Compliance contract', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('bind_token');
      expect(script).toContain('$COMPLIANCE_ADDRESS');
      expect(script).toContain('$RWA_TOKEN_ADDRESS');
    });

    it('should bind token on IRS contract', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      const bindSections = script.split('bind_token');
      expect(bindSections.length).toBeGreaterThanOrEqual(3);
    });

    it('should add claim topics from config', () => {
      const config = createValidConfig({
        identityVerification: {
          claimTopics: [
            { id: 1, name: 'KYC' },
            { id: 2, name: 'AML' },
            { id: 3, name: 'Accreditation' },
          ],
          trustedIssuers: [],
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('add_claim_topic');
      expect(script).toContain('$CTI_ADDRESS');
    });

    it('should add trusted issuers from config', () => {
      const config = createValidConfig({
        identityVerification: {
          claimTopics: [{ id: 1, name: 'KYC' }],
          trustedIssuers: [
            {
              address: 'GCISSUER1',
              claimTopics: [1],
            },
          ],
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('add_trusted_issuer');
    });

    it('should register modules on Compliance when modules are selected', () => {
      const config = createValidConfig({
        compliance: {
          modules: [{ moduleId: 'supply-limit', config: { limit: 1000000 } }],
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('add_module_to');
      expect(script).toContain('set_supply_limit');
    });

    it('should serialize compliance hooks using contract enum case names', () => {
      const config = createValidConfig({
        compliance: {
          modules: [
            { moduleId: 'supply-limit', config: { limit: 1000000 } },
            { moduleId: 'max-balance', config: { maxBalance: 50000 } },
          ],
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('--hook "Created"');
      expect(script).toContain('--hook "Transferred"');
      expect(script).toContain('--hook "Destroyed"');
      expect(script).not.toContain('--hook "canCreate"');
      expect(script).not.toContain('--hook "canTransfer"');
      expect(script).not.toContain('--hook "CanCreate"');
      expect(script).not.toContain('--hook "CanTransfer"');
    });

    it('should not emit removed hook wiring verification calls', () => {
      const config = createValidConfig({
        compliance: {
          modules: [
            { moduleId: 'supply-limit', config: { limit: 1000000 } },
            { moduleId: 'country-restrict', config: { restrictedCountries: ['US'] } },
          ],
        },
      });
      const script = generateDeploySh(config);
      const verifyMatches = script.match(/verify_hook_wiring/g) ?? [];

      expect(verifyMatches).toHaveLength(0);
    });

    it('should serialize time transfer limit structs with stringified i128 values', () => {
      const config = createValidConfig({
        compliance: {
          modules: [
            {
              moduleId: 'time-transfers-limits',
              config: { limitDurationLedgers: 17280, limitValue: 25000 },
            },
          ],
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain(
        `--limit '{"limit_duration": 17280, "limit_value": "25000"}' --operator "$MANAGER"`
      );
      expect(script).not.toContain(
        `--limit '{"limit_duration": 17280, "limit_value": 25000}'`
      );
    });

    it('should configure IRS-dependent modules before binding them to Compliance', () => {
      const config = createValidConfig({
        compliance: {
          modules: [{ moduleId: 'max-balance', config: { maxBalance: 50000 } }],
        },
      });
      const script = generateDeploySh(config);

      const setIrsPos = script.indexOf('set_identity_registry_storage');
      const setCompliancePos = script.indexOf('set_compliance_address');
      const addModulePos = script.indexOf('add_module_to');

      expect(setIrsPos).toBeGreaterThan(-1);
      expect(setIrsPos).toBeLessThan(setCompliancePos);
      expect(setCompliancePos).toBeLessThan(addModulePos);
    });

    it('should have correct post-deploy order: bind token → register modules → add claim topics → add trusted issuers → initial-supply guidance', () => {
      const config = createValidConfig({
        compliance: {
          modules: [{ moduleId: 'supply-limit', config: { limit: 1000000 } }],
        },
      });
      const script = generateDeploySh(config);

      const bindPos = script.indexOf('bind_token');
      const modulePos = script.indexOf('add_module_to');
      const claimTopicPos = script.indexOf('add_claim_topic');
      const issuerPos = script.indexOf('add_trusted_issuer');
      const initialSupplyNotePos = script.indexOf('Skipping automatic initial supply mint.');

      expect(bindPos).toBeLessThan(modulePos);
      expect(modulePos).toBeLessThan(claimTopicPos);
      expect(claimTopicPos).toBeLessThan(issuerPos);
      expect(issuerPos).toBeLessThan(initialSupplyNotePos);
    });

    it('should show confirmation echoes for token binding and module registration', () => {
      const config = createValidConfig({
        compliance: {
          modules: [{ moduleId: 'supply-limit', config: { limit: 1000000 } }],
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('Token bound to Compliance and IRS');
      expect(script).toContain('Supply Limit registered on hooks:');
    });

    it('should show confirmation echoes for claim topics and trusted issuers', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('Claim topic 1 (KYC)');
      expect(script).toContain('Claim topic 2 (AML)');
      expect(script).toContain('Issuer GCEXAMPL...');
    });
  });

  describe('initial supply guidance', () => {
    it('should explain why initialSupply is not auto-minted when it is defined', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          initialSupply: '1000000',
          documentManager: { enabled: false },
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('Initial Supply');
      expect(script).toContain('Skipping automatic initial supply mint.');
      expect(script).toContain('Requested: 1000000 base units (from config)');
      expect(script).toContain('Decimals:  18 (1 whole token = 10^18 base units)');
      expect(script).toContain('The mint amount must use on-chain base units, not display units.');
      expect(script).toContain('Deploy a Claim Issuer contract');
      expect(script).toContain('--amount 1000000  # base units');
      expect(script).not.toMatch(/\n\s+mint\s+--to.*--amount/);
    });

    it('should keep the same guidance when initialSupply is "0"', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          initialSupply: '0',
          documentManager: { enabled: false },
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('Skipping automatic initial supply mint.');
      expect(script).toContain('Requested: 0 base units (from config)');
    });

    it('should omit initial supply guidance when initialSupply is undefined', () => {
      const config = createValidConfig({
        token: {
          name: 'Test',
          symbol: 'TST',
          decimals: 18,
          initialSupply: undefined,
          documentManager: { enabled: false },
        },
      });
      const script = generateDeploySh(config);

      expect(script).not.toContain('Skipping automatic initial supply mint.');
      expect(script).not.toContain('Requested:');
      expect(script).not.toContain('Initial Supply');
    });
  });

  describe('network configuration', () => {
    it('should use testnet network from config', () => {
      const config = createValidConfig({
        deployment: { target: createPresetDeploymentTarget('stellar-testnet') },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('testnet');
    });

    it('should use custom network URL when provided', () => {
      const config = createValidConfig({
        deployment: {
          target: createCustomDeploymentTarget('https://custom-rpc.example.com'),
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('https://custom-rpc.example.com');
    });
  });

  describe('admin address', () => {
    it('should use single-owner address as admin', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCOWNERADDR' },
          roles: [],
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('GCOWNERADDR');
    });

    it('should use multi-sig address as admin', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'multi-sig', address: 'GCMULTISIG' },
          roles: [],
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('GCMULTISIG');
    });

    it('should use DAO address as admin', () => {
      const config = createValidConfig({
        accessControl: {
          ownership: { type: 'dao', address: 'GCDAOADDR' },
          roles: [],
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('GCDAOADDR');
    });
  });

  describe('explorer links', () => {
    it('should include stellar.expert links for testnet', () => {
      const config = createValidConfig({
        deployment: { target: createPresetDeploymentTarget('stellar-testnet') },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('https://stellar.expert/explorer/testnet/contract/${CTI_ADDRESS}');
      expect(script).toContain('https://stellar.expert/explorer/testnet/contract/${RWA_TOKEN_ADDRESS}');
    });

    it('should include stellar.expert links for mainnet using public network', () => {
      const config = createValidConfig({
        deployment: { target: createPresetDeploymentTarget('stellar-public') },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('https://stellar.expert/explorer/public/contract/${CTI_ADDRESS}');
      expect(script).toContain('https://stellar.expert/explorer/public/contract/${RWA_TOKEN_ADDRESS}');
    });

    it('should omit explorer links for custom RPC networks', () => {
      const config = createValidConfig({
        deployment: {
          target: createCustomDeploymentTarget('https://custom-rpc.example.com'),
        },
      });
      const script = generateDeploySh(config);

      expect(script).not.toContain('stellar.expert');
      expect(script).not.toContain('Explorer');
    });

    it('should include explorer links for custom RPC targets when explorerUrl is provided', () => {
      const config = createValidConfig({
        deployment: {
          target: createCustomDeploymentTarget('https://custom-rpc.example.com', {
            label: 'Partner Sandbox',
            explorerUrl: 'https://explorer.partner.example',
          }),
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('https://explorer.partner.example/contract/${CTI_ADDRESS}');
      expect(script).toContain('https://explorer.partner.example/contract/${RWA_TOKEN_ADDRESS}');
    });
  });

  describe('deployment summary', () => {
    it('should show a structured summary table with all contract addresses', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('Deployment Complete');
      expect(script).toContain('Contract                       Address');
      expect(script).toContain('Claim Topics & Issuers');
      expect(script).toContain('Identity Registry Storage');
      expect(script).toContain('Identity Verifier');
      expect(script).toContain('Compliance');
      expect(script).toContain('ACME Token');
    });

    it('should include compliance modules in the summary when selected', () => {
      const config = createValidConfig({
        compliance: {
          modules: [{ moduleId: 'supply-limit', config: { limit: 1000000 } }],
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('Supply Limit');
      expect(script).toContain('MODULE_SUPPLY_LIMIT_ADDRESS');
    });

    it('should show token name and symbol in the summary header', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('Deployment Complete — Acme Real Estate Token (ACME)');
    });

    it('should show network display name in summary', () => {
      const config = createValidConfig({
        deployment: { target: createPresetDeploymentTarget('stellar-testnet') },
      });
      const script = generateDeploySh(config);

      expect(script).toContain('Network:        Stellar Testnet');
    });

    it('should shell-escape config-derived labels in deploy output and summary', () => {
      const tokenName = 'Acme "$HOME"';
      const tokenSymbol = 'TOK`!';
      const networkLabel = 'Sandbox "$HOME"';
      const claimTopicName = 'KYC "$HOME"';
      const issuerAddress = 'GC$ISSUER"1';
      const config = createValidConfig({
        token: {
          name: tokenName,
          symbol: tokenSymbol,
        },
        identityVerification: {
          claimTopics: [{ id: 1, name: claimTopicName }],
          trustedIssuers: [{ address: issuerAddress, claimTopics: [1] }],
        },
        deployment: {
          target: createCustomDeploymentTarget('https://custom-rpc.example.com', {
            label: networkLabel,
          }),
        },
      });
      const script = generateDeploySh(config);

      expect(script).toContain(
        `Deploying ${shellEscape(tokenName)} (${shellEscape(tokenSymbol)}) — RWA Token System`
      );
      expect(script).toContain(
        `Deployment Complete — ${shellEscape(tokenName)} (${shellEscape(tokenSymbol)})`
      );
      expect(script).toContain(`Network:        ${shellEscape(networkLabel)}`);
      expect(script).toContain(`Claim topic 1 (${shellEscape(claimTopicName)})`);
      expect(script).toContain(`--trusted_issuer "${shellEscape(issuerAddress)}"`);
    });
  });

  describe('visual formatting', () => {
    it('should use section separators for major phases', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      const heavySeparatorCount = (script.match(/═{10,}/g) ?? []).length;
      const lightSeparatorCount = (script.match(/─{10,}/g) ?? []).length;

      expect(heavySeparatorCount).toBeGreaterThanOrEqual(4);
      expect(lightSeparatorCount).toBeGreaterThanOrEqual(4);
    });

    it('should use checkmarks for successful steps', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('✓');
    });

    it('should use cross marks for failure messages', () => {
      const config = createValidConfig();
      const script = generateDeploySh(config);

      expect(script).toContain('✗ Failed to deploy');
    });
  });

  describe('empty config edge cases', () => {
    it('should handle zero claim topics and zero trusted issuers', () => {
      const config = createValidConfig({
        identityVerification: {
          claimTopics: [],
          trustedIssuers: [],
        },
      });
      const script = generateDeploySh(config);

      expect(script).not.toContain('add_claim_topic');
      expect(script).not.toContain('add_trusted_issuer');
    });

    it('should handle no compliance modules', () => {
      const config = createValidConfig({
        compliance: { modules: [] },
      });
      const script = generateDeploySh(config);

      expect(script).not.toContain('add_module_to');
    });
  });
});

function extractDeploySection(script: string, variableName: string): string {
  const start = script.indexOf(`${variableName}=`);
  if (start === -1) return '';
  const end = script.indexOf('\n\n', start);
  return script.slice(start, end === -1 ? undefined : end);
}
