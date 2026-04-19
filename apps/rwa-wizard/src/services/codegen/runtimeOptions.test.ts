import { describe, expect, it } from 'vitest';

import { resolveCodegenRuntimeOptions, type CodegenRuntimeBootstrap } from './runtimeOptions';

describe('resolveCodegenRuntimeOptions', () => {
  it('returns undefined when the bootstrap is missing', () => {
    expect(resolveCodegenRuntimeOptions(undefined, 'stellar')).toBeUndefined();
  });

  it('returns undefined when a target has no configured overrides', () => {
    const bootstrap: CodegenRuntimeBootstrap = {
      targets: {
        evm: {
          allowUnderReviewModules: true,
        },
      },
    };

    expect(resolveCodegenRuntimeOptions(bootstrap, 'stellar')).toBeUndefined();
  });

  it('trims empty contract library paths and keeps true review flags', () => {
    const bootstrap: CodegenRuntimeBootstrap = {
      targets: {
        stellar: {
          contractsLibraryPath: '  /tmp/stellar-contracts  ',
          allowUnderReviewModules: true,
        },
      },
    };

    expect(resolveCodegenRuntimeOptions(bootstrap, 'stellar')).toEqual({
      contractsLibraryPath: '/tmp/stellar-contracts',
      allowUnderReviewModules: true,
    });
  });

  it('preserves explicit false review flags for runtime overrides', () => {
    const bootstrap: CodegenRuntimeBootstrap = {
      targets: {
        stellar: {
          contractsLibraryPath: '   ',
          allowUnderReviewModules: false,
        },
      },
    };

    expect(resolveCodegenRuntimeOptions(bootstrap, 'stellar')).toEqual({
      allowUnderReviewModules: false,
    });
  });

  it('drops empty values so callers only receive meaningful overrides', () => {
    const bootstrap: CodegenRuntimeBootstrap = {
      targets: {
        stellar: {
          contractsLibraryPath: '   ',
        },
      },
    };

    expect(resolveCodegenRuntimeOptions(bootstrap, 'stellar')).toBeUndefined();
  });
});
