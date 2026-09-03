import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const DEBOUNCE_MS = 1_000;

/**
 * Sends a typing heartbeat (debounced to 1s) and subscribes to typers for
 * the given chatKey. Returns the list of currently-typing names (excluding self).
 */
export function useChatTyping(chatKey: string | null | undefined) {
    const setTypingMutation = useMutation(api.chat.setTyping);
    const lastSentRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const sendTyping = useCallback(() => {
        if (!chatKey) return;
        const now = Date.now();
        if (now - lastSentRef.current < DEBOUNCE_MS) return;
        lastSentRef.current = now;
        void setTypingMutation({ chatKey }).catch(() => {});
    }, [chatKey, setTypingMutation]);

    // Fire on input change — the screen calls this from onInputChange
    const onInputActivity = useCallback(() => {
        sendTyping();
        // Also schedule a trailing send in case the user types one char then stops
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(sendTyping, DEBOUNCE_MS);
    }, [sendTyping]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const typers = useQuery(
        api.chat.getTypers,
        chatKey ? { chatKey } : "skip"
    );

    const typingNames: string[] = (typers || []).map(
        (t: { userName: string }) => t.userName
    );

    return { typingNames, onInputActivity };
}
