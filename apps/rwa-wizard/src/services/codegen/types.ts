import type { RWAConfig } from '@openzeppelin/rwa-config';

import type {
  ComplianceModuleOption,
  GeneratedZipArtifact,
  GenerationStatus,
  TargetEcosystemMetadata,
} from '../../types/wizard';

/** Normalized validation result for UI (field paths, codes, messages). */
export interface ValidationResultDTO {
  valid: boolean;
  errors: Array<{ field: string; code: string; message: string }>;
  warnings: Array<{ field: string; code: string; message: string }>;
}

/**
 * App-local codegen service boundary (contract: codegen-service-contract).
 * UI interacts only with this interface; real and mock implementations are interchangeable.
 */
export interface RwaCodegenService {
  validate(config: RWAConfig): Promise<ValidationResultDTO>;
  getAvailableModules(): Promise<ComplianceModuleOption[]>;
  getEcosystemMetadata?: () => TargetEcosystemMetadata;
  generateZip(
    config: RWAConfig,
    options?: { onStatus?: (status: GenerationStatus) => void }
  ): Promise<GeneratedZipArtifact>;
}
