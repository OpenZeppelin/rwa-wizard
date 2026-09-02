import type { Control } from 'react-hook-form';

import type { TokenConfig } from '@openzeppelin/rwa-config';
import { BooleanField, Card, CardContent } from '@openzeppelin/ui-components';
import { cn } from '@openzeppelin/ui-utils';

import { useCopy } from '../../../../app/providers/useCopy';
import { useSectionCopy } from '../../../../app/providers/useStepCopy';
import { SectionCardHeader } from '../../../../components/shared/SectionCardHeader';
import { tokenAnchor } from '../../focused-path';
import { useIsInspected } from '../../inspected-anchor';

interface DocumentManagerSectionProps {
  control: Control<TokenConfig>;
}

export function DocumentManagerSection({ control }: DocumentManagerSectionProps) {
  const sectionCopy = useSectionCopy('document-manager');
  const fieldHelper = useCopy().fieldHelper;
  const anchor = tokenAnchor('documentManagerEnabled');
  const inspected = useIsInspected(anchor);

  return (
    <Card
      data-config-anchor={anchor}
      aria-current={inspected ? 'true' : undefined}
      className={cn(inspected && 'ring-1 ring-primary')}
    >
      <SectionCardHeader {...sectionCopy} />
      <CardContent>
        <BooleanField
          id="doc-manager-enabled"
          name="documentManager.enabled"
          label="Document Management"
          helperText={fieldHelper('document-manager.enabled').description}
          control={control}
        />
      </CardContent>
    </Card>
  );
}
