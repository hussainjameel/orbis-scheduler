"use client";

import { Component, type ReactNode } from "react";

// A plain try/catch around JSX doesn't catch a child's render-time throw —
// only an error boundary does, and only class components can be one. Scoped
// narrowly to just the QR canvas (per UC10's E1) so a QR failure can't take
// out Sections A and B alongside it.
export class QrErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onError?: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
