import type { ReactElement, ReactNode } from 'react';

import { renderInlineCopy } from '../../components/shared/renderInlineCopy';
import type { WizardStepId } from '../../types/wizard';
import { useCopy } from './useCopy';

/**
 * Props shape compatible with `WizardFrame` for a given wizard step. Keeps
 * `descriptionTooltip` pre-rendered so step files do not need to import the
 * renderer themselves.
 */
export interface StepCopy {
  title: string;
  description: string;
  descriptionTooltip?: ReactNode;
}

/**
 * Look up the copy for a wizard step (title + subtitle + long-form tooltip)
 * and hand back a ready-to-spread object for `WizardFrame`.
 *
 * Keeps each step file a thin composition of sub-sections — the prose lives
 * in `@openzeppelin/rwa-wizard-copy` and any chain-specific override is
 * handled transparently by the active `CopyProvider`.
 */
export function useStepCopy(stepId: WizardStepId): StepCopy {
  const entry = useCopy().wizardStep(stepId);
  return {
    title: entry.title ?? entry.id,
    description: entry.description,
    descriptionTooltip: entry.infoCopy ? renderInlineCopy(entry.infoCopy) : undefined,
  };
}

/**
 * Props shape compatible with `SectionCardHeader`, with the `info` tooltip
 * body already rendered so inline-code spans lift into `<code>` elements.
 */
export interface SectionCopy {
  title: string;
  info?: ReactElement;
}

/**
 * Look up the card header copy for a section. `sectionId` is the short id
 * (without the `section.` prefix); the provider enforces chain-neutral
 * resolution unless an override redefines the section.
 */
export function useSectionCopy(sectionId: string): SectionCopy {
  const entry = useCopy().section(sectionId);
  return {
    title: entry.title ?? entry.id,
    info: entry.infoCopy ? renderInlineCopy(entry.infoCopy) : undefined,
  };
}
