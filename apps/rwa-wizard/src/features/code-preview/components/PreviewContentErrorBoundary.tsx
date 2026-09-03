import { Component, type ErrorInfo, type ReactElement, type ReactNode } from 'react';

import { logger } from '@openzeppelin/ui-utils';

import { ErrorBanner } from '../../../components/shared/ErrorBanner';

interface PreviewContentErrorBoundaryProps {
  readonly children: ReactNode;
  readonly resetKey: string;
  /**
   * Fallback text. Owned by `@openzeppelin/rwa-wizard-copy` and passed in:
   * a class component cannot call `useCopy`.
   */
  readonly message: string;
}

interface PreviewContentErrorBoundaryState {
  readonly hasError: boolean;
}

/** Catches tree/code throws so the wizard shell stays up. INV-16 */
export class PreviewContentErrorBoundary extends Component<
  PreviewContentErrorBoundaryProps,
  PreviewContentErrorBoundaryState
> {
  state: PreviewContentErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PreviewContentErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('CODE_PREVIEW', 'Preview content failed to render', error, info);
  }

  componentDidUpdate(prevProps: PreviewContentErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactElement {
    if (this.state.hasError) {
      return <ErrorBanner tone="error" message={this.props.message} />;
    }

    return <>{this.props.children}</>;
  }
}
