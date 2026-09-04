import { isDeepStrictEqual } from 'node:util';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import {
  createCustomDeploymentTarget,
  createPresetDeploymentTarget,
  createValidConfig,
} from '../helpers/config';

/** Top-level `RWAConfig` key a fixture varies against the baseline. */
export type ConfigDimension = keyof RWAConfig;

export interface GoldenFixture {
  /** Stable id; becomes the golden directory name, so keep it filesystem-safe. */
  readonly name: string;
  /**
   * The one top-level dimension this fixture changes relative to the baseline.
   * `null` for the baseline itself and for the preview-filled empty draft, which
   * is a whole-config fixture mirroring the wizard rather than a single-axis variant.
   */
  readonly varies: ConfigDimension | null;
  readonly config: RWAConfig;
}

export const BASELINE_FIXTURE_NAME = 'baseline';

/**
 * Top-level dimensions on which `fixture` differs from `baseline`, in
 * `CONFIG_DIMENSIONS` order. The matrix rule ("each variant changes exactly one
 * dimension") holds iff this returns `[fixture.varies]`. Kept pure so the rule's
 * own negatives (a variant that changes nothing, or two dimensions) can be tested
 * without editing the shipped matrix.
 */
export function dimensionsDifferingFromBaseline(
  fixture: Pick<GoldenFixture, 'config'>,
  baseline: Pick<GoldenFixture, 'config'>
): ConfigDimension[] {
  return CONFIG_DIMENSIONS.filter(
    (dimension) => !isDeepStrictEqual(fixture.config[dimension], baseline.config[dimension])
  );
}
export const PREVIEW_FILLED_EMPTY_DRAFT_FIXTURE_NAME = 'preview-filled-empty-draft';

/**
 * The dimensions the Stellar templates read. The matrix test asserts every one
 * of them has at least one fixture, so adding a top-level config key without a
 * fixture fails here rather than slipping through unguarded.
 */
export const CONFIG_DIMENSIONS: readonly ConfigDimension[] = [
  'token',
  'identityVerification',
  'compliance',
  'accessControl',
  'deployment',
];

/**
 * Mirror of the wizard's empty draft after the live-preview fill:
 * `apps/rwa-wizard/src/utils/defaultRwaConfig.ts` (`createDefaultRwaConfig`)
 * with `apps/rwa-wizard/src/services/preview/placeholders.ts` sentinels
 * substituted for the missing required values. Kept literal here because the
 * codegen package cannot import from the app; if either source changes, update
 * this fixture in the same change.
 */
function createPreviewFilledEmptyDraft(): RWAConfig {
  return {
    token: {
      name: '[preview] Token name',
      symbol: '[preview]',
      decimals: 7,
      administrativeControls: { burnable: true, mintable: true, pausable: true },
      documentManager: { enabled: false },
    },
    identityVerification: {
      claimTopics: [],
      trustedIssuers: [],
      controls: {
        addressFreezing: true,
        partialTokenFreezing: true,
        recovery: true,
        forcedTransfers: true,
      },
    },
    compliance: { modules: [] },
    accessControl: {
      ownership: { type: 'single-owner', ownerAddress: '[preview] owner address' },
      roles: [],
    },
    deployment: { target: createPresetDeploymentTarget() },
  };
}

/**
 * Named fixture matrix for the golden-output guard.
 *
 * Every variant changes exactly one top-level dimension of the baseline, so a
 * golden diff points at the dimension whose rendering moved. The matrix test in
 * `golden-output.test.ts` enforces that rule structurally.
 */
