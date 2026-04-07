import { useCallback, useMemo, useState } from 'react';

import { Input, Label } from '@openzeppelin/ui-components';
import type { AddressingCapability } from '@openzeppelin/ui-types';
import { cn } from '@openzeppelin/ui-utils';

interface ValidatedAddressInputProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  addressing?: AddressingCapability;
  placeholder?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Address input with optional chain-aware validation via AddressingCapability.
 *
 * When `addressing` is provided, validates on blur and shows inline feedback.
 * Falls back to a plain text input when no capability is available.
 */
export function ValidatedAddressInput({
  id,
  label,
  value,
  onChange,
  addressing,
  placeholder,
  helperText,
  disabled,
  required,
}: ValidatedAddressInputProps) {
  const [touched, setTouched] = useState(false);

  const validationError = useMemo(() => {
    if (!touched) return undefined;
    if (required && !value.trim()) return 'This field is required';
    if (addressing && value.trim() && !addressing.isValidAddress(value.trim())) {
      return 'Invalid address format for the selected chain';
    }
    return undefined;
  }, [touched, required, value, addressing]);

  const handleBlur = useCallback(() => setTouched(true), []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    [onChange]
  );

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
      )}
      <Input
        id={id}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(validationError && 'border-destructive focus-visible:ring-destructive')}
      />
      {validationError && <p className="text-xs text-destructive">{validationError}</p>}
      {!validationError && helperText && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
