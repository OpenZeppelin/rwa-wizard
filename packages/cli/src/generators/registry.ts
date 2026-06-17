import type {
  GenerateOptions,
  GenerationResult,
  ValidationResult,
  ZipResult,
} from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

export type ModuleReviewState = 'stable' | 'under-review';

export interface ModuleReviewInfo {
  state: ModuleReviewState;
  prUrl?: string;
}

export interface ModuleConfigFieldInfo {
  key: string;
  label: string;
  type: 'number' | 'string' | 'string[]';
  required: boolean;
  placeholder?: string;
  hint?: string;
}

/**
 * Chain-agnostic metadata for a compliance module, exposed through the
 * adapter surface so the CLI never has to import chain-specific registry types.
 */
export interface ComplianceModuleInfo {
  id: string;
  name: string;
  description: string;
  /** Hooks the module is automatically registered on at deploy time. */
  requiredHooks: string[];
  review: ModuleReviewInfo;
  configFields: ModuleConfigFieldInfo[];
}

export interface NetworkOption {
  value: string;
  label: string;
  hint?: string;
}

export interface ChainHints {
  addressPlaceholder: string;
  tokenNameMaxLength: number;
  tokenSymbolMaxLength: number;
  decimalsMin: number;
  decimalsMax: number;
  roleSymbolMaxLength: number;
  networks: NetworkOption[];
  /**
   * Whether the wizard should offer a custom RPC option in addition to presets.
   * Defaults to `true` when omitted so adapters only need to opt out.
   */
  supportsCustomRpc?: boolean;
  /** Optional placeholder shown when prompting for a custom RPC URL. */
  customRpcPlaceholder?: string;
}

/** Predefined operator role offered in the interactive wizard. */
export interface OperatorRolePreset {
  id: string;
  name: string;
  /** Default on-chain symbol when the preset maps to a well-known role. */
  defaultSymbol?: string;
}

export interface GeneratorAdapter {
  readonly name: string;
  readonly chain: string;
  readonly hints: ChainHints;
  generate(config: RWAConfig, options?: GenerateOptions): GenerationResult;
  validate(config: RWAConfig, options?: GenerateOptions): ValidationResult;
  generateZip(config: RWAConfig, options?: GenerateOptions): Promise<ZipResult>;
  getAvailableModules(): ComplianceModuleInfo[];
  /** Predefined operator roles for the interactive wizard, if any. */
  getOperatorRolePresets(): OperatorRolePreset[];
  /** Optional extended generation for identity onboarding when the chain generator provides it. */
  generateWithIdentitySupport?(config: RWAConfig, options?: GenerateOptions): GenerationResult;
  generateZipWithIdentitySupport?(config: RWAConfig, options?: GenerateOptions): Promise<ZipResult>;
}

const registry = new Map<string, GeneratorAdapter>();

export function registerGenerator(adapter: GeneratorAdapter): void {
  registry.set(adapter.chain, adapter);
}

export function getGenerator(chain: string): GeneratorAdapter {
  const adapter = registry.get(chain);
  if (!adapter) {
    const available = Array.from(registry.keys()).join(', ');
    throw new Error(
      `Unknown chain "${chain}". Available chains: ${available || '(none registered)'}`
    );
  }
  return adapter;
}

export function getAvailableChains(): string[] {
  return Array.from(registry.keys());
}
