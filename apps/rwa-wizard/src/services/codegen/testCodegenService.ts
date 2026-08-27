import type { CodegenInfoBlurb } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { GeneratedZipArtifact, StructuralComplianceModuleOption } from '../../types/wizard';
import { CodegenInvalidConfigError } from './errors';
import type { GenerateArtifactOptions, RwaCodegenService, ValidationResultDTO } from './types';

/** Same payload string as the dummy ZIP blob — not a real archive (INV-22). */
function dummyProjectText(config: RWAConfig): string {
  return `# Test RWA project for ${config.token.name}\n`;
}

export interface TestCodegenServiceOptions {
  /** When true, `generateFileTree` throws a typed invalid-config error (INV-10). */
  readonly failGenerateFileTree?: boolean;
}

/**
 * Deterministic test-only codegen service for unit tests.
 * NOT used at runtime — if the real codegen package is unavailable,
 * generation is disabled rather than falling back to this.
 */
export function createTestCodegenService(options?: TestCodegenServiceOptions): RwaCodegenService {
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
      zipOptions?: GenerateArtifactOptions
    ): Promise<GeneratedZipArtifact> {
      const onStatus = zipOptions?.onStatus;
      onStatus?.({ phase: 'validating', message: 'Validating (test)...' });
      onStatus?.({ phase: 'generating', message: 'Generating (test)...' });
      onStatus?.({ phase: 'packaging', message: 'Packaging (test)...' });

      const sanitized = config.token.symbol.replace(/\W+/g, '-').toLowerCase() || 'rwa';
      const fileName = `${sanitized}-rwa.zip`;
      const blob = new Blob([dummyProjectText(config)], {
        type: 'application/zip',
      });
      onStatus?.({ phase: 'success', message: 'Done (test)' });

      return { fileName, data: blob };
    },

    async generateFileTree(config: RWAConfig, _fileTreeOptions?: GenerateArtifactOptions) {
      // INV-10: opt-in typed failure; never a raw Error on this method.
      if (options?.failGenerateFileTree) {
        throw new CodegenInvalidConfigError([
          { field: '', code: 'INVALID_CONFIG', message: 'Invalid configuration: test double' },
        ]);
      }

      // INV-16: no packaging event. INV-22: README.md matches dummy ZIP payload text.
      return { files: { 'README.md': dummyProjectText(config) } };
    },
  };
}
