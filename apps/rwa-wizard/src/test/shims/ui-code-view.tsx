import type { ReactElement } from 'react';

export type CodeViewLanguage = 'rust' | 'toml' | 'shell' | 'json' | 'markdown' | 'plaintext';

export interface CodeViewToken {
  readonly text: string;
  readonly offset: number;
  readonly className?: string;
}

export interface CodeViewDecorationContext {
  readonly source: string;
  readonly language: CodeViewLanguage;
  readonly token: CodeViewToken;
}

export type CodeViewTokenDecorator = (
  context: CodeViewDecorationContext
) => React.ReactNode | null | undefined;

export interface CodeViewProps {
  readonly source: string;
  readonly language: CodeViewLanguage;
  readonly className?: string;
  readonly 'aria-label'?: string;
  readonly decorateToken?: CodeViewTokenDecorator;
}

export function CodeView(props: CodeViewProps): ReactElement {
  return <pre aria-label={props['aria-label']}>{props.source}</pre>;
}
