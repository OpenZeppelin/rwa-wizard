import { Component, type ErrorInfo, type ReactElement, type ReactNode } from 'react';

import { ErrorBanner } from '../../../components/shared/ErrorBanner';

interface PreviewContentErrorBoundaryProps {
  readonly children: ReactNode;
  readonly resetKey: string;
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
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console -- dev-only diagnostic for preview pane failures
      console.error('Code preview content error', error, info);
    }
  }

  componentDidUpdate(prevProps: PreviewContentErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactElement {
    if (this.state.hasError) {
      return (
        <ErrorBanner
          tone="error"
          message="Preview could not render this content. Close and reopen the preview to try again."
        />
      );
    }

    return <>{this.props.children}</>;
  }
}
