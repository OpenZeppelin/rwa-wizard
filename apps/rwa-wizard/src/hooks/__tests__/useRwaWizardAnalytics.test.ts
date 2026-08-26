/**
 * Tests for useRwaWizardAnalytics — parity with Role Manager / UI Builder hook tests.
 */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  orUnknown,
  toNetworkParams,
  UNKNOWN_ANALYTICS_VALUE,
  useRwaWizardAnalytics,
} from '../useRwaWizardAnalytics';

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
      result.current.trackPageView('Wizard', '/wizard/stellar-testnet');
      expect(mockTrackPageView).toHaveBeenCalledWith('Wizard', '/wizard/stellar-testnet');
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
        network_id: 'unknown',
        ecosystem: 'unknown',
      });
    });

    it('tracks wizard_step with network context', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackWizardStep(2, 'identity', {
        networkId: 'stellar-testnet',
        ecosystem: 'stellar',
      });
      expect(mockTrackEvent).toHaveBeenCalledWith('wizard_step', {
        step_number: 2,
        step_name: 'identity',
        network_id: 'stellar-testnet',
        ecosystem: 'stellar',
      });
    });

    it('tracks target_selected', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackTargetSelected('stellar');
      expect(mockTrackEvent).toHaveBeenCalledWith('target_selected', {
        target_id: 'stellar',
        network_id: 'unknown',
        ecosystem: 'unknown',
      });
    });

    it('tracks target_selected with the destination network', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackTargetSelected('stellar', {
        networkId: 'stellar-testnet',
        ecosystem: 'stellar',
      });
      expect(mockTrackEvent).toHaveBeenCalledWith('target_selected', {
        target_id: 'stellar',
        network_id: 'stellar-testnet',
        ecosystem: 'stellar',
      });
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
        network_id: 'unknown',
        ecosystem: 'unknown',
      });
    });

    it('tracks config_exported with network context', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackConfigExported('single_draft', {
        networkId: 'stellar-testnet',
        ecosystem: 'stellar',
      });
      expect(mockTrackEvent).toHaveBeenCalledWith('config_exported', {
        export_scope: 'single_draft',
        network_id: 'stellar-testnet',
        ecosystem: 'stellar',
      });
    });

    it('tracks project_generated', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackProjectGenerated('stellar', 'project.zip', {
        networkId: 'stellar-testnet',
        ecosystem: 'stellar',
      });
      expect(mockTrackEvent).toHaveBeenCalledWith('project_generated', {
        target_id: 'stellar',
        zip_file_name: 'project.zip',
        network_id: 'stellar-testnet',
        ecosystem: 'stellar',
      });
    });

    it('tracks generation_failed with truncated snippet', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      const long = 'x'.repeat(200);
      result.current.trackGenerationFailed('stellar', long, {
        networkId: 'stellar-testnet',
        ecosystem: 'stellar',
      });
      expect(mockTrackEvent).toHaveBeenCalledWith('generation_failed', {
        target_id: 'stellar',
        error_snippet: 'x'.repeat(120),
        network_id: 'stellar-testnet',
        ecosystem: 'stellar',
      });
    });

    it('collapses whitespace in the error snippet before truncating', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackGenerationFailed('stellar', 'line one\n\n   line two');
      expect(mockTrackEvent).toHaveBeenCalledWith(
        'generation_failed',
        expect.objectContaining({ error_snippet: 'line one line two' })
      );
    });

    it('tracks wizard_cancelled', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackWizardCancelled('stellar', {
        networkId: 'stellar-testnet',
        ecosystem: 'stellar',
      });
      expect(mockTrackEvent).toHaveBeenCalledWith('wizard_cancelled', {
        target_id: 'stellar',
        network_id: 'stellar-testnet',
        ecosystem: 'stellar',
      });
    });

    it('tracks zip_download_clicked', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackZipDownloadClicked('stellar', {
        networkId: 'stellar-testnet',
        ecosystem: 'stellar',
      });
      expect(mockTrackEvent).toHaveBeenCalledWith('zip_download_clicked', {
        target_id: 'stellar',
        network_id: 'stellar-testnet',
        ecosystem: 'stellar',
      });
    });

    it('tracks address_book_opened', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackAddressBookOpened('stellar-testnet', 'stellar');
      expect(mockTrackEvent).toHaveBeenCalledWith('address_book_opened', {
        network_id: 'stellar-testnet',
        ecosystem: 'stellar',
      });
    });
  });

  describe('network context normalisation', () => {
    it.each([
      ['undefined context', undefined],
      ['null fields', { networkId: null, ecosystem: null }],
      ['empty strings', { networkId: '', ecosystem: '   ' }],
    ])('sends "unknown" for %s — never undefined or empty', (_label, context) => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackWizardCancelled('stellar', context);
      expect(mockTrackEvent).toHaveBeenCalledWith('wizard_cancelled', {
        target_id: 'stellar',
        network_id: 'unknown',
        ecosystem: 'unknown',
      });
    });

    it('normalises address_book_opened through the same helper', () => {
      const { result } = renderHook(() => useRwaWizardAnalytics());
      result.current.trackAddressBookOpened('', '');
      expect(mockTrackEvent).toHaveBeenCalledWith('address_book_opened', {
        network_id: 'unknown',
        ecosystem: 'unknown',
      });
    });

    it('toNetworkParams uses the registered GA custom dimension names', () => {
      expect(toNetworkParams({ networkId: 'stellar-testnet', ecosystem: 'stellar' })).toEqual({
        network_id: 'stellar-testnet',
        ecosystem: 'stellar',
      });
      expect(Object.keys(toNetworkParams(undefined))).toEqual(['network_id', 'ecosystem']);
    });

    it('orUnknown falls back only for blank values', () => {
      expect(orUnknown('evm')).toBe('evm');
      expect(orUnknown('')).toBe(UNKNOWN_ANALYTICS_VALUE);
      expect(orUnknown(null)).toBe(UNKNOWN_ANALYTICS_VALUE);
      expect(orUnknown(undefined)).toBe(UNKNOWN_ANALYTICS_VALUE);
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
