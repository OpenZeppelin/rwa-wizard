import { Info } from 'lucide-react';
import type { ReactElement } from 'react';

import type { CodegenInfoBlurb } from '@openzeppelin/codegen-core';
import { Banner, ExternalLink } from '@openzeppelin/ui-components';

export interface CodegenInfoBlurbPanelProps {
  blurb: CodegenInfoBlurb | null;
}

/**
 * Renders codegen-provided intro copy: title, description, and reference links.
 */
export function CodegenInfoBlurbPanel({ blurb }: CodegenInfoBlurbPanelProps): ReactElement | null {
  if (!blurb) {
    return null;
  }

  return (
    <Banner
      variant="info"
      title={blurb.title}
      dismissible={false}
      icon={<Info className="size-4" aria-hidden />}
    >
      <div className="space-y-3">
        <p>{blurb.description}</p>
        {blurb.links.length > 0 && (
          <ul className="flex flex-col gap-2">
            {blurb.links.map((link) => (
              <li key={link.href}>
                <ExternalLink href={link.href}>{link.label}</ExternalLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Banner>
  );
}
