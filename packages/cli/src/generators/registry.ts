import type {
  GenerateOptions,
  GenerationResult,
  ValidationResult,
  ZipResult,
} from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

export interface ComplianceModuleInfo {
  id: string;
  name: string;
  description: string;
  supportedHooks: string[];
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
}

export interface GeneratorAdapter {
  readonly name: string;
  readonly chain: string;
  readonly hints: ChainHints;
  generate(config: RWAConfig, options?: GenerateOptions): GenerationResult;
  validate(config: RWAConfig, options?: GenerateOptions): ValidationResult;
  generateZip(config: RWAConfig, options?: GenerateOptions): Promise<ZipResult>;
  getAvailableModules(): ComplianceModuleInfo[];
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
