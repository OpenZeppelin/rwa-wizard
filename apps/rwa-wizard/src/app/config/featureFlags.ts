import { appConfigService } from '@openzeppelin/ui-utils';

/**
 * Wizard-specific feature flags backed by AppConfigService.
 * Flag values map to keys in the shared config (viteEnv / JSON / localStorage).
 */
export const FEATURE_FLAGS = {
  DEPLOYMENT_STEP: 'rwa_wizard_deployment_step',
} as const;

type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  const flagName = FEATURE_FLAGS[key];
  if (!flagName) return false;
  return appConfigService.isFeatureEnabled(flagName);
}
