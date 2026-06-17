import { describe, expect, it } from 'vitest';

import { createValidConfig } from './helpers/config';
import { generate, generateZip } from '../src/index';

function createTypicalConfig() {
  return createValidConfig({
    token: {
      name: 'Benchmark Real Estate Token',
      symbol: 'BENCH',
    },
    identityVerification: {
      claimTopics: [
        { id: 1, name: 'KYC' },
        { id: 2, name: 'AML' },
        { id: 3, name: 'Accredited Investor' },
      ],
      trustedIssuers: [
        { address: 'GCISSUER1EXAMPLE', claimTopics: [1, 2] },
        { address: 'GCISSUER2EXAMPLE', claimTopics: [2, 3] },
      ],
    },
    compliance: {
      modules: [
        { moduleId: 'supply-limit', config: { limit: 1000000 } },
        { moduleId: 'max-balance', config: { maxBalance: 50000 } },
      ],
    },
    accessControl: {
      ownership: { type: 'single-owner', ownerAddress: 'GCOWNEREXAMPLE' },
      roles: [
        { name: 'Manager', symbol: 'manager', addresses: ['GCMGR1'] },
        { name: 'Agent', symbol: 'agent', addresses: ['GCAGENT1', 'GCAGENT2'] },
        { name: 'Operator', symbol: 'operator', addresses: ['GCOP1'] },
      ],
    },
  });
}

/**
 * SC-001 Performance Benchmark.
 *
 * Asserts that generating a typical config (5 contracts, 2 modules, 3 roles)
 * completes in <5 seconds on Node.js >=20.x.
 */
describe('SC-001 performance benchmark', () => {
  const SC001_THRESHOLD_MS = 5000;

  it(`generate() should complete in <${SC001_THRESHOLD_MS}ms for a typical config`, () => {
    const config = createTypicalConfig();

    const start = performance.now();
    const result = generate(config, { allowUnderReviewModules: true });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(SC001_THRESHOLD_MS);
    expect(result.metadata.fileCount).toBeGreaterThan(0);

    const expectedCrates = [
      'contracts/rwa-token/src/contract.rs',
      'contracts/compliance/src/contract.rs',
      'contracts/identity-verifier/src/contract.rs',
      'contracts/claim-topics-issuers/src/contract.rs',
      'contracts/identity-registry-storage/src/contract.rs',
      'contracts/modules/compliance-supply-limit/src/contract.rs',
      'contracts/modules/compliance-max-balance/src/contract.rs',
    ];

    for (const crate of expectedCrates) {
      expect(result.files).toHaveProperty(crate);
    }
  });

  it(`generateZip() should complete in <${SC001_THRESHOLD_MS}ms for a typical config`, async () => {
    const config = createTypicalConfig();

    const start = performance.now();
    const zip = await generateZip(config, { allowUnderReviewModules: true });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(SC001_THRESHOLD_MS);
    expect(zip.data.size).toBeGreaterThan(0);
    expect(zip.fileName).toBe('bench-rwa.zip');
  });

  it('should handle 10 sequential generations within reasonable time', () => {
    const config = createTypicalConfig();
    const runs = 10;

    const start = performance.now();
    for (let i = 0; i < runs; i++) {
      generate(config, { allowUnderReviewModules: true });
    }
    const totalElapsed = performance.now() - start;
    const avgMs = totalElapsed / runs;

    expect(avgMs).toBeLessThan(SC001_THRESHOLD_MS);
  });
});
