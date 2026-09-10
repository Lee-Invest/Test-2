"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// If anything in the wrapped tree throws during render (most notably a
// hydration mismatch), React would otherwise leave the page's static HTML
// sitting there with no event listeners attached — buttons still show
// their CSS :hover state (that's pure CSS, no JS needed) but clicks do
// nothing, because React never finished mounting. That exact symptom
// ("hover works, click doesn't") is indistinguishable from a plain bug
// without seeing the actual error, so this boundary shows the error text
// directly on the page instead of only in a devtools console we can't see.
export class ConfiguratorErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // eslint-disable-next-line no-console
    console.error("ConfiguratorErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          <p className="font-semibold">Something went wrong loading this page.</p>
          <p className="mt-2 font-mono text-xs">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
