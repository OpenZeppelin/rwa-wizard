/**
 * Tests for TrackedRoute — parity with Role Manager’s route analytics tests.
 */
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';

import { TrackedRoute } from '../TrackedRoute';

const mockTrackPageView = vi.fn();

vi.mock('../../../hooks/useRwaWizardAnalytics', () => ({
  useRwaWizardAnalytics: () => ({
    trackPageView: mockTrackPageView,
  }),
}));

function NavigationTrigger({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)} data-testid="navigate">
      Navigate to {to}
    </button>
  );
}

describe('TrackedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders children correctly', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <TrackedRoute name="Test Page">
            <div data-testid="child-content">Child Content</div>
          </TrackedRoute>
        </MemoryRouter>
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.getByText('Child Content')).toBeInTheDocument();
    });

    it('renders multiple children', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <TrackedRoute name="Test Page">
            <div data-testid="child-1">First</div>
            <div data-testid="child-2">Second</div>
          </TrackedRoute>
        </MemoryRouter>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });
  });

  describe('page view tracking', () => {
    it('tracks page view on initial render', () => {
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <TrackedRoute name="Dashboard">
            <div>Dashboard Content</div>
          </TrackedRoute>
        </MemoryRouter>
      );

      expect(mockTrackPageView).toHaveBeenCalledTimes(1);
      expect(mockTrackPageView).toHaveBeenCalledWith('Dashboard', '/dashboard');
    });

    it('tracks page view with correct path', () => {
      render(
        <MemoryRouter initialEntries={['/wizard']}>
          <TrackedRoute name="Wizard">
            <div>Wizard Content</div>
          </TrackedRoute>
        </MemoryRouter>
      );

      expect(mockTrackPageView).toHaveBeenCalledWith('Wizard', '/wizard');
    });

    it('tracks page view when location changes', async () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route
              path="/"
              element={
                <TrackedRoute name="Dashboard">
                  <div>Dashboard</div>
                  <NavigationTrigger to="/wizard" />
                </TrackedRoute>
              }
            />
            <Route
              path="/wizard"
              element={
                <TrackedRoute name="Wizard">
                  <div>Wizard</div>
                </TrackedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      expect(mockTrackPageView).toHaveBeenCalledWith('Dashboard', '/');

      await act(async () => {
        screen.getByTestId('navigate').click();
      });

      await vi.waitFor(() => {
        expect(mockTrackPageView).toHaveBeenCalledWith('Wizard', '/wizard');
      });
    });

    it('does not re-track when other props change', () => {
      const { rerender: rerenderComponent } = render(
        <MemoryRouter initialEntries={['/test']}>
          <TrackedRoute name="Test Page">
            <div>Content 1</div>
          </TrackedRoute>
        </MemoryRouter>
      );

      expect(mockTrackPageView).toHaveBeenCalledTimes(1);

      rerenderComponent(
        <MemoryRouter initialEntries={['/test']}>
          <TrackedRoute name="Test Page">
            <div>Content 2</div>
          </TrackedRoute>
        </MemoryRouter>
      );

      expect(mockTrackPageView).toHaveBeenCalledTimes(1);
    });

    it('re-tracks when name changes', () => {
      const { rerender } = render(
        <MemoryRouter initialEntries={['/test']}>
          <TrackedRoute name="Page A">
            <div>Content</div>
          </TrackedRoute>
        </MemoryRouter>
      );

      expect(mockTrackPageView).toHaveBeenCalledWith('Page A', '/test');

      rerender(
        <MemoryRouter initialEntries={['/test']}>
          <TrackedRoute name="Page B">
            <div>Content</div>
          </TrackedRoute>
        </MemoryRouter>
      );

      expect(mockTrackPageView).toHaveBeenCalledWith('Page B', '/test');
      expect(mockTrackPageView).toHaveBeenCalledTimes(2);
    });
  });
});
