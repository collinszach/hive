"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[ErrorBoundary] Caught error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="glass-card max-w-md mx-auto my-16 p-8 flex flex-col items-center gap-4 text-center">
          <AlertTriangle size={40} color="#F87171" />
          <h2 className="text-lg font-semibold text-ink-primary">
            Something went wrong
          </h2>
          {this.state.error && (
            <p className="text-ink-tertiary text-[12px] break-all max-w-full">
              {this.state.error.message}
            </p>
          )}
          <button
            className="hive-btn-secondary mt-2"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
