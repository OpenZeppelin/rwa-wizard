import { vi } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { WizardDraftStorageApi } from '../../storage/wizardDraftStorageContext';
import { createDefaultRwaConfig } from '../../utils/defaultRwaConfig';

/**
 * Build an `RWAConfig` by shallow-merging the defaults with partial overrides.
 *
 * Intended for unit tests that need a config "like the default except for
 * these tweaks" without caring about every nested field. Shallow merges at
 * the top level (same semantics as `{ ...defaults, ...overrides }`); for
 * nested overrides pass the whole nested object explicitly:
 *
 * ```ts
 * makeConfig({ token: { ...createDefaultRwaConfig().token, name: 'Foo' } });
 * ```
 */
export function makeConfig(overrides: Partial<RWAConfig> = {}): RWAConfig {
  return { ...createDefaultRwaConfig(), ...overrides };
}

/**
 * Convenience builder for the common "config with a named token" pattern
 * used by autosave tests. `symbol` defaults to an empty string so callers
 * that only care about naming do not need to invent a symbol.
 */
export function makeConfigWithTokenName(name: string, symbol = ''): RWAConfig {
  const base = createDefaultRwaConfig();
  return { ...base, token: { ...base.token, name, symbol } };
}

/**
 * Config that passes the "meaningful content" check used by the autosave
 * machine and generation preflight — i.e. has both a token name and
 * symbol. Use when a test needs the validators to accept the config as-is.
 */
export function validConfig(): RWAConfig {
  return makeConfigWithTokenName('Test Token', 'TST');
}

/**
 * Minimal `WizardDraftStorageApi` implementation whose every method is a
 * `vi.fn()` with a sensible default resolution value. Tests override
 * individual methods via `.mockImplementationOnce` / `.mockResolvedValue`
 * when they want to exercise specific branches.
 */
export function createMockStorage(): WizardDraftStorageApi {
  return {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue('new-id'),
    save: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    duplicate: vi.fn().mockResolvedValue('duplicated-id'),
    export: vi.fn().mockResolvedValue('{}'),
    import: vi.fn().mockResolvedValue([]),
  };
}
