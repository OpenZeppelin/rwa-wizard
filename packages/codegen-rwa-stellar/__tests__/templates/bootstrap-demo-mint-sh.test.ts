import { describe, expect, it } from 'vitest';

import { isDemoAutoMintEligible } from '../../src/templates/demo-auto-mint';
import {
  generateBootstrapDemoMintSh,
  shouldGenerateBootstrapDemoMintScript,
} from '../../src/templates/scripts/bootstrap-demo-mint-sh';
import { generateDeploySh } from '../../src/templates/scripts/deploy-sh';
import { createPresetDeploymentTarget, createValidConfig } from '../helpers/config';

describe('bootstrap-demo-mint.sh template', () => {
  it('is eligible only for testnet exports with configured initial supply', () => {
    expect(isDemoAutoMintEligible(createValidConfig())).toBe(true);
    expect(
      isDemoAutoMintEligible(
        createValidConfig({
          token: { initialSupply: undefined },
        })
      )
    ).toBe(false);
    expect(
      isDemoAutoMintEligible(
        createValidConfig({
          deployment: { target: createPresetDeploymentTarget('stellar-public') },
        })
      )
    ).toBe(false);
  });

  it('generates a testnet-only educational bootstrap script', () => {
    const config = createValidConfig({
      token: { initialSupply: '1000' },
      identityVerification: {
        claimTopics: [
          { id: 1, name: 'KYC' },
          { id: 2, name: 'AML' },
        ],
      },
      compliance: {
        modules: [
          { moduleId: 'supply-limit', config: { limit: '100' } },
          { moduleId: 'max-balance', config: { maxBalance: '50' } },
        ],
      },
    });
    const script = generateBootstrapDemoMintSh(config);

    expect(script).toMatch(/^#!/);
    expect(script).toContain('TESTNET ONLY');
    expect(script).toContain('deployment-manifest.json');
    expect(script).toContain('DEMO_SIGNING_SECRET_HEX');
    expect(script).toContain('tools/sign-claim/Cargo.toml');
    expect(script).toContain('CLAIM_ISSUER_ADDRESS=$(');
    expect(script).toContain('IDENTITY_ADDRESS=$(');
    expect(script).toContain('for DEMO_TOPIC in 1 2; do');
    expect(script).toContain('add_identity_country_data');
    expect(script).toContain('--amount "$INITIAL_SUPPLY"');
    expect(script).toContain('verify_compliance_for_demo_mint');
    expect(script).toContain('--preflight');
    expect(script).toContain('get_supply_limit');
    expect(script).not.toContain('--apply-manager-fixes');
    expect(script).toContain('Run this Manager invoke manually');
    expect(script).toContain('grep -qi testnet');
    const managerLoad = script.indexOf('MANAGER="$(load_manifest_field manager)"');
    const managerVerify = script.indexOf('verify_role_signer "Manager"');
    expect(managerLoad).toBeGreaterThan(-1);
    expect(managerVerify).toBeGreaterThan(managerLoad);
    expect(script).toContain("awk '/--data/{print $2}'");
    expect(script).toContain("awk '/--signature/{print $2}'");
    expect(script).not.toContain("grep -oE '--data");
    expect(script).toContain('\\`created\\`');
    expect(script).not.toMatch(/echo "[^"]*`created`[^"]*"/);
  });

  it('shouldGenerateBootstrapDemoMintScript requires identity support flag', () => {
    const config = createValidConfig();
    expect(shouldGenerateBootstrapDemoMintScript(config, true)).toBe(true);
    expect(shouldGenerateBootstrapDemoMintScript(config, false)).toBe(false);
  });

  it('deploy.sh points to bootstrap script when demo auto-mint is included', () => {
    const config = createValidConfig({ token: { initialSupply: '500' } });
    const script = generateDeploySh(config, {
      includeIdentitySupport: true,
      includeDemoAutoMint: true,
    });

    expect(script).toContain('Initial Supply — Demo Auto-Mint Script Included');
    expect(script).toContain('scripts/bootstrap-demo-mint.sh');
    expect(script).not.toContain('Manual Mint Required');
    expect(script).toContain('\\`created\\`');
    expect(script).not.toMatch(/echo "[^"]*`created`[^"]*"/);
  });
});
