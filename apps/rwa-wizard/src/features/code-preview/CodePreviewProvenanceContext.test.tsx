import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactElement, ReactNode } from 'react';

import { CodePreviewProvenanceProvider } from './CodePreviewProvenanceProvider';
import type { CodePreviewProvenance } from './provenanceState';
import { useCodePreviewProvenance } from './useCodePreviewProvenance';

describe('useCodePreviewProvenance (INV-20)', () => {
  it('returns null outside a provider without throwing', () => {
    const { result } = renderHook(() => useCodePreviewProvenance());
    expect(result.current).toBeNull();
  });

  it('returns null when the provider carries null', () => {
    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <CodePreviewProvenanceProvider value={null}>{children}</CodePreviewProvenanceProvider>
    );
    const { result } = renderHook(() => useCodePreviewProvenance(), { wrapper });
    expect(result.current).toBeNull();
  });

  it('returns the provided value by reference across re-renders', () => {
    const value: CodePreviewProvenance = { state: { kind: 'none' }, liveIdentity: null };
    const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
      <CodePreviewProvenanceProvider value={value}>{children}</CodePreviewProvenanceProvider>
    );
    const { result, rerender } = renderHook(() => useCodePreviewProvenance(), { wrapper });
    expect(result.current).toBe(value);
    rerender();
    expect(result.current).toBe(value);
  });
});
