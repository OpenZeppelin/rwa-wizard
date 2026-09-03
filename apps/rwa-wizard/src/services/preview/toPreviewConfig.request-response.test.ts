import { describe, expect, it } from 'vitest';

import { generate, validate } from '@openzeppelin/codegen-rwa-stellar';

import {
  completeDraft,
  moduleOption,
  optionalStringArrayField,
  requiredNumberField,
  stellarPreviewCatalog,
  supplyLimitCatalog,
} from '../../test/helpers/previewConfig';
import { createDefaultRwaConfig } from '../../utils/defaultRwaConfig';
import {
  PREVIEW_NUMBER_VALUE,
  PREVIEW_OWNER_ADDRESS,
  PREVIEW_STRING_ARRAY_VALUE,
  PREVIEW_STRING_VALUE,
  PREVIEW_TOKEN_NAME,
  PREVIEW_TOKEN_SYMBOL,
  toPreviewConfig,
} from './index';

function expectResultShape(result: ReturnType<typeof toPreviewConfig>, context: string): void {
  expect(result, `INV-1: ${context} must return an object`).toBeTypeOf('object');
  expect(result.config, `INV-1: ${context} must include config`).toBeDefined();
  expect(
    result.substitutedKeys,
    `INV-1: ${context} must include substitutedKeys (not undefined)`
  ).toBeDefined();
  expect(
    Array.isArray(result.substitutedKeys),
    `INV-1: substitutedKeys must be an array on ${context}`
  ).toBe(true);
}

