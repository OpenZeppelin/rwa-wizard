import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AddressingCapability } from '@openzeppelin/ui-types';

import { ValidatedAddressInput } from './ValidatedAddressInput';

const validStellarAddr = 'C' + 'A'.repeat(55);

const mockAddressing: AddressingCapability = {
  isValidAddress: (addr: string) => addr.startsWith('C') && addr.length === 56,
};

describe('ValidatedAddressInput', () => {
  it('renders input with label', () => {
    render(
      <ValidatedAddressInput id="test-addr" label="Owner Address" value="" onChange={vi.fn()} />
    );
    expect(screen.getByLabelText('Owner Address')).toBeInTheDocument();
  });

  it('calls onChange when value changes', () => {
    const onChange = vi.fn();
    render(<ValidatedAddressInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('shows no error before blur', () => {
    render(
      <ValidatedAddressInput value="invalid" onChange={vi.fn()} addressing={mockAddressing} />
    );
    expect(screen.queryByText(/invalid address/i)).not.toBeInTheDocument();
  });

  it('shows validation error after blur with invalid address', () => {
    render(
      <ValidatedAddressInput value="invalid" onChange={vi.fn()} addressing={mockAddressing} />
    );
    fireEvent.blur(screen.getByRole('textbox'));
    expect(screen.getByText(/invalid address format/i)).toBeInTheDocument();
  });

  it('shows no error for valid address after blur', () => {
    render(
      <ValidatedAddressInput
        value={validStellarAddr}
        onChange={vi.fn()}
        addressing={mockAddressing}
      />
    );
    fireEvent.blur(screen.getByRole('textbox'));
    expect(screen.queryByText(/invalid address/i)).not.toBeInTheDocument();
  });

  it('shows required error for empty required field after blur', () => {
    render(<ValidatedAddressInput value="" onChange={vi.fn()} required />);
    fireEvent.blur(screen.getByRole('textbox'));
    expect(screen.getByText(/required/i)).toBeInTheDocument();
  });

  it('shows helper text when no error', () => {
    render(<ValidatedAddressInput value="" onChange={vi.fn()} helperText="Enter your address" />);
    expect(screen.getByText('Enter your address')).toBeInTheDocument();
  });

  it('works without addressing (degrades to plain input)', () => {
    render(<ValidatedAddressInput value="anything" onChange={vi.fn()} />);
    fireEvent.blur(screen.getByRole('textbox'));
    expect(screen.queryByText(/invalid/i)).not.toBeInTheDocument();
  });
});
