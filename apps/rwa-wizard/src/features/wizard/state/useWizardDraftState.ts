import { useCallback, useState } from 'react';

import type {
  AccessControlConfig,
  ComplianceConfig,
  DeploymentConfig,
  IdentityVerificationConfig,
  RWAConfig,
  TokenConfig,
} from '@openzeppelin/rwa-config';

import { createDefaultRwaConfig } from '../../../utils/defaultRwaConfig';

export interface WizardDraftStateApi {
  config: RWAConfig;
  setConfig: (config: RWAConfig) => void;
  resetConfig: () => void;
  updateToken: (patch: Partial<TokenConfig>) => void;
  updateIdentity: (patch: Partial<IdentityVerificationConfig>) => void;
  updateCompliance: (patch: Partial<ComplianceConfig>) => void;
  updateAccessControl: (patch: Partial<AccessControlConfig>) => void;
  updateDeployment: (patch: Partial<DeploymentConfig>) => void;
}

export function useWizardDraftState(initial?: RWAConfig): WizardDraftStateApi {
  const [config, setConfig] = useState<RWAConfig>(() => initial ?? createDefaultRwaConfig());

  const resetConfig = useCallback(() => setConfig(createDefaultRwaConfig()), []);

  const updateToken = useCallback(
    (patch: Partial<TokenConfig>) =>
      setConfig((prev) => ({ ...prev, token: { ...prev.token, ...patch } })),
    []
  );

  const updateIdentity = useCallback(
    (patch: Partial<IdentityVerificationConfig>) =>
      setConfig((prev) => ({
        ...prev,
        identityVerification: { ...prev.identityVerification, ...patch },
      })),
    []
  );

  const updateCompliance = useCallback(
    (patch: Partial<ComplianceConfig>) =>
      setConfig((prev) => ({ ...prev, compliance: { ...prev.compliance, ...patch } })),
    []
  );

  const updateAccessControl = useCallback(
    (patch: Partial<AccessControlConfig>) =>
      setConfig((prev) => ({
        ...prev,
        accessControl: { ...prev.accessControl, ...patch },
      })),
    []
  );

  const updateDeployment = useCallback(
    (patch: Partial<DeploymentConfig>) =>
      setConfig((prev) => ({ ...prev, deployment: { ...prev.deployment, ...patch } })),
    []
  );

  return {
    config,
    setConfig,
    resetConfig,
    updateToken,
    updateIdentity,
    updateCompliance,
    updateAccessControl,
    updateDeployment,
  };
}
