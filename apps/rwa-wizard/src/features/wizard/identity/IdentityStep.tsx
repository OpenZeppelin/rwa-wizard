import { useCallback } from 'react';

import type { IdentityControls, IdentityVerificationConfig } from '@openzeppelin/rwa-config';

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
  const handleControlToggle = useCallback(
    (id: string, value: boolean) => {
      onUpdate({
        controls: { ...identity.controls, [id]: value } as IdentityControls,
      });
    },
    [identity.controls, onUpdate]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Identity Configuration</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure identity verification and management controls for your RWA token.
        </p>
      </div>

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
    </div>
  );
}
