import { Lock } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@openzeppelin/ui-components';

import { Badge } from '../../../components/shared/Badge';
import { SelectableCard } from '../../../components/shared/SelectableCard';

export function ImplementationApproach() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Implementation Approach</CardTitle>
        <CardDescription>Identity verification strategy for your token.</CardDescription>
      </CardHeader>
      <CardContent>
        <SelectableCard
          title="Claim-Based Verification"
          description="Uses cryptographic claims from trusted authorities (Recommended for RWA)"
          isSelected={true}
          onClick={() => {}}
          icon={<Lock className="size-4 text-muted-foreground" />}
          badge={<Badge variant="success">Selected</Badge>}
        />
      </CardContent>
    </Card>
  );
}
