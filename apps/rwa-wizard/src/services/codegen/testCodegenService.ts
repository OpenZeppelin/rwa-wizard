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
  return {
    async validate(_config: RWAConfig): Promise<ValidationResultDTO> {
      return { valid: true, errors: [], warnings: [] };
    },

    async getAvailableModules(): Promise<StructuralComplianceModuleOption[]> {
      return [
        {
          id: 'supply-limit',
          name: 'Supply Limit',
          requiredHooks: ['canCreate', 'created', 'destroyed'],
          review: {
            state: 'under-review',
            prUrl: 'https://github.com/OpenZeppelin/stellar-contracts/pull/650',
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
          requiredHooks: ['canTransfer', 'canCreate', 'transferred', 'created', 'destroyed'],
          review: {
            state: 'under-review',
            prUrl: 'https://github.com/OpenZeppelin/stellar-contracts/pull/650',
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
          requiredHooks: ['canTransfer'],
          review: {
            state: 'under-review',
            prUrl: 'https://github.com/OpenZeppelin/stellar-contracts/pull/651',
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
