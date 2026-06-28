/**
 * TVPlayerErrorBoundary
 *
 * A lightweight error boundary scoped to the player area only.
 * Catches render-time exceptions without crashing the whole page.
 * Provides a minimal in-place retry UI that resets the subtree.
 */

import { Component, type ReactNode } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface Props {
  children:  ReactNode;
  resetKey?: string | number;
}

interface State {
  error:      Error | null;
  lastKey:    string | number | undefined;
}

export class TVPlayerErrorBoundary extends Component<Props, State> {
  state: State = { error: null, lastKey: undefined };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // Auto-reset when consumer changes resetKey (e.g. channel switch)
    if (props.resetKey !== state.lastKey) {
      return { error: null, lastKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error) {
    console.error("[TVPlayerErrorBoundary]", error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex flex-col items-center justify-center gap-3">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-sm text-white/60">Player error — unable to render</p>
          <button
            onClick={this.reset}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-white/10 text-white/80 text-sm hover:bg-white/20 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
