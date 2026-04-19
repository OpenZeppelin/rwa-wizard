import { describe, expect, it } from 'vitest';

import type { ComponentInventoryItem } from '../types/wizard';
import {
  classifyComponent,
  getPromotionCandidates,
  groupByClassification,
  isPromotionCandidate,
} from './componentInventory';

describe('classifyComponent', () => {
  it('classifies a component from @openzeppelin/ui-components as reused', () => {
    const item = classifyComponent({
      componentName: 'Button',
      owningFile: 'node_modules/@openzeppelin/ui-components/src/Button.tsx',
      rationale: 'Standard shared button',
    });
    expect(item.classification).toBe('reused');
  });

  it('classifies a component from @openzeppelin/ui-react as reused', () => {
    const item = classifyComponent({
      componentName: 'useForm',
      owningFile: 'node_modules/@openzeppelin/ui-react/src/hooks/useForm.ts',
      rationale: 'Shared form hook',
    });
    expect(item.classification).toBe('reused');
  });

  it('classifies a wizard-local component as local-candidate', () => {
    const item = classifyComponent({
      componentName: 'SelectableCard',
      owningFile: 'apps/rwa-wizard/src/components/shared/SelectableCard.tsx',
      rationale: 'Wizard-specific selectable card pattern',
    });
    expect(item.classification).toBe('local-candidate');
  });

  it('classifies a feature-specific component as local-candidate', () => {
    const item = classifyComponent({
      componentName: 'ModuleCatalog',
      owningFile: 'apps/rwa-wizard/src/features/wizard/steps/compliance/ModuleCatalog.tsx',
      rationale: 'Compliance module selection UI',
    });
    expect(item.classification).toBe('local-candidate');
  });

  it('allows explicit classification override', () => {
    const item = classifyComponent({
      componentName: 'Badge',
      owningFile: 'apps/rwa-wizard/src/components/shared/Badge.tsx',
      rationale: 'Validated locally, promoted upstream',
      classificationOverride: 'promoted-shared',
      followUpAction: 'Add example coverage in ui-components',
    });
    expect(item.classification).toBe('promoted-shared');
    expect(item.followUpAction).toBe('Add example coverage in ui-components');
  });

  it('preserves optional followUpAction', () => {
    const item = classifyComponent({
      componentName: 'ConfigSummary',
      owningFile: 'apps/rwa-wizard/src/components/shared/ConfigSummary.tsx',
      rationale: 'Read-only config summary card',
      followUpAction: 'Evaluate for promotion after second consumer',
    });
    expect(item.followUpAction).toBe('Evaluate for promotion after second consumer');
  });
});

describe('isPromotionCandidate', () => {
  it('returns true for local-candidate components in shared/', () => {
    const item: ComponentInventoryItem = {
      componentName: 'Table',
      owningFile: 'apps/rwa-wizard/src/components/shared/Table.tsx',
      classification: 'local-candidate',
      rationale: 'Lightweight table primitives',
    };
    expect(isPromotionCandidate(item)).toBe(true);
  });

  it('returns false for reused components', () => {
    const item: ComponentInventoryItem = {
      componentName: 'Button',
      owningFile: 'node_modules/@openzeppelin/ui-components/src/Button.tsx',
      classification: 'reused',
      rationale: 'Standard shared button',
    };
    expect(isPromotionCandidate(item)).toBe(false);
  });

  it('returns false for already promoted components', () => {
    const item: ComponentInventoryItem = {
      componentName: 'Badge',
      owningFile: 'packages/components/src/Badge.tsx',
      classification: 'promoted-shared',
      rationale: 'Already promoted',
    };
    expect(isPromotionCandidate(item)).toBe(false);
  });
});

describe('groupByClassification', () => {
  const items: ComponentInventoryItem[] = [
    {
      componentName: 'Button',
      owningFile: '@openzeppelin/ui-components',
      classification: 'reused',
      rationale: 'Shared',
    },
    {
      componentName: 'Badge',
      owningFile: 'apps/rwa-wizard/src/components/shared/Badge.tsx',
      classification: 'local-candidate',
      rationale: 'Local badge',
    },
    {
      componentName: 'Card',
      owningFile: '@openzeppelin/ui-components',
      classification: 'reused',
      rationale: 'Shared',
    },
    {
      componentName: 'WizardFrame',
      owningFile: 'apps/rwa-wizard/src/components/shared/WizardFrame.tsx',
      classification: 'local-candidate',
      rationale: 'Layout primitive',
    },
  ];

  it('groups items by their classification', () => {
    const grouped = groupByClassification(items);
    expect(grouped.reused).toHaveLength(2);
    expect(grouped['local-candidate']).toHaveLength(2);
    expect(grouped['promoted-shared']).toHaveLength(0);
  });

  it('returns empty arrays for missing classifications', () => {
    const grouped = groupByClassification([]);
    expect(grouped.reused).toHaveLength(0);
    expect(grouped['local-candidate']).toHaveLength(0);
    expect(grouped['promoted-shared']).toHaveLength(0);
  });
});

describe('getPromotionCandidates', () => {
  it('returns only local-candidate items', () => {
    const items: ComponentInventoryItem[] = [
      {
        componentName: 'Button',
        owningFile: '@openzeppelin/ui-components',
        classification: 'reused',
        rationale: 'Shared',
      },
      {
        componentName: 'Badge',
        owningFile: 'apps/rwa-wizard/src/components/shared/Badge.tsx',
        classification: 'local-candidate',
        rationale: 'Candidate for promotion',
      },
      {
        componentName: 'Table',
        owningFile: 'apps/rwa-wizard/src/components/shared/Table.tsx',
        classification: 'local-candidate',
        rationale: 'Lightweight table',
      },
    ];
    const candidates = getPromotionCandidates(items);
    expect(candidates).toHaveLength(2);
    expect(candidates.map((c) => c.componentName)).toEqual(['Badge', 'Table']);
  });
});
