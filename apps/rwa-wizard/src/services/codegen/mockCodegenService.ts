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
          id: 'supply-cap',
          name: 'Supply Cap',
          description: 'Enforces a maximum total supply for the token',
          supportedHooks: ['canCreate'],
        },
        {
          id: 'max-balance',
          name: 'Max Balance',
          description: 'Limits the maximum token balance per wallet',
          supportedHooks: ['canTransfer', 'canCreate'],
        },
        {
          id: 'country-restrict',
          name: 'Country Restriction',
          description: 'Restricts transfers based on country jurisdiction',
          supportedHooks: ['canTransfer'],
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
