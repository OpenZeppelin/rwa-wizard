import { isFeatureEnabled } from '../../../app/config/featureFlags';

/**
 * Deployment placeholder step hidden behind the shared feature-flag system.
 * Only visible when DEPLOYMENT_STEP flag is explicitly enabled.
 */
export function DeploymentPlaceholder() {
  if (!isFeatureEnabled('DEPLOYMENT_STEP')) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Deployment</h2>
      <p className="text-sm text-muted-foreground">
        Deployment configuration will be available in a future release. This placeholder is visible
        because the deployment feature flag is enabled.
      </p>
    </div>
  );
}
