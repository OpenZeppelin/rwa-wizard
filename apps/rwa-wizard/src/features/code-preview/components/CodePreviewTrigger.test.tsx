import '../code-preview.mocks';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';

import { coreCopy } from '@openzeppelin/rwa-wizard-copy';

import { CodePreviewTrigger } from './CodePreviewTrigger';

function triggerProps(expanded: boolean) {
  return {
    'aria-expanded': expanded,
    'aria-controls': expanded ? 'sheet-1' : undefined,
    onClick: vi.fn(),
    ref: createRef<HTMLButtonElement>(),
  };
}

describe('CodePreviewTrigger label follows drawer state', () => {
  it('takes the collapsed label from the copy package', () => {
    render(<CodePreviewTrigger show triggerProps={triggerProps(false)} />);
    const label = coreCopy.notice('code-preview.trigger-show').description;
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });

  it('takes the expanded label from the copy package', () => {
    render(<CodePreviewTrigger show triggerProps={triggerProps(true)} />);
    const label = coreCopy.notice('code-preview.trigger-hide').description;
    const button = screen.getByRole('button', { name: label });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', 'sheet-1');
  });

  it('attaches the hook-owned ref so focus can return to it on close', () => {
    const props = triggerProps(false);
    render(<CodePreviewTrigger show triggerProps={props} />);
    expect(props.ref.current).toBe(screen.getByRole('button'));
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
