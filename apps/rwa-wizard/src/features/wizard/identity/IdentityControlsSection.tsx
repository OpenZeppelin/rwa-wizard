import type { IdentityControls } from '@openzeppelin/rwa-config';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@openzeppelin/ui-components';

import { ReadOnlyFeatureCard } from '../../../components/shared/ReadOnlyFeatureCard';
import { SelectableCard } from '../../../components/shared/SelectableCard';
import type { FeatureControlMeta } from '../../../types/wizard';

interface IdentityControlsSectionProps {
  controls: IdentityControls;
  identityControlsMeta: readonly FeatureControlMeta[];
  onToggle?: (id: string, value: boolean) => void;
}

export function IdentityControlsSection({
  controls,
  identityControlsMeta,
  onToggle,
}: IdentityControlsSectionProps) {
  if (identityControlsMeta.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identity Controls</CardTitle>
        <CardDescription>
          Token management capabilities for compliance, recovery, and dispute resolution. Locked
          features are required by the target ecosystem.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {identityControlsMeta.map((meta) => {
          const value = controls[meta.id as keyof IdentityControls] ?? meta.defaultValue;

          if (meta.locked) {
            return (
              <ReadOnlyFeatureCard
                key={meta.id}
                title={meta.name}
                description={meta.description}
                enabled={meta.defaultValue}
              />
            );
          }

          return (
            <SelectableCard
              key={meta.id}
              title={meta.name}
              description={meta.description}
              isSelected={value}
              onClick={() => onToggle?.(meta.id, !value)}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
