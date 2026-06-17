import { describe, expect, it } from 'vitest';

import { generateReadme, type ReadmeGenerationContext } from '../../src/templates/readme';
import { createMinimalConfig, createValidConfig } from '../helpers/config';

/**
 * Extract the fenced mermaid block from generated README text.
 */
function extractMermaidBlock(readme: string): string {
  const match = readme.match(/```mermaid\n([\s\S]*?)```/);
  if (!match) throw new Error('No mermaid block found in README');
  return match[1].trim();
}

/**
 * Extract the linear chain of node labels from a mermaid flowchart TD block.
 * Returns labels in flow order.
 */
function extractNodeLabels(mermaid: string): string[] {
  const labels: string[] = [];
  const labelRegex = /\["([^"]+)"\]/g;
  let m;
  while ((m = labelRegex.exec(mermaid)) !== null) {
    const label = m[1].replace(/#quot;/g, '"');
    if (!labels.includes(label)) labels.push(label);
  }
  return labels;
}

function createReadmeContext(
  overrides: Partial<ReadmeGenerationContext['templateSourceMetadata']> = {}
): ReadmeGenerationContext {
  return {
    templateSourceMetadata: {
      strategy: 'bundled-snapshot',
      sourceRepoUrl: 'https://github.com/example/stellar-contracts.git',
      sourceCommitHash: 'abcdef1234567890',
      syncedAt: '2026-04-13T00:00:00.000Z',
      ...overrides,
    },
  };
}

