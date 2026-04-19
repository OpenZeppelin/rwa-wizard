import type { IdentityControls } from '@openzeppelin/rwa-config';
import { Card, CardContent } from '@openzeppelin/ui-components';

import { useSectionCopy } from '../../../../app/providers/useStepCopy';
import { ReadOnlyFeatureCard } from '../../../../components/shared/ReadOnlyFeatureCard';
import { SectionCardHeader } from '../../../../components/shared/SectionCardHeader';
import { SelectableCard } from '../../../../components/shared/SelectableCard';
import type { FeatureControlMeta } from '../../../../types/wizard';

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
  const sectionCopy = useSectionCopy('identity-controls');
  if (identityControlsMeta.length === 0) return null;

  return (
    <Card>
      <SectionCardHeader {...sectionCopy} />
      <CardContent className="space-y-3">
        {identityControlsMeta.map((meta) => {
          const value = controls[meta.id as keyof IdentityControls] ?? meta.defaultValue;

          if (meta.locked) {
            return (
              <ReadOnlyFeatureCard
                key={meta.id}
                title={meta.name}
                description={meta.description}
                infoTooltip={meta.infoCopy}
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
