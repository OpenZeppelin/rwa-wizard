import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRwaWizardAnalytics } from '../useRwaWizardAnalytics';

const mockTrackEvent = vi.fn();
const mockTrackPageView = vi.fn();
const mockTrackNetworkSelection = vi.fn();
const mockIsEnabled = vi.fn(() => true);
const mockInitialize = vi.fn();

vi.mock('@openzeppelin/ui-react', () => ({
  useAnalytics: () => ({
    trackEvent: mockTrackEvent,
    trackPageView: mockTrackPageView,
    trackNetworkSelection: mockTrackNetworkSelection,
    isEnabled: mockIsEnabled,
    initialize: mockInitialize,
    tagId: 'G-TEST123',
  }),
}));

describe('useRwaWizardAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes through trackPageView', () => {
    const { result } = renderHook(() => useRwaWizardAnalytics());
    result.current.trackPageView('Wizard', '/wizard');
    expect(mockTrackPageView).toHaveBeenCalledWith('Wizard', '/wizard');
  });

  it('tracks wizard_step', () => {
    const { result } = renderHook(() => useRwaWizardAnalytics());
    result.current.trackWizardStep(2, 'identity');
    expect(mockTrackEvent).toHaveBeenCalledWith('wizard_step', {
      step_number: 2,
      step_name: 'identity',
    });
  });

  it('tracks target_selected', () => {
    const { result } = renderHook(() => useRwaWizardAnalytics());
    result.current.trackTargetSelected('stellar');
    expect(mockTrackEvent).toHaveBeenCalledWith('target_selected', { target_id: 'stellar' });
  });

  it('tracks generation_failed with truncated snippet', () => {
    const { result } = renderHook(() => useRwaWizardAnalytics());
    const long = 'x'.repeat(200);
    result.current.trackGenerationFailed('stellar', long);
    expect(mockTrackEvent).toHaveBeenCalledWith('generation_failed', {
      target_id: 'stellar',
      error_snippet: 'x'.repeat(120),
    });
  });
});
