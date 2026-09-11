export type PollingSubscriptionCallback<T> = {
    onData: (rows: T[]) => void;
    onError: (error: any) => void;
};

export type SharedPollingState<T> = {
    callbacks: Set<PollingSubscriptionCallback<T>>;
    unsubscribe: (() => void) | null;
    lastPayloadSignature: string | null;
    lastRows: T[] | null;
};

export function createSharedPollingState<T>(): SharedPollingState<T> {
    return {
        callbacks: new Set(),
        unsubscribe: null,
        lastPayloadSignature: null,
        lastRows: null,
    };
}

export function safePollingSignature(value: unknown) {
    try {
        return JSON.stringify(value);
    } catch {
        return `${Date.now()}`;
    }
}

export function publishPollingRows<T>(
    state: SharedPollingState<T>,
    rows: T[],
) {
    const nextSignature = safePollingSignature(rows);
    if (nextSignature === state.lastPayloadSignature) {
        return false;
    }

    state.lastPayloadSignature = nextSignature;
    state.lastRows = rows;
    state.callbacks.forEach((callback) => callback.onData(rows));
    return true;
}

export function replayPollingRows<T>(
    state: SharedPollingState<T>,
    callback: PollingSubscriptionCallback<T>,
) {
    if (!state.lastRows) {
        return;
    }
    callback.onData(state.lastRows);
}

export function releasePollingSubscription<T>(
    store: Map<string, SharedPollingState<T>>,
    key: string,
    callback: PollingSubscriptionCallback<T>,
) {
    const currentState = store.get(key);
    if (!currentState) return;

    currentState.callbacks.delete(callback);
    if (currentState.callbacks.size > 0) {
        return;
    }

    currentState.unsubscribe?.();
    store.delete(key);
}
