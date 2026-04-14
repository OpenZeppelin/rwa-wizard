import type { GenerateOptions } from '@openzeppelin/codegen-core';

import { createBundledTemplateSource } from './providers/bundled';
import {
  canUseLocalCheckoutTemplateSource,
  createLocalCheckoutTemplateSource,
} from './providers/local';
import type { UpstreamTemplateSource } from './types';

/**
 * Resolve the active upstream template source for a generation request.
 *
 * Node callers may opt into a local checkout override; all other environments
 * fall back to the bundled snapshot to remain deterministic and browser-safe.
 */
export function resolveUpstreamTemplateSource(options?: GenerateOptions): UpstreamTemplateSource {
  if (options?.contractsLibraryPath && canUseLocalCheckoutTemplateSource()) {
    return createLocalCheckoutTemplateSource(options.contractsLibraryPath);
  }

  return createBundledTemplateSource();
}
