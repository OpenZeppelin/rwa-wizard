import type { GenerateOptions } from '@openzeppelin/codegen-core';

export type RuntimeGenerateOptions = Pick<
  GenerateOptions,
  'contractsLibraryPath' | 'allowUnderReviewModules'
>;

export interface CodegenRuntimeBootstrap {
  targets?: Record<string, Partial<RuntimeGenerateOptions> | undefined>;
}

declare const __RWA_WIZARD_CODEGEN_RUNTIME__: CodegenRuntimeBootstrap | undefined;

/**
 * Normalize optional runtime generation options from the Vite bootstrap.
 *
 * Empty strings are dropped so callers only receive meaningful overrides,
 * while explicit boolean flags are preserved.
 */
function normalizeRuntimeGenerateOptions(
  options?: Partial<RuntimeGenerateOptions>
): RuntimeGenerateOptions | undefined {
  const contractsLibraryPath = options?.contractsLibraryPath?.trim();
  const allowUnderReviewModules = options?.allowUnderReviewModules;
  const hasAllowUnderReviewModules = typeof allowUnderReviewModules === 'boolean';

  if (!contractsLibraryPath && !hasAllowUnderReviewModules) {
    return undefined;
  }

  return {
    ...(contractsLibraryPath ? { contractsLibraryPath } : {}),
    ...(hasAllowUnderReviewModules
      ? { allowUnderReviewModules: allowUnderReviewModules as boolean }
      : {}),
  };
}

/**
 * Resolve target-scoped codegen runtime options from a bootstrap payload.
 */
export function resolveCodegenRuntimeOptions(
  bootstrap: CodegenRuntimeBootstrap | undefined,
  targetId: string
): RuntimeGenerateOptions | undefined {
  if (!bootstrap?.targets) return undefined;
  return normalizeRuntimeGenerateOptions(bootstrap.targets[targetId]);
}

/**
 * Read target-scoped runtime codegen options injected at build/dev-server startup.
 */
export function getCodegenRuntimeOptions(targetId: string): RuntimeGenerateOptions | undefined {
  return resolveCodegenRuntimeOptions(__RWA_WIZARD_CODEGEN_RUNTIME__, targetId);
}
