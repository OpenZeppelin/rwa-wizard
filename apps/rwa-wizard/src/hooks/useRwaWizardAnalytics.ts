import { useMemo } from 'react';

import { useAnalytics } from '@openzeppelin/ui-react';

// =============================================================================
// Network context
// =============================================================================

/**
 * Fallback for every string dimension whose value cannot be resolved.
 *
 * GA4 ignores empty parameter values and `undefined` silently drops the
 * dimension, so events always carry `'unknown'` instead; the analytics team
 * filters those rows out. Same convention as Role Manager and UI Builder.
 */
export const UNKNOWN_ANALYTICS_VALUE = 'unknown';

export function orUnknown(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : UNKNOWN_ANALYTICS_VALUE;
}

/**
 * Network dimensions attached to wizard action events. Both fields are
 * optional at the call site (e.g. an export fired from a non-wizard route)
 * and normalised to `'unknown'` when missing.
 */
export interface AnalyticsNetworkContext {
  /** Adapter `NetworkConfig.id` (e.g. `stellar-testnet`). */
  networkId?: string | null;
  /** Ecosystem id (e.g. `stellar`, `evm`). */
  ecosystem?: string | null;
}

/**
 * Convert a network context into GA event parameters.
 *
 * `network_id` and `ecosystem` are registered as GA custom dimensions — do
 * not rename them.
 */
export function toNetworkParams(
  network: AnalyticsNetworkContext | undefined
): Record<string, string> {
  return {
    network_id: orUnknown(network?.networkId),
    ecosystem: orUnknown(network?.ecosystem),
  };
}

// =============================================================================
// Hook
// =============================================================================

/**
 * RWA Wizard analytics hook. Wraps the shared `useAnalytics` API with
 * wizard-specific custom events (same pattern as Role Manager and UI Builder).
 *
 * Every wizard-flow event carries `network_id` + `ecosystem` via an
 * {@link AnalyticsNetworkContext}, typically built with
 * `useAnalyticsNetworkContext` / `useAnalyticsNetworkResolver` from the active
 * `/wizard/:networkId` route.
 *
 * Privacy: never pass account addresses or free-form user text to these
 * trackers. `error_snippet` is whitespace-collapsed and truncated to 120 chars.
 *
 * @see https://github.com/OpenZeppelin/openzeppelin-ui — AnalyticsProvider / AnalyticsService
 */
export function useRwaWizardAnalytics() {
  const analytics = useAnalytics();

  return useMemo(
    () => ({
      ...analytics,

      /**
       * Wizard step navigation (aligned with UI Builder `wizard_step`).
       * @param network - Network the wizard is currently editing for
       */
      trackWizardStep: (
        stepNumber: number,
        stepName: string,
        network?: AnalyticsNetworkContext
      ) => {
        analytics.trackEvent('wizard_step', {
          step_number: stepNumber,
          step_name: stepName,
          ...toNetworkParams(network),
        });
      },

      /**
       * User started a new asset from the sidebar for a codegen target.
       * @param network - Network the new wizard session opens on
       */
      trackTargetSelected: (targetId: string, network?: AnalyticsNetworkContext) => {
        analytics.trackEvent('target_selected', {
          target_id: targetId,
          ...toNetworkParams(network),
        });
      },

      /** User opened an existing draft from the recent list. */
      trackDraftOpened: (source: 'sidebar_recent') => {
        analytics.trackEvent('draft_opened', { source });
      },

      /** JSON import finished successfully. */
      trackProjectsImported: (count: number) => {
        analytics.trackEvent('projects_imported', { count });
      },

      /**
       * User exported configuration JSON (single draft or full backup).
       * @param network - Active wizard network (`'unknown'` outside the wizard route)
       */
      trackConfigExported: (
        exportScope: 'single_draft' | 'all_drafts',
        network?: AnalyticsNetworkContext
      ) => {
        analytics.trackEvent('config_exported', {
          export_scope: exportScope,
          ...toNetworkParams(network),
        });
      },

      /** Codegen finished and the ZIP is ready (success dialog). */
      trackProjectGenerated: (
        targetId: string,
        zipFileName: string,
        network?: AnalyticsNetworkContext
      ) => {
        analytics.trackEvent('project_generated', {
          target_id: targetId,
          zip_file_name: zipFileName,
          ...toNetworkParams(network),
        });
      },

      /** Codegen failed after user action (validation error, zip error, etc.). */
      trackGenerationFailed: (
        targetId: string,
        errorSnippet: string,
        network?: AnalyticsNetworkContext
      ) => {
        const safe = errorSnippet.replace(/\s+/g, ' ').slice(0, 120);
        analytics.trackEvent('generation_failed', {
          target_id: targetId,
          error_snippet: safe,
          ...toNetworkParams(network),
        });
      },

      /** User chose Cancel on the wizard chrome (session reset). */
      trackWizardCancelled: (targetId: string, network?: AnalyticsNetworkContext) => {
        analytics.trackEvent('wizard_cancelled', {
          target_id: targetId,
          ...toNetworkParams(network),
        });
      },

      /** User clicked Download on the success dialog. */
      trackZipDownloadClicked: (targetId: string, network?: AnalyticsNetworkContext) => {
        analytics.trackEvent('zip_download_clicked', {
          target_id: targetId,
          ...toNetworkParams(network),
        });
      },

      /**
       * Fires once when the address book dialog opens (false → true), not on network changes while open.
       * @param networkId - Active network id, or `'unknown'`
       * @param ecosystem - Active ecosystem id, or `'unknown'`
       */
      trackAddressBookOpened: (networkId: string, ecosystem: string) => {
        analytics.trackEvent('address_book_opened', toNetworkParams({ networkId, ecosystem }));
      },
    }),
    [analytics]
  );
}
