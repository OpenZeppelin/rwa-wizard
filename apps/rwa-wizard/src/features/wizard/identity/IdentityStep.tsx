import { useCallback } from 'react';

import type { IdentityControls, IdentityVerificationConfig } from '@openzeppelin/rwa-config';

import { useStepCopy } from '../../../app/providers/useStepCopy';
import { WizardFrame } from '../../../components/shared/WizardFrame';
import type { FeatureControlMeta } from '../../../types/wizard';
import { ClaimTopicsSection } from './ClaimTopicsSection';
import { IdentityControlsSection } from './IdentityControlsSection';
import { IdentityPrivacyNotice } from './IdentityPrivacyNotice';
import { ImplementationApproach } from './ImplementationApproach';
import { TrustedIssuersSection } from './TrustedIssuersSection';

interface IdentityStepProps {
  identity: IdentityVerificationConfig;
  maxTrustedIssuers: number;
  identityControlsMeta: readonly FeatureControlMeta[];
  onUpdate: (patch: Partial<IdentityVerificationConfig>) => void;
}

export function IdentityStep({
  identity,
  maxTrustedIssuers,
  identityControlsMeta,
  onUpdate,
}: IdentityStepProps) {
  const stepCopy = useStepCopy('identity');
  const handleControlToggle = useCallback(
    (id: string, value: boolean) => {
      onUpdate({
        controls: { ...identity.controls, [id]: value } as IdentityControls,
      });
    },
    [identity.controls, onUpdate]
  );

  return (
    <WizardFrame {...stepCopy}>
      <IdentityPrivacyNotice />
      <ImplementationApproach />
      <ClaimTopicsSection identity={identity} onUpdate={onUpdate} />
      <TrustedIssuersSection
        identity={identity}
        maxTrustedIssuers={maxTrustedIssuers}
        onUpdate={onUpdate}
      />
      <IdentityControlsSection
        controls={identity.controls}
        identityControlsMeta={identityControlsMeta}
        onToggle={handleControlToggle}
      />
    </WizardFrame>
  );
}
