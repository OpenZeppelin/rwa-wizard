import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';

import { CodePreviewRevealProvider } from './CodePreviewRevealProvider';
import { useCodePreviewReveal } from './useCodePreviewReveal';

describe('useCodePreviewReveal (INV-12, INV-17)', () => {
  it('returns null outside a provider without throwing', () => {
    const { result } = renderHook(() => useCodePreviewReveal());
    expect(result.current).toBeNull();
  });

  it('returns null when the provider carries null', () => {
    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <CodePreviewRevealProvider revealInPreview={null}>{children}</CodePreviewRevealProvider>
    );
    const { result } = renderHook(() => useCodePreviewReveal(), { wrapper });
    expect(result.current).toBeNull();
  });

  it('returns the provided callback with the same identity across re-renders', () => {
    const reveal = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <CodePreviewRevealProvider revealInPreview={reveal}>{children}</CodePreviewRevealProvider>
    );
    const { result, rerender } = renderHook(() => useCodePreviewReveal(), { wrapper });
    const first = result.current;
    rerender();
    expect(first).toBe(reveal);
    expect(result.current).toBe(first);
  });
});
