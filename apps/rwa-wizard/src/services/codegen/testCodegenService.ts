import type { CodegenInfoBlurb, ProvenanceResult } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type {
  GeneratedZipArtifact,
  StructuralComplianceModuleOption,
  StructuralGeneratedFileKind,
} from '../../types/wizard';
import { CodegenInvalidConfigError } from './errors';
import type { GenerateArtifactOptions, RwaCodegenService, ValidationResultDTO } from './types';

/** Same payload string as the dummy ZIP blob — not a real archive (INV-22). */
function dummyProjectText(config: RWAConfig, variant = ''): string {
  return `# Test RWA project for ${config.token.name}${variant}\n`;
}

export interface TestCodegenServiceOptions {
  /** When true, `generateFileTree` throws a typed invalid-config error (INV-10). */
  readonly failGenerateFileTree?: boolean;
  /**
   * Marks this service's output as its own, the way two real targets generate
   * different trees from one config. Without it two instances are byte-for-byte
   * identical, which makes any assertion about *which* service produced a tree
   * pass whether or not the code tells them apart.
   */
  readonly fileTreeVariant?: string;
  /**
   * Ranking kinds this double reports. Paths not in the map are `unknown`.
   * Do not put chain filenames here — tests inject the kinds they need.
   */
  readonly fileKinds?: Readonly<Record<string, StructuralGeneratedFileKind>>;
  /**
   * Provenance the double reports when `recordProvenance` is requested. Absent
   * = a generator without the capability (results never carry the field). A
   * function receives the config the double was asked to generate, so tests
   * can make attribution depend on the input the way a real generator's does.
   * Keys must be keys of the double's tree (`README.md` by default) or tests
   * inject `fileKinds` and extra files as they need — never chain paths. SF-5 INV-6.
   */
  readonly provenance?: ProvenanceResult | ((config: RWAConfig) => ProvenanceResult);
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

    getGeneratedFileKind: (path) => options?.fileKinds?.[path] ?? 'unknown',

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
      const blob = new Blob([dummyProjectText(config, options?.fileTreeVariant)], {
        type: 'application/zip',
      });
      onStatus?.({ phase: 'success', message: 'Done (test)' });

      return { fileName, data: blob };
    },

    async generateFileTree(config: RWAConfig, fileTreeOptions?: GenerateArtifactOptions) {
      // INV-10: opt-in typed failure; never a raw Error on this method.
      if (options?.failGenerateFileTree) {
        throw new CodegenInvalidConfigError([
          { field: '', code: 'INVALID_CONFIG', message: 'Invalid configuration: test double' },
        ]);
      }

      // INV-16: no packaging event. INV-22: README.md matches dummy ZIP payload text.
      const files = { 'README.md': dummyProjectText(config, options?.fileTreeVariant) };

      // SF-5 INV-6: the field is present iff asked AND configured, so "asked and
      // not answered" stays distinguishable from "not asked".
      const provenance = options?.provenance;
      if (fileTreeOptions?.recordProvenance !== true || provenance === undefined) {
        return { files };
      }
      return {
        files,
        provenance: typeof provenance === 'function' ? provenance(config) : provenance,
      };
    },
  };
}
