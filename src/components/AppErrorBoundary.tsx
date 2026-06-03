// src/components/AppErrorBoundary.tsx
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS } from "../theme";
import { captureException } from "../lib/monitoring";

type Props = {
  children: React.ReactNode;
  /** Optional custom fallback renderer. */
  fallback?: (reset: () => void) => React.ReactNode;
};

type State = {
  hasError: boolean;
};

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
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }): void {
    captureException(error, {
      source: "AppErrorBoundary",
      // componentStack is non-PII React internal info; redactor passes it.
      componentStack: info?.componentStack,
    });
  }

  reset = (): void => {
    this.setState({ hasError: false });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback(this.reset);
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
