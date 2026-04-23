import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, usePathname } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";

import Logger from "../utils/logger";

type LogDetails = Record<string, unknown> | undefined;

function sanitizeValue(value: unknown): unknown {
    if (value == null) return value;
    if (Array.isArray(value)) return value.map(sanitizeValue);
    if (typeof value === "object") {
        const record = value as Record<string, unknown>;
        return Object.fromEntries(
            Object.entries(record).map(([key, entry]) => [key, sanitizeValue(entry)]),
        );
    }
    if (typeof value === "function") return "[function]";
    return value;
}

export function useRouteLogger(screenName: string, details?: LogDetails) {
    const pathname = usePathname();
    const params = useLocalSearchParams();

    const payload = useMemo(
        () => ({
            screen: screenName,
            pathname,
            params: sanitizeValue(params),
            details: sanitizeValue(details),
        }),
        [details, params, pathname, screenName],
    );

    useEffect(() => {
        Logger.info("Route", "Mounted screen", payload);
        return () => {
            Logger.info("Route", "Unmounted screen", payload);
        };
    }, [payload]);

    useFocusEffect(
        useCallback(() => {
            Logger.info("Route", "Focused screen", payload);
            return () => {
                Logger.info("Route", "Blurred screen", payload);
            };
        }, [payload]),
    );
}

export function logFlowEvent(context: string, message: string, data?: Record<string, unknown>) {
    Logger.info(context, message, sanitizeValue(data));
}
