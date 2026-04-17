import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Root UI error boundary:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-800 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-6 text-center">
          <h1 className="text-xl font-semibold mb-2">Nagot gick fel</h1>
          <p className="text-sm text-stone-600 mb-4">Ladda om sidan och forsok igen.</p>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white"
            onClick={() => window.location.reload()}
          >
            Ladda om
          </button>
        </div>
      </div>
    );
  }
}
