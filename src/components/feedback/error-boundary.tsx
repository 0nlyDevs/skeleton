"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface Props {
  readonly children: ReactNode;
  /** Rendered instead of the fallback when provided. */
  readonly fallback?: ReactNode;
}

interface State {
  readonly error: Error | null;
}

/**
 * Catches render errors in a subtree so one broken panel cannot blank the whole
 * page.
 *
 * This still has to be a class: React still has no hook equivalent for
 * `componentDidCatch`. The message is deliberately generic — the real error goes
 * to the console for the developer, not into the UI for the user.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught a render error", error, info.componentStack);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-xl border border-error/25 bg-error/6 p-5"
      >
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Cette section n&apos;a pas pu s&apos;afficher.</p>
          <p className="text-[13px] text-muted-foreground">
            Le reste de la page fonctionne. Rechargez la section pour réessayer.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={this.reset}>
          Recharger la section
        </Button>
      </div>
    );
  }
}
