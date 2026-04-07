import type { Control } from 'react-hook-form';

import type { TokenConfig } from '@openzeppelin/rwa-config';
import {
  BooleanField,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@openzeppelin/ui-components';

interface DocumentManagerSectionProps {
  control: Control<TokenConfig>;
}

export function DocumentManagerSection({ control }: DocumentManagerSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Manager</CardTitle>
        <CardDescription>
          Enable ERC-1643 Document Management for attaching legal documents, prospectuses, and
          reports.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <BooleanField
          id="doc-manager-enabled"
          name="documentManager.enabled"
          label="Document Management"
          helperText="Enable document management for attaching legal documents, prospectuses, reports (max 5,000 documents)"
          control={control}
        />
      </CardContent>
    </Card>
  );
}
