import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AddressingCapability } from '@openzeppelin/ui-types';

import { AddressListInput } from './AddressListInput';

const validAddr = 'C' + 'A'.repeat(55);

const mockAddressing: AddressingCapability = {
  isValidAddress: (addr: string) => addr.startsWith('C') && addr.length === 56,
};

describe('AddressListInput', () => {
  it('renders existing addresses', () => {
    const { container } = render(
      <AddressListInput addresses={[validAddr]} onAdd={vi.fn()} onRemove={vi.fn()} />
    );
    const addressEl = container.querySelector('[class*="font-mono"]');
    expect(addressEl).toBeInTheDocument();
  });

  it('calls onAdd when Add button is clicked with a valid address', async () => {
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
    await act(async () => {
      fireEvent.change(input, { target: { value: validAddr } });
    });

    const addBtn = screen.getByRole('button', { name: /add/i });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith(validAddr);
    });
  });

  it('does not call onAdd for invalid address when addressing is provided', async () => {
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
    await act(async () => {
      fireEvent.change(input, { target: { value: 'not-valid' } });
    });

    const addBtn = screen.getByRole('button', { name: /add/i });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('shows duplicate hint for already-added address', async () => {
    render(
      <AddressListInput
        addresses={[validAddr]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        addressing={mockAddressing}
      />
    );
    const input = screen.getByRole('textbox');
    await act(async () => {
      fireEvent.change(input, { target: { value: validAddr } });
    });

    await waitFor(() => {
      expect(screen.getByText(/already added/i)).toBeInTheDocument();
    });
  });

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = vi.fn();
    render(<AddressListInput addresses={[validAddr]} onAdd={vi.fn()} onRemove={onRemove} />);
    const removeButtons = screen.getAllByRole('button');
    const removeBtn = removeButtons.find((b) => {
      const svg = b.querySelector('svg');
      return svg?.classList.contains('lucide-x');
    });
    removeBtn?.click();
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it('calls onAdd without addressing (no chain validation)', async () => {
    const onAdd = vi.fn();
    render(<AddressListInput addresses={[]} onAdd={onAdd} onRemove={vi.fn()} />);
    const input = screen.getByRole('textbox');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'anything' } });
    });

    const addBtn = screen.getByRole('button', { name: /add/i });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith('anything');
    });
  });
});
