import { FileCode } from 'lucide-react';
import type { ReactElement } from 'react';

import { Button } from '@openzeppelin/ui-components';

import { useCopy } from '../../../app/providers/useCopy';
import type { UseCodePreviewResult } from '../hooks/useCodePreview';

/**
 * Toggle for the code preview drawer. The visible label follows the drawer's state:
 * `label` while collapsed, `expandedLabel` while expanded — driven by the same
 * `aria-expanded` the hook already supplies, so the two can never disagree.
 *
 * Both labels default to `@openzeppelin/rwa-wizard-copy`; the props exist for
 * call sites that need a different wording, not to own the default.
 */
export function CodePreviewTrigger(props: {
  show: boolean;
  /** Label while the drawer is closed. */
  label?: string;
  /** Label while the drawer is open. */
  expandedLabel?: string;
  triggerProps: UseCodePreviewResult['triggerProps'];
}): ReactElement | null {
  const copy = useCopy();
  const { show, label, expandedLabel, triggerProps } = props;
  const expanded = triggerProps['aria-expanded'];

  if (!show) {
    return null; // INV-4
  }

  const collapsedText = label ?? copy.notice('code-preview.trigger-show').description;
  const expandedText = expandedLabel ?? copy.notice('code-preview.trigger-hide').description;

  return (
    <Button
      type="button"
      variant="outline"
      ref={triggerProps.ref}
      aria-expanded={triggerProps['aria-expanded']}
      aria-controls={triggerProps['aria-controls']}
      onClick={triggerProps.onClick}
      className="gap-1.5"
    >
      <FileCode className="size-4" aria-hidden />
      {expanded ? expandedText : collapsedText}
    </Button>
  );
}
