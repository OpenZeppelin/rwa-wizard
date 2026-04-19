import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { FieldValues } from 'react-hook-form';
import { useForm } from 'react-hook-form';

import { NumberField, TextField } from '@openzeppelin/ui-components';

import type { ComplianceModuleOption } from '../../../../types/wizard';
import { fromFormValues, hasPendingStringArrayInput, toFormValues } from './moduleConfigFormValues';

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

  const { control, getValues, reset, watch } = useForm<FieldValues>({
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
      if (hasPendingStringArrayInput(configFields, formValues)) return;
      onChangeRef.current(fromFormValues(configFields, formValues));
    },
    [configFields]
  );

  const flushToParent = useCallback(() => {
    if (isSyncing.current) return;
    onChangeRef.current(fromFormValues(configFields, getValues()));
  }, [configFields, getValues]);

  useEffect(() => {
    const sub = watch(handleWatch);
    return () => sub.unsubscribe();
  }, [watch, handleWatch]);

  return (
    <div
      className="grid gap-3"
      onBlurCapture={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        flushToParent();
      }}
    >
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
