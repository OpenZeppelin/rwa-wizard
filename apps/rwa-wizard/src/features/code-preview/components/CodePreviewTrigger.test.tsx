import '../code-preview.mocks';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CodePreviewTrigger } from './CodePreviewTrigger';

function triggerProps(expanded: boolean) {
  return {
    'aria-expanded': expanded,
    'aria-controls': expanded ? 'sheet-1' : undefined,
    onClick: vi.fn(),
  };
}

describe('CodePreviewTrigger label follows drawer state', () => {
  it('reads "View generated code" while collapsed', () => {
    render(<CodePreviewTrigger show triggerProps={triggerProps(false)} />);
    expect(screen.getByRole('button', { name: /view generated code/i })).toBeInTheDocument();
  });

  it('reads "Hide generated code" while expanded', () => {
    render(<CodePreviewTrigger show triggerProps={triggerProps(true)} />);
    const button = screen.getByRole('button', { name: /hide generated code/i });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', 'sheet-1');
  });

  it('honours custom labels for both states', () => {
    const { rerender } = render(
      <CodePreviewTrigger
        show
        label="Show code"
        expandedLabel="Close code"
        triggerProps={triggerProps(false)}
      />
    );
    expect(screen.getByRole('button', { name: 'Show code' })).toBeInTheDocument();
    rerender(
      <CodePreviewTrigger
        show
        label="Show code"
        expandedLabel="Close code"
        triggerProps={triggerProps(true)}
      />
    );
    expect(screen.getByRole('button', { name: 'Close code' })).toBeInTheDocument();
  });

  it('renders nothing when show is false (INV-4)', () => {
    const { container } = render(
      <CodePreviewTrigger show={false} triggerProps={triggerProps(true)} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
