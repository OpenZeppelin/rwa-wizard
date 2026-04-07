import type { AdministrativeControls as AdminControlsType } from '@openzeppelin/rwa-config';
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

interface AdministrativeControlsProps {
  controls: AdminControlsType;
  adminControlsMeta: readonly FeatureControlMeta[];
  onToggle?: (id: string, value: boolean) => void;
}

export function AdministrativeControls({
  controls,
  adminControlsMeta,
  onToggle,
}: AdministrativeControlsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Administrative Controls</CardTitle>
        <CardDescription>
          Basic token control features. Locked features are required by the target ecosystem.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {adminControlsMeta.map((meta) => {
          const value = controls[meta.id as keyof AdminControlsType] ?? meta.defaultValue;

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
