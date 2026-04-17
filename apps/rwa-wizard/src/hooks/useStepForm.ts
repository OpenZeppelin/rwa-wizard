import { useCallback, useEffect, useRef } from 'react';
import type { DeepPartial, DefaultValues, FieldValues, UseFormReturn } from 'react-hook-form';
import { useForm } from 'react-hook-form';

/**
 * Structural equality for wizard-step form snapshots. Handles plain objects,
 * arrays, and primitives — which is everything we persist in wizard state.
 * A generic deep-equal library would be overkill here.
 */
function shallowFieldsEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!shallowFieldsEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao);
  const bKeys = Object.keys(bo);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!shallowFieldsEqual(ao[k], bo[k])) return false;
  }
  return true;
}

/**
 * Bridges React Hook Form with the wizard's external state management.
 *
 * - Syncs external `values` into the form (e.g. when loading a different draft).
 * - Propagates user-initiated field changes back via `onUpdate`.
 * - Prevents circular updates using a ref-based guard.
 *
 * On every watched change we forward the full form snapshot as the patch.
 * This preserves sibling fields (including nested objects) when the parent
 * state is shallow-merged, whereas forwarding a sparse dot-path patch would
 * silently drop siblings of any nested object that contains the edited leaf.
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
  // Tracks the snapshot we just emitted upward so we can skip the resulting
  // round-trip `values` update without calling `form.reset` (which would blur
  // the active field and cause visible flicker on every keystroke).
  const localEchoRef = useRef<T | null>(null);

  const form = useForm<T>({
    defaultValues: values as DefaultValues<T>,
    mode: 'onChange',
  });

  useEffect(() => {
    // If the incoming `values` is the echo of our own latest emit, clear the
    // marker and skip the reset — the form already has these values.
    if (localEchoRef.current && shallowFieldsEqual(localEchoRef.current, values)) {
      localEchoRef.current = null;
      return;
    }
    localEchoRef.current = null;
    isSyncing.current = true;
    form.reset(values as DefaultValues<T>);
    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  }, [values, form]);

  const handleWatch = useCallback(
    (formValues: DeepPartial<T>, info: { name?: string; type?: string }) => {
      if (isSyncing.current || !info.name) return;
      // Forward the full form snapshot so parents can shallow-merge without
      // losing siblings of the edited field.
      const snapshot = formValues as Partial<T>;
      localEchoRef.current = snapshot as T;
      onUpdateRef.current(snapshot);
    },
    []
  );

  useEffect(() => {
    const subscription = form.watch(handleWatch);
    return () => subscription.unsubscribe();
  }, [form, handleWatch]);

  return form;
}
