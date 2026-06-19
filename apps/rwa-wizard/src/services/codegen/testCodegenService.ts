import type { CodegenInfoBlurb } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type {
  GeneratedZipArtifact,
  GenerationStatus,
  StructuralComplianceModuleOption,
} from '../../types/wizard';
import type { RwaCodegenService, ValidationResultDTO } from './types';

/**
 * Deterministic test-only codegen service for unit tests.
 * NOT used at runtime — if the real codegen package is unavailable,
 * generation is disabled rather than falling back to this.
 */
export function createTestCodegenService(): RwaCodegenService {
  const testBlurb: CodegenInfoBlurb = {
    title: 'Test intro',
    description: 'Test codegen blurb for unit tests.',
    links: [{ label: 'Example', href: 'https://example.com' }],
  };

  return {
    getCodegenInfoBlurb: () => testBlurb,

    async validate(_config: RWAConfig): Promise<ValidationResultDTO> {
      return { valid: true, errors: [], warnings: [] };
    },

    async getAvailableModules(): Promise<StructuralComplianceModuleOption[]> {
      return [
        {
          id: 'supply-limit',
          name: 'Supply Limit',
          category: 'supply-and-balance',
          runtimePrerequisites: [],
          requiredHooks: ['created', 'destroyed'],
          review: {
            state: 'stable',
          },
          configFields: [
            {
              key: 'limit',
              label: 'Supply Limit',
              type: 'number',
              required: true,
              placeholder: 'e.g. 1000000',
            },
          ],
        },
        {
          id: 'max-balance',
          name: 'Max Balance',
          category: 'supply-and-balance',
          runtimePrerequisites: ['identity-registry'],
          requiredHooks: ['transferred', 'created', 'destroyed'],
          review: {
            state: 'stable',
          },
          configFields: [
            {
              key: 'maxBalance',
              label: 'Max Balance',
              type: 'number',
              required: true,
              placeholder: 'e.g. 50000',
            },
          ],
        },
        {
          id: 'country-restrict',
          name: 'Country Restriction',
          category: 'jurisdiction',
          runtimePrerequisites: ['identity-registry'],
          requiredHooks: ['transferred', 'created'],
          review: {
            state: 'stable',
          },
          configFields: [],
        },
      ];
    },

    async generateZip(
      config: RWAConfig,
      options?: { onStatus?: (status: GenerationStatus) => void }
    ): Promise<GeneratedZipArtifact> {
      const onStatus = options?.onStatus;
      onStatus?.({ phase: 'validating', message: 'Validating (test)...' });
      onStatus?.({ phase: 'generating', message: 'Generating (test)...' });
      onStatus?.({ phase: 'packaging', message: 'Packaging (test)...' });

      const sanitized = config.token.symbol.replace(/\W+/g, '-').toLowerCase() || 'rwa';
      const fileName = `${sanitized}-rwa.zip`;
      const blob = new Blob([`# Test RWA project for ${config.token.name}\n`], {
        type: 'application/zip',
      });
      onStatus?.({ phase: 'success', message: 'Done (test)' });

      return { fileName, data: blob };
    },
  };
}
