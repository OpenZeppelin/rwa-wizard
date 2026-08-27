import { act, waitFor } from '@testing-library/react';
import { expect } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import type {
  UseCodePreviewOptions,
  UseCodePreviewResult,
} from '../../features/code-preview/hooks/useCodePreview';
import { createTestCodegenService } from '../../services/codegen';
import type { RwaCodegenService } from '../../services/codegen/types';
import type { ComplianceModuleOption } from '../../types/wizard';
import { createDefaultRwaConfig } from '../../utils/defaultRwaConfig';
import { stellarPreviewCatalog } from './previewConfig';

/** Fast debounce for hook tests — still exercises the debounce path with fake timers. */
export const PREVIEW_TEST_DEBOUNCE_MS = 0;

export function defaultPreviewHookOptions(
  overrides: Partial<UseCodePreviewOptions> = {}
): UseCodePreviewOptions {
  return {
    codegenService: createTestCodegenService(),
    draftConfig: createDefaultRwaConfig(),
    moduleCatalog: stellarPreviewCatalog() as unknown as readonly ComplianceModuleOption[],
    currentStepId: 'asset',
    includeIdentitySupport: false,
    debounceMs: PREVIEW_TEST_DEBOUNCE_MS,
    ...overrides,
  };
}

export async function waitForPreviewReady(
  getResult: () => UseCodePreviewResult,
  timeout = 5_000
): Promise<Extract<UseCodePreviewResult['phase'], { kind: 'ready' }>> {
  await waitFor(
    () => {
      expect(getResult().phase.kind).toBe('ready');
    },
    { timeout }
  );

  const phase = getResult().phase;
  if (phase.kind !== 'ready') {
    throw new Error('waitForPreviewReady: expected ready phase');
  }
  return phase;
}

export async function flushPreviewDebounce(delayMs = PREVIEW_TEST_DEBOUNCE_MS): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, Math.max(delayMs, 0));
    });
  });
}

export function draftWithTokenName(
  name: string,
  base: RWAConfig = createDefaultRwaConfig()
): RWAConfig {
  return {
    ...base,
    token: {
      ...base.token,
      name,
    },
  };
}

export function createSlowCodegenService(
  service: RwaCodegenService,
  delayMs: number
): RwaCodegenService {
  return {
    ...service,
    async generateFileTree(config, options) {
      await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      });
      return service.generateFileTree(config, options);
    },
  };
}
