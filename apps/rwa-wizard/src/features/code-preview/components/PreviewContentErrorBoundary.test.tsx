import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ReactElement } from 'react';

import { PreviewContentErrorBoundary } from './PreviewContentErrorBoundary';

function ThrowingChild(): ReactElement {
  throw new Error('preview pane render failure');
}

function HealthyChild(): ReactElement {
  return <p>Healthy preview content</p>;
}

describe('PreviewContentErrorBoundary (INV-16)', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    errorSpy.mockClear();
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('shows fallback when preview content throws and resets on resetKey change', () => {
    const { rerender } = render(
      <PreviewContentErrorBoundary resetKey="open-1">
        <ThrowingChild />
      </PreviewContentErrorBoundary>
    );

    expect(screen.getByText(/Preview could not render this content/i)).toBeInTheDocument();

    rerender(
      <PreviewContentErrorBoundary resetKey="open-2">
        <HealthyChild />
      </PreviewContentErrorBoundary>
    );

    expect(screen.getByText('Healthy preview content')).toBeInTheDocument();
    expect(screen.queryByText(/Preview could not render this content/i)).not.toBeInTheDocument();
  });

  it('keeps sibling wizard chrome mounted when preview content throws', () => {
    render(
      <div>
        <input data-testid="wizard-field" defaultValue="draft value" />
        <PreviewContentErrorBoundary resetKey="session">
          <ThrowingChild />
        </PreviewContentErrorBoundary>
      </div>
    );

    const field = screen.getByTestId('wizard-field');
    expect(field).toBeInTheDocument();
    expect(screen.getByText(/Preview could not render this content/i)).toBeInTheDocument();

    act(() => {
      field.focus();
      field.setAttribute('value', 'updated');
    });

    expect(document.activeElement).toBe(field);
  });
});