export const GOLDEN_FIXTURES: readonly GoldenFixture[] = [
  { name: BASELINE_FIXTURE_NAME, varies: null, config: createValidConfig() },
  {
    name: PREVIEW_FILLED_EMPTY_DRAFT_FIXTURE_NAME,
    varies: null,
    config: createPreviewFilledEmptyDraft(),
  },

  // token
  {
    name: 'token-minimal-features',
    varies: 'token',
    config: createValidConfig({
      token: {
        name: 'Minimal Features Token',
        symbol: 'MFT',
        decimals: 0,
        initialSupply: undefined,
        administrativeControls: { burnable: false, mintable: false, pausable: false },
        documentManager: { enabled: false },
      },
    }),
  },
  {
    name: 'token-max-decimals-with-supply',
    varies: 'token',
    config: createValidConfig({
      token: { name: 'High Precision Token', symbol: 'HPT', decimals: 18, initialSupply: '1' },
    }),
  },

  // identityVerification
  {
    name: 'identity-many-topics-and-issuers',
    varies: 'identityVerification',
    config: createValidConfig({
      identityVerification: {
        claimTopics: [
          { id: 1, name: 'KYC' },
          { id: 2, name: 'AML' },
          { id: 7, name: 'Accredited Investor', isCustom: true },
        ],
        trustedIssuers: [
          { address: 'GCEXAMPLEISSUER1', claimTopics: [1, 2] },
          { address: 'GCEXAMPLEISSUER2', claimTopics: [7] },
        ],
      },
    }),
  },
  {
    name: 'identity-controls-off',
    varies: 'identityVerification',
    config: createValidConfig({
      identityVerification: {
        controls: {
          addressFreezing: false,
          partialTokenFreezing: false,
          recovery: false,
          forcedTransfers: false,
        },
      },
    }),
  },

  // compliance
  {
    name: 'compliance-all-modules',
    varies: 'compliance',
    config: createValidConfig({
      compliance: {
        modules: [
          { moduleId: 'supply-limit', config: { limit: 1_000_000 } },
          { moduleId: 'max-balance', config: { maxBalance: 50_000 } },
          { moduleId: 'country-restrict', config: { restrictedCountries: ['US'] } },
          { moduleId: 'country-allow', config: { allowedCountries: ['CH', 'SG'] } },
          { moduleId: 'transfer-allow', config: { allowedUsers: ['GCEXAMPLEOWNER'] } },
          { moduleId: 'initial-lockup-period', config: { lockupPeriodLedgers: 17_280 } },
          {
            moduleId: 'time-transfers-limits',
            config: { limitDurationLedgers: 17_280, limitValue: 25_000 },
          },
        ],
      },
    }),
  },
  {
    name: 'compliance-single-module-default-config',
    varies: 'compliance',
    config: createValidConfig({
      compliance: { modules: [{ moduleId: 'country-restrict' }] },
    }),
  },

  // accessControl
  {
    name: 'access-control-multi-sig',
    varies: 'accessControl',
    config: createValidConfig({
      accessControl: { ownership: { type: 'multi-sig', address: 'GCMULTISIG' } },
    }),
  },
  {
    name: 'access-control-dao',
    varies: 'accessControl',
    config: createValidConfig({
      accessControl: { ownership: { type: 'dao', address: 'GCDAO' } },
    }),
  },
  {
    name: 'access-control-no-roles',
    varies: 'accessControl',
    config: createValidConfig({ accessControl: { roles: [] } }),
  },
  {
    name: 'access-control-role-without-symbol',
    varies: 'accessControl',
    config: createValidConfig({
      accessControl: {
        roles: [
          { name: 'Compliance Officer', addresses: ['GCEXAMPLEOFFICER1', 'GCEXAMPLEOFFICER2'] },
        ],
      },
    }),
  },

  // deployment
  {
    name: 'deployment-preset-public',
    varies: 'deployment',
    config: createValidConfig({
      deployment: { target: createPresetDeploymentTarget('stellar-public') },
    }),
  },
  {
    name: 'deployment-custom-rpc-minimal',
    varies: 'deployment',
    config: createValidConfig({
      deployment: { target: createCustomDeploymentTarget('https://rpc.example.test') },
    }),
  },
  {
    name: 'deployment-custom-rpc-labelled-with-explorer',
    varies: 'deployment',
    config: createValidConfig({
      deployment: {
        target: createCustomDeploymentTarget('https://rpc.example.test', {
          label: 'Example Devnet',
          explorerUrl: 'https://explorer.example.test',
        }),
      },
    }),
  },
  {
    name: 'deployment-source-account',
    varies: 'deployment',
    config: createValidConfig({ deployment: { sourceAccount: 'deployer-alias' } }),
  },
];
