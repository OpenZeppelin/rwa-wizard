import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { FieldValues } from 'react-hook-form';
import { useForm } from 'react-hook-form';

import { NumberField, TextField } from '@openzeppelin/ui-components';

import type { ComplianceModuleOption, ModuleConfigFieldMeta } from '../../../types/wizard';

interface ModuleConfigPanelProps {
  module: ComplianceModuleOption;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

/**
 * Renders a react-hook-form–backed config panel for a single compliance module,
 * bridging the wizard's external state with `TextField` / `NumberField` from
 * the shared design system.
 */
export function ModuleConfigPanel({ module, config, onChange }: ModuleConfigPanelProps) {
  const isSyncing = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const formDefaults = useMemo(
    () => toFormValues(module.configFields, config),
    [module.configFields, config]
  );

  const { control, reset, watch } = useForm<FieldValues>({
    defaultValues: formDefaults,
    mode: 'onChange',
  });

  useEffect(() => {
    isSyncing.current = true;
    reset(formDefaults);
    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  }, [formDefaults, reset]);

  const configFields = module.configFields;

  const handleWatch = useCallback(
    (formValues: FieldValues) => {
      if (isSyncing.current) return;
      onChangeRef.current(fromFormValues(configFields, formValues));
    },
    [configFields]
  );

  useEffect(() => {
    const sub = watch(handleWatch);
    return () => sub.unsubscribe();
  }, [watch, handleWatch]);

  return (
    <div className="grid gap-3">
      {configFields.map((field) =>
        field.type === 'number' ? (
          <NumberField
            key={field.key}
            id={`${module.id}-${field.key}`}
            name={field.key}
            label={field.label}
            placeholder={field.placeholder}
            helperText={field.hint}
            control={control}
            validation={field.required ? { required: true } : undefined}
          />
        ) : (
          <TextField
            key={field.key}
            id={`${module.id}-${field.key}`}
            name={field.key}
            label={field.label}
            placeholder={field.placeholder}
            helperText={field.hint}
            control={control}
            validation={field.required ? { required: true } : undefined}
          />
        )
      )}
    </div>
  );
}

function toFormValues(
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

function fromFormValues(
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
      config[f.key] = String(raw)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      config[f.key] = String(raw);
    }
  }
  return config;
}
