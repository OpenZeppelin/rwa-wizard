import type { ValidationResultDTO } from './types';

const INVALID_CONFIG_PREFIX = 'Invalid configuration:';

export class CodegenInvalidConfigError extends Error {
  readonly code = 'CODEGEN_INVALID_CONFIG' as const;

  constructor(readonly errors: ValidationResultDTO['errors']) {
    super(errors.map((e) => e.message).join('; ') || 'Invalid configuration');
    this.name = 'CodegenInvalidConfigError';
  }
}

export class CodegenGenerationError extends Error {
  readonly code = 'CODEGEN_GENERATION_FAILED' as const;

  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'CodegenGenerationError';
  }
}

export class CodegenUnsupportedError extends Error {
  readonly code = 'CODEGEN_GENERATE_UNSUPPORTED' as const;

  constructor(readonly targetId: string) {
    super(`codegen package for ${targetId} does not export generate()`);
    this.name = 'CodegenUnsupportedError';
  }
}

function isTypedCodegenError(
  err: unknown
): err is CodegenInvalidConfigError | CodegenGenerationError | CodegenUnsupportedError {
  return (
    err instanceof CodegenInvalidConfigError ||
    err instanceof CodegenGenerationError ||
    err instanceof CodegenUnsupportedError
  );
}

function thrownMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Map a package throw into a typed service error. Does not attach the input
 * config (INV-21). Already-typed errors pass through (INV-8).
 */
export function toCodegenError(err: unknown): never {
  if (isTypedCodegenError(err)) {
    throw err;
  }

  // INV-8: package validate-inside-generate uses this prefix today.
  if (err instanceof Error && err.message.startsWith(INVALID_CONFIG_PREFIX)) {
    throw new CodegenInvalidConfigError([
      { field: '', code: 'INVALID_CONFIG', message: err.message },
    ]);
  }

  throw new CodegenGenerationError(thrownMessage(err) || 'Code generation failed', err);
}