describe('toPreviewConfig request/response (INV-1, INV-2, INV-3, INV-4, INV-5, INV-6, INV-7, INV-8)', () => {
  it('returns { config, substitutedKeys } on the fill path and the idle path (INV-1)', () => {
    const filled = toPreviewConfig(createDefaultRwaConfig(), []);
    const idle = toPreviewConfig(completeDraft(), supplyLimitCatalog);
    expectResultShape(filled, 'default draft');
    expectResultShape(idle, 'complete draft');
  });

  it('fills the default draft with the three top-level keys in walk order (INV-2, spec 1)', () => {
    const draft = createDefaultRwaConfig();
    const result = toPreviewConfig(draft, stellarPreviewCatalog());

    expect(
      result.substitutedKeys,
      'INV-2: default empty name/symbol/owner must be listed in walk order'
    ).toEqual(['token.name', 'token.symbol', 'accessControl.ownership.ownerAddress']);
    expect(result.config.token.name).toBe(PREVIEW_TOKEN_NAME);
    expect(result.config.token.symbol).toBe(PREVIEW_TOKEN_SYMBOL);
    expect(
      result.config.accessControl.ownership.type === 'single-owner' &&
        result.config.accessControl.ownership.ownerAddress
    ).toBe(PREVIEW_OWNER_ADDRESS);

    expect(
      () => generate(result.config),
      'spec 1: generate must not throw for the three default-draft holes the shim covers'
    ).not.toThrow();

    const missingRequired = validate(result.config).errors.filter(
      (error) =>
        (error.code === 'REQUIRED_FIELD' || error.code === 'REQUIRED_MODULE_CONFIG') &&
        result.substitutedKeys.includes(error.field)
    );
    expect(
      missingRequired,
      'INV-10/INV-2: allowlisted keys that were filled must not still fail as missing'
    ).toEqual([]);
  });

  it('adds required module field paths for a ticked empty supply-limit (INV-2, spec 2)', () => {
    const draft = createDefaultRwaConfig();
    draft.compliance.modules = [{ moduleId: 'supply-limit', config: {} }];
    const result = toPreviewConfig(draft, stellarPreviewCatalog());

    expect(result.substitutedKeys).toEqual([
      'token.name',
      'token.symbol',
      'accessControl.ownership.ownerAddress',
      'compliance.modules[0].config.limit',
    ]);
    expect(result.config.compliance.modules[0]?.config?.limit).toBe(PREVIEW_NUMBER_VALUE);
    expect(result.config.compliance.modules[0]?.config?.limit).not.toBe('e.g. 1000000');

    const generated = generate(result.config);
    expect(
      Object.keys(generated.files),
      'spec 2: ticked supply-limit must appear in the generated tree after fill'
    ).toContain('contracts/modules/compliance-supply-limit/src/contract.rs');
  });

  it('returns the same config reference and empty keys for a complete draft (INV-3, spec 3)', () => {
    const input = completeDraft();
    const result = toPreviewConfig(input, supplyLimitCatalog);
    expect(result.substitutedKeys, 'INV-3: complete draft substitutes nothing').toEqual([]);
    expect(result.config, 'INV-3: idle path must keep Object.is identity').toBe(input);
  });

  it('clones on fill and never mutates the draft graph (INV-4)', () => {
    const draft = createDefaultRwaConfig();
    draft.compliance.modules = [{ moduleId: 'supply-limit', config: {} }];
    const originalConfigRef = draft.compliance.modules[0]?.config;
    const result = toPreviewConfig(draft, supplyLimitCatalog);

    expect(result.config, 'INV-4: fill must not return the draft reference').not.toBe(draft);
    expect(draft.token.name, 'INV-4: draft token.name must stay empty').toBe('');
    expect(result.config.token.name).toBe(PREVIEW_TOKEN_NAME);

    const resultModuleConfig = result.config.compliance.modules[0]?.config;
    expect(
      resultModuleConfig,
      'INV-4: module config on the result must not alias the draft'
    ).not.toBe(originalConfigRef);
    if (resultModuleConfig) {
      resultModuleConfig.limit = 99;
    }
    expect(
      draft.compliance.modules[0]?.config?.limit,
      'INV-4: mutating the filled clone must not write through to the draft'
    ).toBeUndefined();
  });

  it('fills missing strings/arrays and leaves 0, NaN, and typed values alone (INV-5)', () => {
    const whitespace = createDefaultRwaConfig();
    whitespace.token.name = '  ';
    whitespace.token.symbol = '\n';
    const filledMissing = toPreviewConfig(whitespace, []);
    expect(filledMissing.config.token.name).toBe(PREVIEW_TOKEN_NAME);
    expect(filledMissing.config.token.symbol).toBe(PREVIEW_TOKEN_SYMBOL);

    const withZero = completeDraft();
    withZero.compliance.modules = [{ moduleId: 'supply-limit', config: { limit: 0 } }];
    const zeroResult = toPreviewConfig(withZero, supplyLimitCatalog);
    expect(zeroResult.config.compliance.modules[0]?.config?.limit, 'INV-5: 0 is present').toBe(0);
    expect(zeroResult.substitutedKeys).not.toContain('compliance.modules[0].config.limit');

    const withNaN = completeDraft();
    withNaN.compliance.modules = [{ moduleId: 'supply-limit', config: { limit: Number.NaN } }];
    const nanResult = toPreviewConfig(withNaN, supplyLimitCatalog);
    expect(Number.isNaN(nanResult.config.compliance.modules[0]?.config?.limit)).toBe(true);
    expect(nanResult.substitutedKeys).not.toContain('compliance.modules[0].config.limit');
  });

  it('fills only the allowlist: optional country lists, empty roles, custom RPC, and inactive owner stay empty (INV-6)', () => {
    const catalog: typeof supplyLimitCatalog = [
      moduleOption({
        id: 'country-restrict',
        category: 'jurisdiction',
        configFields: [optionalStringArrayField('restrictedCountries')],
      }),
      moduleOption({
        id: 'supply-limit',
        configFields: [requiredNumberField('limit')],
      }),
    ];

    const draft = createDefaultRwaConfig();
    draft.compliance.modules = [
      { moduleId: 'country-restrict', config: { restrictedCountries: [] } },
      { moduleId: 'supply-limit', config: {} },
    ];
    draft.accessControl.roles = [{ name: '', addresses: [] }];
    draft.deployment = {
      target: { kind: 'custom', ecosystem: 'stellar', rpcUrl: '' },
    };

    const result = toPreviewConfig(draft, catalog);
    expect(result.config.compliance.modules[0]?.config?.restrictedCountries).toEqual([]);
    expect(result.substitutedKeys).not.toContain(
      'compliance.modules[0].config.restrictedCountries'
    );
    expect(result.config.compliance.modules[1]?.config?.limit).toBe(PREVIEW_NUMBER_VALUE);
    expect(result.config.accessControl.roles[0]?.name).toBe('');
    const target = result.config.deployment.target;
    expect(target.kind === 'custom' && target.rpcUrl).toBe('');
  });

  it('fills multi-sig address, not ownerAddress (INV-6)', () => {
    const draft = createDefaultRwaConfig();
    draft.accessControl.ownership = { type: 'multi-sig', address: '' };
    const result = toPreviewConfig(draft, []);
    expect(result.substitutedKeys).toContain('accessControl.ownership.address');
    expect(result.substitutedKeys).not.toContain('accessControl.ownership.ownerAddress');
    expect(
      result.config.accessControl.ownership.type === 'multi-sig' &&
        result.config.accessControl.ownership.address
    ).toBe(PREVIEW_OWNER_ADDRESS);
  });

  it('fills dao address the same way as multi-sig (INV-6)', () => {
    const draft = createDefaultRwaConfig();
    draft.accessControl.ownership = { type: 'dao', address: '   ' };
    const result = toPreviewConfig(draft, []);
    expect(result.substitutedKeys).toEqual([
      'token.name',
      'token.symbol',
      'accessControl.ownership.address',
    ]);
  });

  it('skips unknown module ids and still fills top-level keys (INV-6, INV-8)', () => {
    const draft = createDefaultRwaConfig();
    draft.compliance.modules = [{ moduleId: 'not-a-real-module', config: { limit: undefined } }];
    const result = toPreviewConfig(draft, supplyLimitCatalog);
    expect(result.substitutedKeys).toEqual([
      'token.name',
      'token.symbol',
      'accessControl.ownership.ownerAddress',
    ]);
    expect(result.config.compliance.modules[0]?.config).toEqual({ limit: undefined });
  });

  it('creates {} on the clone when selection.config is missing, then writes required keys (INV-6)', () => {
    const draft = createDefaultRwaConfig();
    draft.compliance.modules = [{ moduleId: 'supply-limit' }];
    const result = toPreviewConfig(draft, supplyLimitCatalog);
    expect(result.config.compliance.modules[0]?.config).toEqual({ limit: PREVIEW_NUMBER_VALUE });
    expect(result.substitutedKeys).toContain('compliance.modules[0].config.limit');
    expect(
      draft.compliance.modules[0]?.config,
      'INV-4: missing config on the draft stays missing'
    ).toBeUndefined();
  });

  it('fills duplicate moduleId rows by index (INV-6)', () => {
    const draft = completeDraft();
    draft.compliance.modules = [
      { moduleId: 'supply-limit', config: {} },
      { moduleId: 'supply-limit', config: {} },
    ];
    const result = toPreviewConfig(draft, supplyLimitCatalog);
    expect(result.substitutedKeys).toEqual([
      'compliance.modules[0].config.limit',
      'compliance.modules[1].config.limit',
    ]);
  });

  it('fills reserved required string and string[] sentinels when a catalog field asks for them (INV-7)', () => {
    const catalog = [
      moduleOption({
        id: 'reserved-strings',
        configFields: [
          { key: 'note', label: 'Note', type: 'string', required: true },
          { key: 'tags', label: 'Tags', type: 'string[]', required: true },
        ],
      }),
    ];
    const draft = completeDraft();
    draft.compliance.modules = [{ moduleId: 'reserved-strings', config: {} }];
    const result = toPreviewConfig(draft, catalog);
    expect(result.config.compliance.modules[0]?.config?.note).toBe(PREVIEW_STRING_VALUE);
    expect(result.config.compliance.modules[0]?.config?.tags).toEqual(PREVIEW_STRING_ARRAY_VALUE);
    expect(result.config.compliance.modules[0]?.config?.tags).not.toBe(PREVIEW_STRING_ARRAY_VALUE);
  });

  it('still fills top-level keys when the catalog is empty (INV-8)', () => {
    const result = toPreviewConfig(createDefaultRwaConfig(), []);
    expect(result.substitutedKeys).toEqual([
      'token.name',
      'token.symbol',
      'accessControl.ownership.ownerAddress',
    ]);
  });

  it('walks time-transfers required fields in catalog order (INV-2)', () => {
    const catalog = stellarPreviewCatalog();
    const draft = completeDraft();
    draft.compliance.modules = [{ moduleId: 'time-transfers-limits', config: {} }];
    const result = toPreviewConfig(draft, catalog);
    expect(result.substitutedKeys).toEqual([
      'compliance.modules[0].config.limitDurationLedgers',
      'compliance.modules[0].config.limitValue',
    ]);
  });
});
