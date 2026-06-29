import { Component, ReactNode, ErrorInfo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  gameName?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

export class GameErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[GameErrorBoundary] ${this.props.gameName ?? "Game"} crashed:`, error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center space-y-4">
            <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
            <h2 className="text-xl font-bold">Something went wrong</h2>
            {this.props.gameName && (
              <p className="text-muted-foreground">{this.props.gameName} encountered an unexpected error.</p>
            )}
            {this.state.message && (
              <p className="text-sm font-mono bg-muted rounded p-2 text-left break-words">
                {this.state.message}
              </p>
            )}
            <Button onClick={this.handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}
