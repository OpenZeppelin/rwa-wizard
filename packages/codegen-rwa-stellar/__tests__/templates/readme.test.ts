import { describe, expect, it } from 'vitest';

import { createValidConfig } from '../helpers/config';
import { generateReadme, type ReadmeGenerationContext } from '../../src/templates/readme';

function createReadmeContext(
  overrides: Partial<ReadmeGenerationContext['templateSourceMetadata']> = {}
): ReadmeGenerationContext {
  return {
    templateSourceMetadata: {
      strategy: 'bundled-snapshot',
      sourceRepoUrl: 'https://github.com/OpenZeppelin/stellar-contracts',
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
    expect(readme).toContain('See `Cargo.toml` for the exact dependency source used by this project.');
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
    expect(readme).toContain('`canCreate`');
    expect(readme).toContain('`canTransfer`');
    expect(readme).toContain('`limit=1000000`');
    expect(readme).toContain('`allowedCountries=CH, SG`');
    expect(readme).toContain('Under review ([PR](');
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
});
