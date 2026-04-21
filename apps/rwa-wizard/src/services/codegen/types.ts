import type { CodegenInfoBlurb } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type {
  GeneratedZipArtifact,
  GenerationStatus,
  StructuralComplianceModuleOption,
  StructuralEcosystemMetadata,
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
  /**
   * Returns structural compliance-module descriptors (ids, hooks, review
   * state, config field keys). UI prose is joined in the app layer via
   * `enrichAvailableModules`.
   */
  getAvailableModules(): Promise<StructuralComplianceModuleOption[]>;
  /**
   * Returns structural ecosystem metadata (ids, names, locks, defaults,
   * operator roles, hooks, limits). User-facing copy is joined from
   * `@openzeppelin/rwa-wizard-copy` in the app layer — codegen packages
   * omit field-level prose here; optional introductory copy uses
   * `getCodegenInfoBlurb` (CLI / UI).
   */
  getEcosystemMetadata?: () => StructuralEcosystemMetadata;
  /**
   * Optional introductory blurb: title, description, and reference links from
   * the ecosystem codegen package (same data can surface in CLI output or UI).
   */
  getCodegenInfoBlurb?: () => CodegenInfoBlurb;
  generateZip(
    config: RWAConfig,
    options?: { onStatus?: (status: GenerationStatus) => void }
  ): Promise<GeneratedZipArtifact>;
}
