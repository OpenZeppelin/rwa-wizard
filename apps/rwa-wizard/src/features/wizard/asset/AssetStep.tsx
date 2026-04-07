import { useCallback } from 'react';

import type {
  AdministrativeControls as AdminControlsType,
  TokenConfig,
} from '@openzeppelin/rwa-config';
import { Form } from '@openzeppelin/ui-components';

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
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Asset Configuration</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Define the fundamental token properties and administrative controls for your RWA token.
          </p>
        </div>

        <TokenBasics control={form.control} />
        <AdministrativeControls
          controls={token.administrativeControls}
          adminControlsMeta={adminControlsMeta}
          onToggle={handleAdminToggle}
        />
        <DocumentManagerSection control={form.control} />
      </div>
    </Form>
  );
}
