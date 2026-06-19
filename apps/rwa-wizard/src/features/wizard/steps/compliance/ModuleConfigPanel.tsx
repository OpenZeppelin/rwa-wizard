import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { FieldValues } from 'react-hook-form';
import { useForm } from 'react-hook-form';

import { AddressListField, NumberField, TextField } from '@openzeppelin/ui-components';
import type { AddressingCapability } from '@openzeppelin/ui-types';

import { useAddressListFieldCopy } from '../../../../components/shared/useAddressListFieldCopy';
import type { ComplianceModuleOption } from '../../../../types/wizard';
import { fromFormValues, hasPendingStringArrayInput, toFormValues } from './moduleConfigFormValues';

interface ModuleConfigPanelProps {
  module: ComplianceModuleOption;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  addressing?: AddressingCapability;
}

/**
 * Renders a react-hook-form–backed config panel for a single compliance module,
 * bridging the wizard's external state with `TextField` / `NumberField` from
 * the shared design system.
 */
export function ModuleConfigPanel({
  module,
  config,
  onChange,
  addressing,
}: ModuleConfigPanelProps) {
  const addressListCopy = useAddressListFieldCopy();
  const isSyncing = useRef(false);
  const onChangeRef = useRef(onChange);
  const configRef = useRef(config);
  onChangeRef.current = onChange;
  configRef.current = config;

  const scalarFields = useMemo(
    () => module.configFields.filter((field) => field.valueKind !== 'address-list'),
    [module.configFields]
  );

  const formDefaults = useMemo(() => toFormValues(scalarFields, config), [scalarFields, config]);

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

  const handleWatch = useCallback(
    (formValues: FieldValues) => {
      if (isSyncing.current) return;
      if (hasPendingStringArrayInput(scalarFields, formValues)) return;
      const scalarConfig = fromFormValues(scalarFields, formValues);
      const addressListConfig = readAddressListConfig(module.configFields, configRef.current);
      onChangeRef.current({ ...scalarConfig, ...addressListConfig });
    },
    [scalarFields, module.configFields]
  );

  const flushToParent = useCallback(() => {
    if (isSyncing.current) return;
    const scalarConfig = fromFormValues(scalarFields, getValues());
    const addressListConfig = readAddressListConfig(module.configFields, configRef.current);
    onChangeRef.current({ ...scalarConfig, ...addressListConfig });
  }, [scalarFields, getValues, module.configFields]);

  useEffect(() => {
    const sub = watch(handleWatch);
    return () => sub.unsubscribe();
  }, [watch, handleWatch]);

  const handleAddressListChange = useCallback(
    (fieldKey: string, addresses: string[]) => {
      const scalarConfig = fromFormValues(scalarFields, getValues());
      const nextConfig = {
        ...scalarConfig,
        ...readAddressListConfig(module.configFields, configRef.current),
      };
      if (addresses.length === 0) {
        delete nextConfig[fieldKey];
      } else {
        nextConfig[fieldKey] = addresses;
      }
      configRef.current = nextConfig;
      onChangeRef.current(nextConfig);
    },
    [scalarFields, getValues, module.configFields]
  );

  return (
    <div
      className="grid gap-3"
      onBlurCapture={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        flushToParent();
      }}
    >
      {module.configFields.map((field) => {
        if (field.valueKind === 'address-list') {
          const addresses = readStringArray(config[field.key]);
          return (
            <AddressListField
              key={field.key}
              label={field.label}
              placeholder={addressListCopy.placeholder}
              bulkPlaceholder={addressListCopy.bulkPlaceholder}
              formatHint={addressListCopy.formatHint}
              helperText={field.hint}
              value={addresses}
              addressing={addressing}
              onChange={(next) => handleAddressListChange(field.key, next)}
            />
          );
        }

        if (field.type === 'number') {
          return (
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
          );
        }

        return (
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
        );
      })}
    </div>
  );
}

function readStringArray(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return [];
}

function readAddressListConfig(
  fields: ComplianceModuleOption['configFields'],
  config: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.valueKind !== 'address-list') continue;
    const addresses = readStringArray(config[field.key]);
    if (addresses.length > 0) {
      result[field.key] = addresses;
    }
  }
  return result;
}
