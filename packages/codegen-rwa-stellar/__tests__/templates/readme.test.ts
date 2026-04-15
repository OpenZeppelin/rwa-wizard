import { describe, expect, it } from 'vitest';

import { generateReadme, type ReadmeGenerationContext } from '../../src/templates/readme';
import { createValidConfig } from '../helpers/config';

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

  it('renders the under-review modules warning with unique entries', () => {
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

    expect(readme).toContain('## Under-Review Modules');
    expect(readme).toContain('**Country Allow-list** (`country-allow`)');
    expect(readme.match(/\*\*Country Allow-list\*\* \(`country-allow`\)/g)).toHaveLength(1);
    expect(readme).toContain('See `UNDER_REVIEW_MODULES.md` for details.');
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
});
