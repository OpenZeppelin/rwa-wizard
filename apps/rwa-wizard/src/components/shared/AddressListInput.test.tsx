import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AddressingCapability } from '@openzeppelin/ui-types';

import { AddressListInput } from './AddressListInput';

const validAddr = 'C' + 'A'.repeat(55);

const mockAddressing: AddressingCapability = {
  isValidAddress: (addr: string) => addr.startsWith('C') && addr.length === 56,
};

describe('AddressListInput', () => {
  it('renders existing addresses', () => {
    render(<AddressListInput addresses={[validAddr]} onAdd={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(validAddr)).toBeInTheDocument();
  });

  it('calls onAdd when a valid address is submitted', () => {
    const onAdd = vi.fn();
    render(
      <AddressListInput
        addresses={[]}
        onAdd={onAdd}
        onRemove={vi.fn()}
        addressing={mockAddressing}
      />
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: validAddr } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith(validAddr);
  });

  it('blocks adding invalid address when addressing is provided', () => {
    const onAdd = vi.fn();
    render(
      <AddressListInput
        addresses={[]}
        onAdd={onAdd}
        onRemove={vi.fn()}
        addressing={mockAddressing}
      />
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'not-valid' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('shows validation error for invalid address', () => {
    render(
      <AddressListInput
        addresses={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        addressing={mockAddressing}
      />
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'not-valid' } });
    expect(screen.getByText(/invalid address format/i)).toBeInTheDocument();
  });

  it('shows duplicate error for already-added address', () => {
    render(
      <AddressListInput
        addresses={[validAddr]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        addressing={mockAddressing}
      />
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: validAddr } });
    expect(screen.getByText(/already added/i)).toBeInTheDocument();
  });

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = vi.fn();
    render(<AddressListInput addresses={[validAddr]} onAdd={vi.fn()} onRemove={onRemove} />);
    const removeButtons = screen.getAllByRole('button');
    const removeBtn = removeButtons.find((b) => b.textContent !== 'Add');
    removeBtn?.click();
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it('works without addressing (no validation)', () => {
    const onAdd = vi.fn();
    render(<AddressListInput addresses={[]} onAdd={onAdd} onRemove={vi.fn()} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'anything' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith('anything');
  });
});
