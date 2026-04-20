/**
 * Analytics provider wiring — parity with UI Builder’s integration smoke tests.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsProvider, useAnalytics } from '@openzeppelin/ui-react';
import { AnalyticsService } from '@openzeppelin/ui-utils';

vi.mock('@openzeppelin/ui-utils', () => ({
  AnalyticsService: {
    initialize: vi.fn(),
    isEnabled: vi.fn(() => true),
    trackEvent: vi.fn(),
    trackPageView: vi.fn(),
    trackNetworkSelection: vi.fn(),
    reset: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockAnalyticsService = AnalyticsService as unknown as {
  initialize: ReturnType<typeof vi.fn>;
  isEnabled: ReturnType<typeof vi.fn>;
  trackEvent: ReturnType<typeof vi.fn>;
  trackPageView: ReturnType<typeof vi.fn>;
  trackNetworkSelection: ReturnType<typeof vi.fn>;
};

function TrackProbe() {
  const { trackEvent, trackPageView } = useAnalytics();
  return (
    <div>
      <button
        type="button"
        data-testid="track-custom"
        onClick={() => trackEvent('probe', { n: 1 })}
      >
        Track
      </button>
      <button
        type="button"
        data-testid="track-page"
        onClick={() => trackPageView('Probe', '/probe')}
      >
        Page
      </button>
    </div>
  );
}

describe('Analytics integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAnalyticsService.isEnabled.mockReturnValue(true);
  });

  it('provides analytics context to child components', () => {
    render(
      <AnalyticsProvider tagId="G-TEST123" autoInit={false}>
        <TrackProbe />
      </AnalyticsProvider>
    );

    expect(screen.getByTestId('track-custom')).toBeInTheDocument();
  });

  it('routes trackEvent through AnalyticsService', () => {
    render(
      <AnalyticsProvider tagId="G-TEST123" autoInit={false}>
        <TrackProbe />
      </AnalyticsProvider>
    );

    fireEvent.click(screen.getByTestId('track-custom'));

    expect(mockAnalyticsService.trackEvent).toHaveBeenCalledWith('probe', { n: 1 });
  });

  it('routes trackPageView through AnalyticsService', () => {
    render(
      <AnalyticsProvider tagId="G-TEST123" autoInit={false}>
        <TrackProbe />
      </AnalyticsProvider>
    );

    fireEvent.click(screen.getByTestId('track-page'));

    expect(mockAnalyticsService.trackPageView).toHaveBeenCalledWith('Probe', '/probe');
  });
});
