import type { RWAConfig } from '@openzeppelin/rwa-config';

import type {
  ComplianceModuleOption,
  GeneratedZipArtifact,
  GenerationStatus,
} from '../../types/wizard';
import { getMockGapsForTarget } from './mockGapRegistry';
import type { RwaCodegenService, ValidationResultDTO } from './types';

/** Default mock target when using mockCodegenService (e.g. stellar when real load fails). */
const MOCK_TARGET_ID = 'stellar';

/**
 * Deterministic mock codegen service for when real @openzeppelin/codegen-rwa-stellar
 * is unavailable or for tests. Documented in mockGapRegistry.
 */
export function createMockCodegenService(targetId: string = MOCK_TARGET_ID): RwaCodegenService {
  const gaps = getMockGapsForTarget(targetId);

  return {
    async validate(_config: RWAConfig): Promise<ValidationResultDTO> {
      return { valid: true, errors: [], warnings: [] };
    },

    async getAvailableModules(): Promise<ComplianceModuleOption[]> {
      return [
        {
          id: 'supply-limit',
          name: 'Supply Limit',
          description: 'Enforces a maximum total supply for the token',
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
          description: 'Limits the maximum token balance per identity',
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
          description: 'Blocks transfers to holders from restricted countries',
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
      onStatus?.({ phase: 'validating', message: 'Validating (mock)...' });
      onStatus?.({ phase: 'generating', message: 'Generating (mock)...' });
      onStatus?.({ phase: 'packaging', message: 'Packaging (mock)...' });

      const sanitized = config.token.symbol.replace(/\W+/g, '-').toLowerCase() || 'rwa';
      const fileName = `${sanitized}-rwa.zip`;
      const content = `# Mock RWA project for ${config.token.name}\nTarget: ${targetId}\nGaps: ${gaps.map((g) => g.id).join(', ')}\n`;
      const blob = new Blob([content], { type: 'application/zip' });
      onStatus?.({ phase: 'success', message: 'Done (mock)' });

      return { fileName, data: blob };
    },
  };
}

export const mockCodegenService = createMockCodegenService();
