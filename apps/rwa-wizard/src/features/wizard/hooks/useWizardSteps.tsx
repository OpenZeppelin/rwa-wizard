import { useMemo } from 'react';

import type { CodegenInfoBlurb } from '@openzeppelin/codegen-core';
import type { WizardStepConfig } from '@openzeppelin/ui-components';

import { isFeatureEnabled } from '../../../app/config/featureFlags';
import type { RwaCodegenService } from '../../../services/codegen/types';
import type { TargetAdapterCapabilities } from '../../../services/runtime';
import type { TargetCapabilitySnapshot, WizardStepId } from '../../../types/wizard';
import type { WizardDraftStateApi } from '../state/useWizardDraftState';
import { AccessControlStep } from '../steps/access-control/AccessControlStep';
import { AssetStep } from '../steps/asset/AssetStep';
import { ComplianceStep } from '../steps/compliance/ComplianceStep';
import { DeploymentPlaceholder } from '../steps/deployment/DeploymentPlaceholder';
import { IdentityStep } from '../steps/identity/IdentityStep';
import { ReviewStep } from '../steps/review/ReviewStep';
import { isStepValid } from '../validation/stepValidators';

export interface UseWizardStepsOptions {
  draftState: WizardDraftStateApi;
  targetSnapshot: TargetCapabilitySnapshot | null;
  adapterCaps: TargetAdapterCapabilities | null;
  codegenService: RwaCodegenService | null;
  /** Optional first-step intro from the active target’s codegen package. */
  codegenInfoBlurb: CodegenInfoBlurb | null;
  isGenerating: boolean;
}

export interface UseWizardStepsResult {
  steps: WizardStepConfig[];
  /**
   * Ordered step ids mirroring `steps`. Derived from the rendered list so
   * feature-flag-driven inclusions (e.g. the deployment step) stay in
   * lockstep with the navigation indices.
   */
  orderedStepIds: WizardStepId[];
}

/**
 * Builds the WizardLayout step configuration + id ordering from the current
 * draft state, adapter/codegen capabilities, and generation status.
 *
 * Memoises on a deliberately narrow dependency set: depending on the whole
 * generation-flow return value would invalidate the memo on every render
 * (the hook returns a fresh object), which in turn rebuilds all step JSX on
 * every keystroke. `isGenerating` is the only generation slice that affects
 * step validity, so that is all we subscribe to.
 */
export function useWizardSteps({
  draftState,
  targetSnapshot,
  adapterCaps,
  codegenService,
  codegenInfoBlurb,
  isGenerating,
}: UseWizardStepsOptions): UseWizardStepsResult {
  const steps = useMemo<WizardStepConfig[]>(() => {
    const availableModules = targetSnapshot?.availableModules ?? [];
    const ecosystemMetadata = targetSnapshot?.ecosystemMetadata;
    const adminControlsMeta = ecosystemMetadata?.administrativeControls ?? [];
    const identityControlsMeta = ecosystemMetadata?.identityControls ?? [];
    const operatorRoles = ecosystemMetadata?.operatorRoles ?? [];
    const complianceHooks = ecosystemMetadata?.complianceHooks ?? [];
    // Use Infinity while metadata is loading so the UI never falsely reports
    // "limit reached" during the initial render; the real limit replaces
    // this as soon as the adapter capability snapshot resolves.
    const maxTrustedIssuers =
      ecosystemMetadata?.limits.maxTrustedIssuers ?? Number.POSITIVE_INFINITY;
    const documentManagerEnabled = draftState.config.token.documentManager.enabled;

    const validationCtx = {
      addressing: adapterCaps?.addressing,
      availableModules,
    };
    const validityFor = (id: WizardStepId) => isStepValid(id, draftState.config, validationCtx);
    const reviewStepCanProceed = codegenService != null && !isGenerating;

    const list: WizardStepConfig[] = [
      {
        id: 'asset',
        title: 'Asset',
        component: (
          <AssetStep
            token={draftState.config.token}
            adminControlsMeta={adminControlsMeta}
            codegenInfoBlurb={codegenInfoBlurb}
            onUpdate={draftState.updateToken}
          />
        ),
        isValid: validityFor('asset'),
      },
      {
        id: 'identity',
        title: 'Identity',
        component: (
          <IdentityStep
            identity={draftState.config.identityVerification}
            maxTrustedIssuers={maxTrustedIssuers}
            identityControlsMeta={identityControlsMeta}
            onUpdate={draftState.updateIdentity}
          />
        ),
        isValid: validityFor('identity'),
      },
      {
        id: 'compliance',
        title: 'Compliance',
        component: (
          <ComplianceStep
            compliance={draftState.config.compliance}
            availableModules={availableModules}
            complianceHooks={complianceHooks}
            onUpdate={draftState.updateCompliance}
          />
        ),
        isValid: validityFor('compliance'),
      },
      {
        id: 'access-control',
        title: 'Roles',
        component: (
          <AccessControlStep
            accessControl={draftState.config.accessControl}
            documentManagerEnabled={documentManagerEnabled}
            operatorRoles={operatorRoles}
            onUpdate={draftState.updateAccessControl}
          />
        ),
        isValid: validityFor('access-control'),
      },
      {
        id: 'review',
        title: 'Review',
        component: <ReviewStep config={draftState.config} availableModules={availableModules} />,
        isValid: validityFor('review') && reviewStepCanProceed,
      },
    ];

    if (isFeatureEnabled('DEPLOYMENT_STEP')) {
      list.splice(list.length - 1, 0, {
        id: 'deployment',
        title: 'Deployment',
        component: <DeploymentPlaceholder />,
        isValid: validityFor('deployment'),
      });
    }

    return list;
  }, [draftState, targetSnapshot, adapterCaps, codegenService, codegenInfoBlurb, isGenerating]);

  // Derive the ordered step id list from the rendered steps so step-id
  // indexing stays in lockstep with feature flags (e.g. 'deployment'). A
  // separate STEP_IDS constant used to ship here and silently omit the
  // deployment step when its flag was on, breaking navigation.
  const orderedStepIds = useMemo(() => steps.map((step) => step.id as WizardStepId), [steps]);

  return { steps, orderedStepIds };
}
