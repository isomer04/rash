import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertIcon } from '@/components/icons';
import { buttonClass, Card } from '@/components/ui';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error boundary caught:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface px-base">
          <Card className="max-w-md border-l-2 border-l-negative text-center" padding="loose">
            <AlertIcon size={28} className="mx-auto mb-base text-negative" />
            <h1 className="mb-base font-display text-3xl font-semibold text-negative">Something went wrong</h1>
            <p className="mb-loose text-text-secondary">
              An unexpected error occurred. The error has been logged and we&apos;ll look into it.
            </p>
            {this.state.error && (
              <details className="mb-loose rounded-md bg-surface-sunken p-base text-left">
                <summary className="cursor-pointer font-medium">Error details</summary>
                <pre className="mt-snug overflow-auto text-xs text-text-secondary">{this.state.error.toString()}</pre>
              </details>
            )}
            <button
              onClick={this.handleReset}
              className={buttonClass({ variant: 'primary', size: 'lg' })}
            >
              Return to Dashboard
            </button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
