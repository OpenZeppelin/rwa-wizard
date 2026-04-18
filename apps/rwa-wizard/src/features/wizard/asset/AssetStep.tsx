import { useCallback } from 'react';

import type {
  AdministrativeControls as AdminControlsType,
  TokenConfig,
} from '@openzeppelin/rwa-config';
import { Form } from '@openzeppelin/ui-components';

import { useStepCopy } from '../../../app/providers/useStepCopy';
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
  const stepCopy = useStepCopy('asset');

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
      <WizardFrame {...stepCopy}>
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
