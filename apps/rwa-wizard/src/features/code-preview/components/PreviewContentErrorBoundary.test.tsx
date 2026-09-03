import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { type ReactElement } from 'react';

import { coreCopy } from '@openzeppelin/rwa-wizard-copy';

import { PreviewContentErrorBoundary } from './PreviewContentErrorBoundary';

const FALLBACK_MESSAGE = coreCopy.notice('code-preview.render-failed').description;

function ThrowingChild(): ReactElement {
  throw new Error('preview pane render failure');
}

function HealthyChild(): ReactElement {
  return <p>Healthy preview content</p>;
}

describe('PreviewContentErrorBoundary (INV-16)', () => {
  // Re-installed per test: React logs the caught error itself, and a single
  // shared spy stops recording after the first `mockRestore`.
  let errorSpy: MockInstance<typeof console.error>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('shows fallback when preview content throws and resets on resetKey change', () => {
    const { rerender } = render(
      <PreviewContentErrorBoundary resetKey="open-1" message={FALLBACK_MESSAGE}>
        <ThrowingChild />
      </PreviewContentErrorBoundary>
    );

    expect(screen.getByText(FALLBACK_MESSAGE)).toBeInTheDocument();

    rerender(
      <PreviewContentErrorBoundary resetKey="open-2" message={FALLBACK_MESSAGE}>
        <HealthyChild />
      </PreviewContentErrorBoundary>
    );

    expect(screen.getByText('Healthy preview content')).toBeInTheDocument();
    expect(screen.queryByText(FALLBACK_MESSAGE)).not.toBeInTheDocument();
  });

  it('keeps sibling wizard chrome mounted when preview content throws', () => {
    render(
      <div>
        <input data-testid="wizard-field" defaultValue="draft value" />
        <PreviewContentErrorBoundary resetKey="session" message={FALLBACK_MESSAGE}>
          <ThrowingChild />
        </PreviewContentErrorBoundary>
      </div>
    );

    const field = screen.getByTestId('wizard-field');
    expect(field).toBeInTheDocument();
    expect(screen.getByText(FALLBACK_MESSAGE)).toBeInTheDocument();

    act(() => {
      field.focus();
      field.setAttribute('value', 'updated');
    });

    expect(document.activeElement).toBe(field);
  });

  it('reports the failure through the shared logger, not a bare console call', () => {
    render(
      <PreviewContentErrorBoundary resetKey="logged" message={FALLBACK_MESSAGE}>
        <ThrowingChild />
      </PreviewContentErrorBoundary>
    );

    const loggedByUs = errorSpy.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].startsWith('[ERROR][CODE_PREVIEW]')
    );
    expect(loggedByUs.length, '§III: source logging goes through ui-utils logger').toBe(1);
  });
});
