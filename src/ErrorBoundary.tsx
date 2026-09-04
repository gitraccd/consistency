import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * Without this, an unhandled render error anywhere in the tree just blanks
 * the whole screen with no explanation -- React error boundaries can only
 * be class components, there's no hook equivalent.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in render tree:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
          <div>
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-text-muted">{this.state.error.message}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-accent px-6 py-3 font-medium text-accent-text transition-transform active:scale-[0.98]"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
