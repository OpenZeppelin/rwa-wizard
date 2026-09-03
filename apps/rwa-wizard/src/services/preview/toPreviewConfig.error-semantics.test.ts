import { describe, expect, it } from 'vitest';

import { STELLAR_VALIDATION_CONSTANTS, validate } from '@openzeppelin/codegen-rwa-stellar';

import { completeDraft, supplyLimitCatalog } from '../../test/helpers/previewConfig';
import { createDefaultRwaConfig } from '../../utils/defaultRwaConfig';
import { toPreviewConfig } from './index';

describe('toPreviewConfig error semantics (INV-9, INV-10)', () => {
  it('does not throw on empty catalog, unknown module, missing config, whitespace, or complete drafts (INV-9)', () => {
    const cases: Array<{ name: string; run: () => void }> = [
      {
        name: 'empty catalog',
        run: () => toPreviewConfig(createDefaultRwaConfig(), []),
      },
      {
        name: 'unknown module id',
        run: () => {
          const draft = createDefaultRwaConfig();
          draft.compliance.modules = [{ moduleId: 'nope', config: {} }];
          toPreviewConfig(draft, supplyLimitCatalog);
        },
      },
      {
        name: 'missing selection.config',
        run: () => {
          const draft = createDefaultRwaConfig();
          draft.compliance.modules = [{ moduleId: 'supply-limit' }];
          toPreviewConfig(draft, supplyLimitCatalog);
        },
      },
      {
        name: 'whitespace token fields',
        run: () => {
          const draft = createDefaultRwaConfig();
          draft.token.name = ' ';
          draft.token.symbol = ' ';
          toPreviewConfig(draft, []);
        },
      },
      {
        name: 'already-complete config',
        run: () => toPreviewConfig(completeDraft(), supplyLimitCatalog),
      },
    ];

    for (const testCase of cases) {
      expect(
        testCase.run,
        `INV-9: toPreviewConfig must not throw for ${testCase.name}; callers must not use try/catch as the generate error path`
      ).not.toThrow();
    }
  });

  it('leaves a too-long token name for generate to reject as MAX_LENGTH_EXCEEDED (INV-10)', () => {
    const tooLong = 'A'.repeat(STELLAR_VALIDATION_CONSTANTS.TOKEN_NAME_MAX_LENGTH + 1);
    const draft = completeDraft({
      token: { ...completeDraft().token, name: tooLong, symbol: 'ACM' },
    });
    const result = toPreviewConfig(draft, []);
    expect(
      result.config.token.name,
      'INV-10: present-invalid name must not be truncated or replaced'
    ).toBe(tooLong);
    expect(result.substitutedKeys).not.toContain('token.name');

    const errors = validate(result.config).errors.filter((error) => error.field === 'token.name');
    expect(
      errors.some((error) => error.code === 'MAX_LENGTH_EXCEEDED'),
      'INV-10: validate must still report MAX_LENGTH_EXCEEDED so ZIP download and preview disagree for the same reason'
    ).toBe(true);
  });

  it('leaves an empty operator role name so validate still reports REQUIRED_FIELD (INV-10)', () => {
    const draft = completeDraft();
    draft.accessControl.roles = [{ name: '', addresses: [] }];
    const result = toPreviewConfig(draft, []);
    expect(result.config.accessControl.roles[0]?.name).toBe('');
    expect(result.substitutedKeys.some((key) => key.includes('roles'))).toBe(false);

    const errors = validate(result.config).errors;
    expect(
      errors.some(
        (error) => error.field === 'accessControl.roles[0].name' && error.code === 'REQUIRED_FIELD'
      ),
      'INV-10: empty role names are out of allowlist; generate must still see REQUIRED_FIELD'
    ).toBe(true);
  });

  it('does not repair control characters in a present token name (INV-10)', () => {
    const dirty = 'Acme\u0001Token';
    const draft = completeDraft({
      token: { ...completeDraft().token, name: dirty, symbol: 'ACM' },
    });
    const result = toPreviewConfig(draft, []);
    expect(result.config.token.name).toBe(dirty);
    const errors = validate(result.config).errors;
    expect(errors.some((error) => error.code === 'INVALID_CONTROL_CHARACTERS')).toBe(true);
  });
});
