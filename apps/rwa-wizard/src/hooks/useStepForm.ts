import { useCallback, useEffect, useRef } from 'react';
import type { DeepPartial, DefaultValues, FieldValues, UseFormReturn } from 'react-hook-form';
import { useForm } from 'react-hook-form';

import { getNestedValue, setNestedValue } from '../utils/nestedPath';

/**
 * Bridges React Hook Form with the wizard's external state management.
 *
 * - Syncs external `values` into the form (e.g. when loading a different draft).
 * - Propagates user-initiated field changes back via `onUpdate`.
 * - Prevents circular updates using a ref-based guard.
 *
 * Returns the full `UseFormReturn` so step components can pass `control`
 * to shared Field components and access `formState` for validation.
 */
export function useStepForm<T extends FieldValues>(
  values: T,
  onUpdate: (patch: Partial<T>) => void
): UseFormReturn<T> {
  const isSyncing = useRef(false);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const form = useForm<T>({
    defaultValues: values as DefaultValues<T>,
    mode: 'onChange',
  });

  useEffect(() => {
    isSyncing.current = true;
    form.reset(values as DefaultValues<T>);
    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  }, [values, form]);

  const handleWatch = useCallback(
    (formValues: DeepPartial<T>, info: { name?: string; type?: string }) => {
      if (isSyncing.current || !info.name) return;
      const value = getNestedValue(formValues as Record<string, unknown>, info.name);
      const patch = setNestedValue<T>(info.name, value);
      onUpdateRef.current(patch);
    },
    []
  );

  useEffect(() => {
    const subscription = form.watch(handleWatch);
    return () => subscription.unsubscribe();
  }, [form, handleWatch]);

  return form;
}
