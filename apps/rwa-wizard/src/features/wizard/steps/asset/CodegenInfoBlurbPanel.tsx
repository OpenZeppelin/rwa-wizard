import { ExternalLink, Info } from 'lucide-react';
import type { ReactElement } from 'react';

import type { CodegenInfoBlurb } from '@openzeppelin/codegen-core';

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
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg border border-border bg-muted/50 p-4 sm:flex-row sm:items-start sm:gap-3"
    >
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-sm font-medium text-foreground">{blurb.title}</p>
        <p className="text-sm text-muted-foreground">{blurb.description}</p>
        {blurb.links.length > 0 && (
          <ul className="flex flex-col gap-2">
            {blurb.links.map((link) => (
              <li key={link.href}>
                <a
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
