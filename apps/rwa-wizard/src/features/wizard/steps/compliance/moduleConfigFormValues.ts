import type { FieldValues } from 'react-hook-form';

import type { ModuleConfigFieldMeta } from '../../../../types/wizard';

/**
 * Returns true when a string[] field's raw value ends with a comma — the user is
 * mid-entry. Parent config must not be updated in that case, or `reset()` will
 * strip the comma and the field will feel "stuck".
 */
export function hasPendingStringArrayInput(
  fields: readonly ModuleConfigFieldMeta[],
  formValues: FieldValues
): boolean {
  for (const f of fields) {
    if (f.type !== 'string[]') continue;
    const v = formValues[f.key];
    if (typeof v === 'string' && /,\s*$/.test(v)) {
      return true;
    }
  }
  return false;
}

export function toFormValues(
  fields: readonly ModuleConfigFieldMeta[],
  config: Record<string, unknown>
): FieldValues {
  const values: FieldValues = {};
  for (const f of fields) {
    const raw = config[f.key];
    if (raw === undefined || raw === null) {
      values[f.key] = '';
    } else if (Array.isArray(raw)) {
      values[f.key] = raw.join(', ');
    } else {
      values[f.key] = f.type === 'number' ? raw : String(raw);
    }
  }
  return values;
}

export function fromFormValues(
  fields: readonly ModuleConfigFieldMeta[],
  formValues: FieldValues
): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = formValues[f.key];
    if (raw === undefined || raw === null || raw === '') continue;

    if (f.type === 'number') {
      const num = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isNaN(num)) config[f.key] = num;
    } else if (f.type === 'string[]') {
      let s = String(raw).trim();
      if (s === '') continue;
      // Treat a trailing comma as "finished the last segment" so "US," commits as ['US'].
      s = s.replace(/,\s*$/, '');
      if (s === '') continue;
      config[f.key] = s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
    } else {
      config[f.key] = String(raw);
    }
  }
  return config;
}
