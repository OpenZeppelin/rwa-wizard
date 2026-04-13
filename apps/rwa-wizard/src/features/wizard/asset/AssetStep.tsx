import { useCallback } from 'react';

import type {
  AdministrativeControls as AdminControlsType,
  TokenConfig,
} from '@openzeppelin/rwa-config';
import { Form } from '@openzeppelin/ui-components';

import { WizardFrame } from '../../../components/shared/WizardFrame';
import { useStepForm } from '../../../hooks/useStepForm';
import type { FeatureControlMeta } from '../../../types/wizard';
import { AdministrativeControls } from './AdministrativeControls';
import { DocumentManagerSection } from './DocumentManagerSection';
import { TokenBasics } from './TokenBasics';

interface AssetStepProps {
  token: TokenConfig;
  adminControlsMeta: readonly FeatureControlMeta[];
  onUpdate: (patch: Partial<TokenConfig>) => void;
}

export function AssetStep({ token, adminControlsMeta, onUpdate }: AssetStepProps) {
  const form = useStepForm(token, onUpdate);

  const handleAdminToggle = useCallback(
    (id: string, value: boolean) => {
      onUpdate({
        administrativeControls: {
          ...token.administrativeControls,
          [id]: value,
        } as AdminControlsType,
      });
    },
    [token.administrativeControls, onUpdate]
  );

  return (
    <Form {...form}>
      <WizardFrame
        title="Asset Configuration"
        description="Define the fundamental token properties and administrative controls for your RWA token."
      >
        <TokenBasics control={form.control} />
        <AdministrativeControls
          controls={token.administrativeControls}
          adminControlsMeta={adminControlsMeta}
          onToggle={handleAdminToggle}
        />
        <DocumentManagerSection control={form.control} />
      </WizardFrame>
    </Form>
  );
}
