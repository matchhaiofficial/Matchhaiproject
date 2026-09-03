// src/components/AppErrorBoundary.tsx
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS } from "../theme";
import { captureException } from "../lib/monitoring";

type Props = {
  children: React.ReactNode;
  /** Optional custom fallback renderer. */
  fallback?: (reset: () => void) => React.ReactNode;
  /** Automatically remount the subtree after a transient render failure. */
  autoRetry?: boolean;
  /** Maximum consecutive automatic remounts before showing the manual fallback. */
  maxAutoRetries?: number;
  /** Base delay used for exponential retry backoff. */
  autoRetryBaseDelayMs?: number;
};

type State = {
  hasError: boolean;
  retryKey: number;
  autoRetryCount: number;
};

const STABLE_RESET_DELAY_MS = 10_000;

/**
 * Root React error boundary. Catches render/lifecycle errors in the tree,
 * forwards them to the monitoring layer (which redacts + routes to Sentry or
 * the local Logger), and renders a safe, PII-free fallback UI.
 *
 * Note: this complements the global JS error handler installed by
 * initMonitoring() — that catches async/native errors, this catches render
 * errors React would otherwise unmount the whole tree for.
 */
export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, retryKey: 0, autoRetryCount: 0 };
  private autoRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private stableResetTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }): void {
    captureException(error, {
      source: "AppErrorBoundary",
      retryCount: this.state.autoRetryCount,
      // componentStack is non-PII React internal info; redactor passes it.
      componentStack: info?.componentStack,
    });

    const maxAutoRetries = this.props.maxAutoRetries ?? 3;
    if (!this.props.autoRetry || this.state.autoRetryCount >= maxAutoRetries) return;

    const baseDelay = this.props.autoRetryBaseDelayMs ?? 350;
    const delay = baseDelay * 2 ** this.state.autoRetryCount;
    this.clearAutoRetryTimer();
    this.autoRetryTimer = setTimeout(this.retryAfterError, delay);
  }

  componentDidUpdate(_previousProps: Props, previousState: State): void {
    if (previousState.hasError && !this.state.hasError && this.state.autoRetryCount > 0) {
      this.clearStableResetTimer();
      this.stableResetTimer = setTimeout(() => {
        if (!this.state.hasError) {
          this.setState({ autoRetryCount: 0 });
        }
      }, STABLE_RESET_DELAY_MS);
    }
  }

  componentWillUnmount(): void {
    this.clearAutoRetryTimer();
    this.clearStableResetTimer();
  }

  clearAutoRetryTimer = (): void => {
    if (this.autoRetryTimer) {
      clearTimeout(this.autoRetryTimer);
      this.autoRetryTimer = null;
    }
  };

  clearStableResetTimer = (): void => {
    if (this.stableResetTimer) {
      clearTimeout(this.stableResetTimer);
      this.stableResetTimer = null;
    }
  };

  retryAfterError = (): void => {
    this.autoRetryTimer = null;
    this.setState((state) =>
      state.hasError
        ? {
            hasError: false,
            retryKey: state.retryKey + 1,
            autoRetryCount: state.autoRetryCount + 1,
          }
        : null,
    );
  }

  reset = (): void => {
    this.clearAutoRetryTimer();
    this.clearStableResetTimer();
    this.setState((state) => ({
      hasError: false,
      retryKey: state.retryKey + 1,
      autoRetryCount: 0,
    }));
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
    }

    if (this.props.fallback) {
      return this.props.fallback(this.reset);
    }

    const maxAutoRetries = this.props.maxAutoRetries ?? 3;
    if (this.props.autoRetry && this.state.autoRetryCount < maxAutoRetries) {
      return (
        <View style={styles.container}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={styles.recoveryText}>Restoring your session...</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          The app hit an unexpected error. You can try again.
        </Text>
        <Pressable style={styles.button} onPress={this.reset} accessibilityRole="button">
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: COLORS.backgroundDark,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  recoveryText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 16,
    textAlign: "center",
  },
  button: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
  },
});
