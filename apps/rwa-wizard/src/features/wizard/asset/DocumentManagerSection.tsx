import type { Control } from 'react-hook-form';

import type { TokenConfig } from '@openzeppelin/rwa-config';
import { BooleanField, Card, CardContent } from '@openzeppelin/ui-components';

import { useCopy } from '../../../app/providers/useCopy';
import { useSectionCopy } from '../../../app/providers/useStepCopy';
import { SectionCardHeader } from '../../../components/shared/SectionCardHeader';

interface DocumentManagerSectionProps {
  control: Control<TokenConfig>;
}

export function DocumentManagerSection({ control }: DocumentManagerSectionProps) {
  const sectionCopy = useSectionCopy('document-manager');
  const fieldHelper = useCopy().fieldHelper;
  return (
    <Card>
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
