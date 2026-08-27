import type { ReactElement } from 'react';

import { ErrorBanner } from '../../../components/shared/ErrorBanner';

export function PreviewGenerateError(props: { messages: readonly string[] }): ReactElement {
  const { messages } = props;

  if (messages.length === 1) {
    return <ErrorBanner tone="error" message={messages[0]} />;
  }

  return (
    <ErrorBanner
      tone="error"
      message={
        <ul className="list-disc space-y-1 pl-5">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      }
    />
  );
}
