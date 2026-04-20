import countriesModule from 'i18n-iso-countries';

import type {
  ComplianceModuleDescriptor,
  ComplianceModuleSelection,
  ModuleInvocation,
} from '../types';

interface CountriesApi {
  alpha2ToNumeric(code: string): string | undefined;
}

/**
 * Normalize `i18n-iso-countries` interop across Vitest, tsdown, and Node ESM.
 */
function resolveCountriesApi(module: unknown): CountriesApi {
  const candidate = module as Partial<CountriesApi> & {
    default?: Partial<CountriesApi>;
  };

  const api =
    typeof candidate.alpha2ToNumeric === 'function'
      ? (candidate as CountriesApi)
      : typeof candidate.default?.alpha2ToNumeric === 'function'
        ? (candidate.default as CountriesApi)
        : undefined;
  if (!api || typeof api.alpha2ToNumeric !== 'function') {
    throw new Error('Failed to load i18n-iso-countries alpha2ToNumeric helper');
  }

  return api;
}

const countries = resolveCountriesApi(countriesModule);

/**
 * Define one compliance module descriptor with co-located behavior.
 */
export function defineComplianceModuleDescriptor(
  descriptor: ComplianceModuleDescriptor
): ComplianceModuleDescriptor {
  return descriptor;
}

/**
 * Create one post-deploy invocation descriptor.
 */
export function createModuleInvocation(functionName: string, args: string): ModuleInvocation {
  return { functionName, args };
}

/**
 * Create the optional post-registration verification call used by modules
 * that expose `verify_hook_wiring` in their public contract ABI.
 */
export function createHookWiringVerificationInvocation(): ModuleInvocation {
  return createModuleInvocation('verify_hook_wiring', '');
}

/**
 * Read a scalar module config value as a shell-safe string.
 */
export function getOptionalScalarConfigValue(
  selection: ComplianceModuleSelection,
  key: string
): string | undefined {
  const value = selection.config?.[key];
  if (value === undefined || value === null) return undefined;

  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  throw new Error(`Unsupported config value for ${selection.moduleId}.${key}`);
}

/**
 * Read a string-array module config value from array or comma-delimited input.
 */
export function getOptionalStringArrayConfigValue(
  selection: ComplianceModuleSelection,
  key: string
): string[] | undefined {
  const value = selection.config?.[key];
  if (value === undefined || value === null) return undefined;

  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
  }

  if (typeof value === 'string') {
    const entries = value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return entries.length > 0 ? entries : undefined;
  }

  throw new Error(`Unsupported config array value for ${selection.moduleId}.${key}`);
}

/**
 * Convert ISO alpha-2 country codes into numeric ISO-3166 values.
 */
export function getOptionalNumericCountryCodes(
  selection: ComplianceModuleSelection,
  fieldName: string
): string[] {
  const values = getOptionalStringArrayConfigValue(selection, fieldName);
  if (!values || values.length === 0) return [];

  return values.map((value) => {
    const numeric = countries.alpha2ToNumeric(value.toUpperCase());
    if (!numeric) {
      throw new Error(
        `Invalid ISO alpha-2 country code for ${selection.moduleId}.${fieldName}: ${value}`
      );
    }

    return String(Number.parseInt(numeric, 10));
  });
}

/**
 * Serialize numeric values as a Stellar CLI vector literal.
 */
export function serializeNumericArray(values: readonly string[]): string {
  return `'[${values.join(', ')}]'`;
}

/**
 * Serialize a time-transfer limit struct for Stellar CLI invocation.
 */
export function serializeLimitStruct(limitTime: string, limitValue: string): string {
  // Soroban CLI expects i128 fields to be quoted JSON strings, even when
  // neighboring scalar fields like u64 remain numeric literals.
  return `'{"limit_time": ${limitTime}, "limit_value": ${JSON.stringify(limitValue)}}'`;
}
