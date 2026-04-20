import { useMemo } from 'react';

import { useAnalytics } from '@openzeppelin/ui-react';

/**
 * RWA Wizard analytics hook. Wraps the shared `useAnalytics` API with
 * wizard-specific custom events (same pattern as Role Manager and UI Builder).
 *
 * @see https://github.com/OpenZeppelin/openzeppelin-ui — AnalyticsProvider / AnalyticsService
 */
export function useRwaWizardAnalytics() {
  const analytics = useAnalytics();

  return useMemo(
    () => ({
      ...analytics,

      /** Wizard step navigation (aligned with UI Builder `wizard_step`). */
      trackWizardStep: (stepNumber: number, stepName: string) => {
        analytics.trackEvent('wizard_step', {
          step_number: stepNumber,
          step_name: stepName,
        });
      },

      /** User started a new asset from the sidebar for a codegen target. */
      trackTargetSelected: (targetId: string) => {
        analytics.trackEvent('target_selected', { target_id: targetId });
      },

      /** User opened an existing draft from the recent list. */
      trackDraftOpened: (source: 'sidebar_recent') => {
        analytics.trackEvent('draft_opened', { source });
      },

      /** JSON import finished successfully. */
      trackProjectsImported: (count: number) => {
        analytics.trackEvent('projects_imported', { count });
      },

      /** User exported configuration JSON (single draft or full backup). */
      trackConfigExported: (exportScope: 'single_draft' | 'all_drafts') => {
        analytics.trackEvent('config_exported', { export_scope: exportScope });
      },

      /** Codegen finished and the ZIP is ready (success dialog). */
      trackProjectGenerated: (targetId: string, zipFileName: string) => {
        analytics.trackEvent('project_generated', {
          target_id: targetId,
          zip_file_name: zipFileName,
        });
      },

      /** Codegen failed after user action (validation error, zip error, etc.). */
      trackGenerationFailed: (targetId: string, errorSnippet: string) => {
        const safe = errorSnippet.replace(/\s+/g, ' ').slice(0, 120);
        analytics.trackEvent('generation_failed', {
          target_id: targetId,
          error_snippet: safe,
        });
      },

      /** User chose Cancel on the wizard chrome (session reset). */
      trackWizardCancelled: (targetId: string) => {
        analytics.trackEvent('wizard_cancelled', { target_id: targetId });
      },

      /** User clicked Download on the success dialog. */
      trackZipDownloadClicked: (targetId: string) => {
        analytics.trackEvent('zip_download_clicked', { target_id: targetId });
      },
    }),
    [analytics]
  );
}
