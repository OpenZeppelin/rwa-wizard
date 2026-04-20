/**
 * Tests for useRwaWizardAnalytics — parity with Role Manager / UI Builder hook tests.
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useRwaWizardAnalytics } from '../useRwaWizardAnalytics';

const mockTrackEvent = vi.fn();
const mockTrackPageView = vi.fn();
const mockTrackNetworkSelection = vi.fn();
const mockIsEnabled = vi.fn(() => true);
const mockInitialize = vi.fn();

const mockAnalytics = {
  trackEvent: mockTrackEvent,
  trackPageView: mockTrackPageView,
  trackNetworkSelection: mockTrackNetworkSelection,
  isEnabled: mockIsEnabled,
  initialize: mockInitialize,
  tagId: 'G-TEST123',
};

vi.mock('@openzeppelin/ui-react', () => ({
  useAnalytics: () => mockAnalytics,
}));

describe('useRwaWizardAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('base analytics passthrough', () => {
    it('passes through trackPageView', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackPageView('Wizard', '/wizard');
      expect(mockTrackPageView).toHaveBeenCalledWith('Wizard', '/wizard');
    });

    it('passes through trackNetworkSelection', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackNetworkSelection('stellar-testnet', 'stellar');
      expect(mockTrackNetworkSelection).toHaveBeenCalledWith('stellar-testnet', 'stellar');
    });

    it('passes through initialize', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.initialize('G-NEW123');
      expect(mockInitialize).toHaveBeenCalledWith('G-NEW123');
    });

    it('passes through isEnabled', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      expect(result.current.isEnabled()).toBe(true);
      expect(mockIsEnabled).toHaveBeenCalled();
    });

    it('passes through trackEvent', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackEvent('custom', { k: 'v' });
      expect(mockTrackEvent).toHaveBeenCalledWith('custom', { k: 'v' });
    });
  });

  describe('app-specific tracking', () => {
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

    it('tracks draft_opened', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackDraftOpened('sidebar_recent');
      expect(mockTrackEvent).toHaveBeenCalledWith('draft_opened', { source: 'sidebar_recent' });
    });

    it('tracks projects_imported', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackProjectsImported(3);
      expect(mockTrackEvent).toHaveBeenCalledWith('projects_imported', { count: 3 });
    });

    it('tracks config_exported', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackConfigExported('all_drafts');
      expect(mockTrackEvent).toHaveBeenCalledWith('config_exported', {
        export_scope: 'all_drafts',
      });
    });

    it('tracks project_generated', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackProjectGenerated('stellar', 'project.zip');
      expect(mockTrackEvent).toHaveBeenCalledWith('project_generated', {
        target_id: 'stellar',
        zip_file_name: 'project.zip',
      });
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

    it('tracks wizard_cancelled', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackWizardCancelled('stellar');
      expect(mockTrackEvent).toHaveBeenCalledWith('wizard_cancelled', { target_id: 'stellar' });
    });

    it('tracks zip_download_clicked', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackZipDownloadClicked('stellar');
      expect(mockTrackEvent).toHaveBeenCalledWith('zip_download_clicked', { target_id: 'stellar' });
    });
  });

  describe('memoization', () => {
    it('returns stable reference across renders', () => {
      const { result, rerender } = renderHook(() => useRwaWizardAnalytics());
      const first = result.current;
      rerender();
      expect(result.current).toBe(first);
    });
  });
});
