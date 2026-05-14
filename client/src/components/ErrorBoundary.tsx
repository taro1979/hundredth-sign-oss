import { cn } from "@/lib/utils";
import i18n from "@/lib/i18n";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;

      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border-0 w-full max-w-lg mx-4 p-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-amber-100 rounded-full animate-pulse" />
                <AlertTriangle className="relative h-16 w-16 text-amber-500" />
              </div>
            </div>

            <h1 className="text-4xl font-bold text-slate-900 mb-2">500</h1>
            <h2 className="text-xl font-semibold text-slate-700 mb-4">
              {i18n.t("errors.serverError")}
            </h2>
            <p className="text-slate-600 mb-6 leading-relaxed">
              {i18n.t("errors.serverErrorDesc")}
            </p>

            {isDev && this.state.error?.stack && (
              <div className="p-4 w-full rounded bg-muted overflow-auto mb-6 text-left">
                <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                  {this.state.error.stack}
                </pre>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-primary text-primary-foreground",
                  "hover:opacity-90 cursor-pointer"
                )}
              >
                <RotateCcw size={16} />
                {i18n.t("errors.tryAgain")}
              </button>
              <button
                onClick={() => { window.location.href = "/"; }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-slate-100 text-slate-700",
                  "hover:bg-slate-200 cursor-pointer"
                )}
              >
                <Home size={16} />
                {i18n.t("errors.goHome")}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
