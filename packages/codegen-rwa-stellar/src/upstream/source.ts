import type { GenerateOptions } from '@openzeppelin/codegen-core';

import { createBundledTemplateSource } from './providers/bundled';
import {
  canUseLocalCheckoutTemplateSource,
  createLocalCheckoutTemplateSource,
  isNodeRuntime,
} from './providers/local';

import type { UpstreamTemplateSource } from './types';

/**
 * Resolve the active upstream template source for a generation request.
 *
 * Browser callers fall back to the bundled snapshot to remain deterministic
 * and browser-safe. Node callers may opt into a local checkout override,
 * but must run on a runtime that supports `process.getBuiltinModule()`.
 */
export function resolveUpstreamTemplateSource(options?: GenerateOptions): UpstreamTemplateSource {
  if (options?.contractsLibraryPath) {
    if (canUseLocalCheckoutTemplateSource()) {
      return createLocalCheckoutTemplateSource(options.contractsLibraryPath);
    }

    if (isNodeRuntime()) {
      throw new Error(
        'contractsLibraryPath requires a Node.js runtime with process.getBuiltinModule() support'
      );
    }
  }

  return createBundledTemplateSource();
}
