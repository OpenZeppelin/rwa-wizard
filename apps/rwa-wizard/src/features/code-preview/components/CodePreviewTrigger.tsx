import { FileCode } from 'lucide-react';
import type { ReactElement } from 'react';

import { Button } from '@openzeppelin/ui-components';

import type { UseCodePreviewResult } from '../hooks/useCodePreview';

/**
 * Toggle for the code preview drawer. The visible label follows the drawer's state:
 * `label` while collapsed, `expandedLabel` while expanded — driven by the same
 * `aria-expanded` the hook already supplies, so the two can never disagree.
 */
export function CodePreviewTrigger(props: {
  show: boolean;
  /** Label while the drawer is closed. */
  label?: string;
  /** Label while the drawer is open. */
  expandedLabel?: string;
  triggerProps: UseCodePreviewResult['triggerProps'];
}): ReactElement | null {
  const {
    show,
    label = 'View generated code',
    expandedLabel = 'Hide generated code',
    triggerProps,
  } = props;
  const expanded = triggerProps['aria-expanded'];

  if (!show) {
    return null; // INV-4
  }

  return (
    <Button
      type="button"
      variant="outline"
      aria-expanded={triggerProps['aria-expanded']}
      aria-controls={triggerProps['aria-controls']}
      onClick={triggerProps.onClick}
      className="gap-1.5"
    >
      <FileCode className="size-4" aria-hidden />
      {expanded ? expandedLabel : label}
    </Button>
  );
}