describe('generateReadme', () => {
  it('renders bundled snapshot provenance for default generation', () => {
    const readme = generateReadme(createValidConfig(), createReadmeContext());

    expect(readme).toContain('### Upstream Provenance');
    expect(readme).toContain('bundled snapshot');
    expect(readme).toContain('`abcdef1`');
    expect(readme).toContain('(https://github.com/example/stellar-contracts)');
    expect(readme).toContain(
      'See `Cargo.toml` for the exact dependency source used by this project.'
    );
    expect(readme).not.toContain('local checkout');
  });

  it('renders local checkout provenance without leaking the checkout path', () => {
    const readme = generateReadme(
      createValidConfig(),
      createReadmeContext({
        strategy: 'local-checkout',
        sourceCommitHash: 'deadbeefcafebabe',
        checkoutRoot: '/tmp/stellar-contracts',
      })
    );

    expect(readme).toContain('local checkout');
    expect(readme).toContain('`deadbee`');
    expect(readme).toContain('(https://github.com/example/stellar-contracts)');
    expect(readme).toContain('local path dependencies');
    expect(readme).not.toContain('/tmp/stellar-contracts');
  });

  it('lists selected compliance modules with hooks, config, and review status', () => {
    const readme = generateReadme(
      createValidConfig({
        compliance: {
          modules: [
            { moduleId: 'supply-limit', config: { limit: 1000000 } },
            { moduleId: 'country-allow', config: { allowedCountries: ['CH', 'SG'] } },
            { moduleId: 'supply-limit', config: { limit: 1000000 } },
          ],
        },
      }),
      createReadmeContext()
    );

    expect(readme).toContain('## Selected Compliance Modules');
    expect(readme).toContain('Supply Limit (`supply-limit`)');
    expect(readme).toContain('Country Allow-list (`country-allow`)');
    expect(readme).toContain('`created`');
    expect(readme).toContain('`transferred`');
    expect(readme).toContain('`limit=1000000`');
    expect(readme).toContain('`allowedCountries=CH, SG`');
    expect(readme).toContain('Stable');
    expect(readme.match(/Supply Limit \(`supply-limit`\)/g)).toHaveLength(1);
  });

  it('omits the selected modules section when no modules are configured', () => {
    const readme = generateReadme(
      createValidConfig({
        compliance: {
          modules: [],
        },
      }),
      createReadmeContext()
    );

    expect(readme).not.toContain('## Selected Compliance Modules');
  });

  it('omits the under-review modules warning for stable upstream modules', () => {
    const readme = generateReadme(
      createValidConfig({
        compliance: {
          modules: [
            { moduleId: 'country-allow', config: { allowedCountries: ['CH'] } },
            { moduleId: 'country-allow', config: { allowedCountries: ['SG'] } },
            { moduleId: 'supply-limit', config: { limit: 1000000 } },
          ],
        },
      }),
      createReadmeContext()
    );

    expect(readme).not.toContain('## Under-Review Modules');
    expect(readme).not.toContain('See `UNDER_REVIEW_MODULES.md` for details.');
  });

  it('describes config.json as provenance instead of a runtime deployment input', () => {
    const readme = generateReadme(createValidConfig(), createReadmeContext());

    expect(readme).toContain(
      '`config.json` is an informational snapshot of the exact source config'
    );
    expect(readme).toContain('`deploy.sh` does not read it at runtime');
    expect(readme).not.toContain('Configuration values are read from `config.json`');
  });

  it('documents the required Stellar source account for deploy.sh', () => {
    const readme = generateReadme(createValidConfig(), createReadmeContext());

    expect(readme).toContain('The script resolves');
    expect(readme).toContain('`SOURCE_ACCOUNT`');
    expect(readme).toContain('`STELLAR_ACCOUNT`');
    expect(readme).toContain('export STELLAR_ACCOUNT=alice');
  });

  it('explains that initial supply is not auto-minted on Stellar', () => {
    const readme = generateReadme(createValidConfig(), createReadmeContext());

    expect(readme).toContain('does **not** auto-mint it');
    expect(readme).toContain('trusted claim issuer contract');
    expect(readme).toContain('per-holder identity contract with claims');
    expect(readme).toContain('does not scaffold those investor-specific identity contracts');
    expect(readme).toContain('expressed in on-chain base units (smallest token units)');
    expect(readme).toContain('one whole token equals `10^18` base units');
  });

  describe('Mermaid e2e script flow chart', () => {
    it('renders full chart for default config (topics + issuer + initial supply, no modules)', () => {
      const readme = generateReadme(createValidConfig(), createReadmeContext());
      const mermaid = extractMermaidBlock(readme);
      const labels = extractNodeLabels(mermaid);

      expect(readme).toContain('### End-to-end script flow');
      expect(mermaid).toContain('flowchart TD');
      expect(labels).toEqual([
        'build.sh → stellar contract build',
        'deploy.sh (Stellar Testnet)',
        'Deploy: CTI → IRS → Identity Verifier → Compliance',
        'Deploy RWA token',
        'Post-deploy: bind token on Compliance and IRS',
        'Post-deploy: add 2 claim topics on CTI',
        'Post-deploy: add trusted issuer on CTI',
        'Initial supply: manual mint guidance (stdout)',
        'Deployment summary',
      ]);
    });

    it('renders minimal chart with no optional branches', () => {
      const readme = generateReadme(
        createValidConfig({
          compliance: { modules: [] },
          identityVerification: { claimTopics: [], trustedIssuers: [] },
          token: { initialSupply: undefined },
        }),
        createReadmeContext()
      );
      const labels = extractNodeLabels(extractMermaidBlock(readme));

      expect(labels).toEqual([
        'build.sh → stellar contract build',
        'deploy.sh (Stellar Testnet)',
        'Deploy: CTI → IRS → Identity Verifier → Compliance',
        'Deploy RWA token',
        'Post-deploy: bind token on Compliance and IRS',
        'Deployment summary',
      ]);
    });

    it('uses singular label for 1 compliance module', () => {
      const readme = generateReadme(
        createValidConfig({
          compliance: {
            modules: [{ moduleId: 'supply-limit', config: { limit: 1 } }],
          },
        }),
        createReadmeContext()
      );
      const labels = extractNodeLabels(extractMermaidBlock(readme));

      expect(labels).toContain('Deploy compliance module');
      expect(labels).toContain(
        'Post-deploy: configure modules and register hooks on Compliance'
      );
      expect(labels).not.toContain(expect.stringContaining('Deploy 2'));
    });

    it('uses plural label for multiple unique compliance modules', () => {
      const readme = generateReadme(
        createValidConfig({
          compliance: {
            modules: [
              { moduleId: 'supply-limit', config: { limit: 1 } },
              { moduleId: 'country-allow', config: { allowedCountries: ['CH'] } },
            ],
          },
        }),
        createReadmeContext()
      );
      const labels = extractNodeLabels(extractMermaidBlock(readme));

      expect(labels).toContain('Deploy 2 compliance modules');
      expect(labels).toContain(
        'Post-deploy: configure modules and register hooks on Compliance'
      );
    });

    it('deduplicates modules — duplicate supply-limit counts as 1', () => {
      const readme = generateReadme(
        createValidConfig({
          compliance: {
            modules: [
              { moduleId: 'supply-limit', config: { limit: 1 } },
              { moduleId: 'supply-limit', config: { limit: 2 } },
            ],
          },
        }),
        createReadmeContext()
      );
      const labels = extractNodeLabels(extractMermaidBlock(readme));

      expect(labels).toContain('Deploy compliance module');
    });

    it('uses singular claim topic label for 1 topic', () => {
      const readme = generateReadme(
        createValidConfig({
          identityVerification: {
            claimTopics: [{ id: 1, name: 'KYC' }],
            trustedIssuers: [],
          },
          token: { initialSupply: undefined },
          compliance: { modules: [] },
        }),
        createReadmeContext()
      );
      const labels = extractNodeLabels(extractMermaidBlock(readme));

      expect(labels).toContain('Post-deploy: add claim topic on CTI');
    });

    it('uses plural claim topic label for multiple topics', () => {
      const readme = generateReadme(
        createValidConfig({
          identityVerification: {
            claimTopics: [
              { id: 1, name: 'KYC' },
              { id: 2, name: 'AML' },
              { id: 3, name: 'Accreditation' },
            ],
            trustedIssuers: [],
          },
          token: { initialSupply: undefined },
          compliance: { modules: [] },
        }),
        createReadmeContext()
      );
      const labels = extractNodeLabels(extractMermaidBlock(readme));

      expect(labels).toContain('Post-deploy: add 3 claim topics on CTI');
    });

    it('uses singular trusted issuer label for 1 issuer', () => {
      const readme = generateReadme(
        createValidConfig({
          identityVerification: {
            claimTopics: [],
            trustedIssuers: [{ address: 'GCISSUER1', claimTopics: [1] }],
          },
          token: { initialSupply: undefined },
          compliance: { modules: [] },
        }),
        createReadmeContext()
      );
      const labels = extractNodeLabels(extractMermaidBlock(readme));

      expect(labels).toContain('Post-deploy: add trusted issuer on CTI');
    });

    it('uses plural trusted issuer label for multiple issuers', () => {
      const readme = generateReadme(
        createValidConfig({
          identityVerification: {
            claimTopics: [],
            trustedIssuers: [
              { address: 'GCISSUER1', claimTopics: [1] },
              { address: 'GCISSUER2', claimTopics: [2] },
              { address: 'GCISSUER3', claimTopics: [1, 2] },
            ],
          },
          token: { initialSupply: undefined },
          compliance: { modules: [] },
        }),
        createReadmeContext()
      );
      const labels = extractNodeLabels(extractMermaidBlock(readme));

      expect(labels).toContain('Post-deploy: add 3 trusted issuers on CTI');
    });

    it('omits initial supply node when initialSupply is undefined', () => {
      const readme = generateReadme(
        createValidConfig({ token: { initialSupply: undefined } }),
        createReadmeContext()
      );
      const labels = extractNodeLabels(extractMermaidBlock(readme));

      expect(labels).not.toContain(expect.stringContaining('Initial supply'));
    });

    it('includes initial supply node when initialSupply is set', () => {
      const readme = generateReadme(
        createValidConfig({ token: { initialSupply: '500' } }),
        createReadmeContext()
      );
      const labels = extractNodeLabels(extractMermaidBlock(readme));

      expect(labels).toContain('Initial supply: manual mint guidance (stdout)');
    });

    it('renders correct flow order for full-featured config (modules + topics + issuers + supply)', () => {
      const readme = generateReadme(
        createValidConfig({
          compliance: {
            modules: [
              { moduleId: 'supply-limit', config: { limit: 1000000 } },
              { moduleId: 'country-allow', config: { allowedCountries: ['CH'] } },
              { moduleId: 'max-balance', config: { maxBalance: 50000 } },
            ],
          },
          identityVerification: {
            claimTopics: [{ id: 1, name: 'KYC' }],
            trustedIssuers: [
              { address: 'GCISSUER1', claimTopics: [1] },
              { address: 'GCISSUER2', claimTopics: [1] },
            ],
          },
          token: { initialSupply: '999' },
        }),
        createReadmeContext()
      );
      const labels = extractNodeLabels(extractMermaidBlock(readme));

      expect(labels).toEqual([
        'build.sh → stellar contract build',
        'deploy.sh (Stellar Testnet)',
        'Deploy: CTI → IRS → Identity Verifier → Compliance',
        'Deploy 3 compliance modules',
        'Deploy RWA token',
        'Post-deploy: bind token on Compliance and IRS',
        'Post-deploy: configure modules and register hooks on Compliance',
        'Post-deploy: add claim topic on CTI',
        'Post-deploy: add 2 trusted issuers on CTI',
        'Initial supply: manual mint guidance (stdout)',
        'Deployment summary',
      ]);
    });

    it('renders correct flow for createMinimalConfig (1 topic, 1 issuer, no modules, no supply)', () => {
      const readme = generateReadme(createMinimalConfig(), createReadmeContext());
      const labels = extractNodeLabels(extractMermaidBlock(readme));

      expect(labels).toEqual([
        'build.sh → stellar contract build',
        'deploy.sh (Stellar Testnet)',
        'Deploy: CTI → IRS → Identity Verifier → Compliance',
        'Deploy RWA token',
        'Post-deploy: bind token on Compliance and IRS',
        'Post-deploy: add claim topic on CTI',
        'Post-deploy: add trusted issuer on CTI',
        'Deployment summary',
      ]);
    });

    it('preserves valid mermaid syntax — all edges use -->', () => {
      const readme = generateReadme(
        createValidConfig({
          compliance: {
            modules: [{ moduleId: 'supply-limit', config: { limit: 1 } }],
          },
        }),
        createReadmeContext()
      );
      const mermaid = extractMermaidBlock(readme);
      const edgeLines = mermaid.split('\n').filter((l) => l.includes('-->'));

      expect(edgeLines.length).toBeGreaterThanOrEqual(5);
      for (const line of edgeLines) {
        expect(line).toMatch(/s\d+.*-->.*s\d+/);
      }
    });

    it('uses sequential step IDs with no gaps', () => {
      const readme = generateReadme(
        createValidConfig({
          compliance: {
            modules: [
              { moduleId: 'supply-limit', config: { limit: 1 } },
              { moduleId: 'country-allow', config: { allowedCountries: ['CH'] } },
            ],
          },
        }),
        createReadmeContext()
      );
      const mermaid = extractMermaidBlock(readme);
      const ids = [...mermaid.matchAll(/s(\d+)/g)].map((m) => Number(m[1]));
      const uniqueIds = [...new Set(ids)].sort((a, b) => a - b);

      for (let i = 0; i < uniqueIds.length; i++) {
        expect(uniqueIds[i]).toBe(i);
      }
    });

    it('includes the network name in the deploy node', () => {
      const readme = generateReadme(createValidConfig(), createReadmeContext());
      const mermaid = extractMermaidBlock(readme);

      expect(mermaid).toContain('Stellar Testnet');
      expect(mermaid).toContain('%% Network: Stellar Testnet');
    });
  });
});
