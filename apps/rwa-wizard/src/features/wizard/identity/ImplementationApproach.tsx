import { Lock } from 'lucide-react';

import { Card, CardContent } from '@openzeppelin/ui-components';

import { useCopy } from '../../../app/providers/useCopy';
import { useSectionCopy } from '../../../app/providers/useStepCopy';
import { Badge } from '../../../components/shared/Badge';
import { SectionCardHeader } from '../../../components/shared/SectionCardHeader';
import { SelectableCard } from '../../../components/shared/SelectableCard';

export function ImplementationApproach() {
  const sectionCopy = useSectionCopy('implementation-approach');
  const approach = useCopy().verificationApproach('claim-based');
  return (
    <Card>
      <SectionCardHeader {...sectionCopy} />
      <CardContent>
        <SelectableCard
          title={approach.title ?? 'Claim-Based Verification'}
          description={approach.description}
          isSelected={true}
          onClick={() => {}}
          icon={<Lock className="size-3.5" />}
          badge={<Badge variant="success">Selected</Badge>}
        />
      </CardContent>
    </Card>
  );
}
