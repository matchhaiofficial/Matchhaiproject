import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { AppIcon } from "../../components/AppIcon";
import { COLORS } from "../../theme";
import Logger from "../../utils/logger";
import styles from "./chatThread.styles";
import { formatVoiceDuration } from "./utils";

type VoiceMessageBubbleProps = {
    messageId: string;
    audioUrl?: string | null;
    durationMs?: number | null;
    mine: boolean;
};

type PlaybackSnapshot = {
    activeMessageId: string | null;
    activeAudioUrl: string | null;
    isPlaying: boolean;
    isLoaded: boolean;
    isBuffering: boolean;
    didJustFinish: boolean;
    errorCode: "unavailable" | "load_failed" | null;
    currentTimeSeconds: number;
    durationSeconds: number;
};

const playbackListeners = new Set<() => void>();

let currentPlayer: any = null;
let currentPlayerSubscription: { remove: () => void } | null = null;
let pendingPlayForMessageId: string | null = null;
let loadingTimeout: ReturnType<typeof setTimeout> | null = null;

let playbackSnapshot: PlaybackSnapshot = {
    activeMessageId: null,
    activeAudioUrl: null,
    isPlaying: false,
    isLoaded: false,
    isBuffering: false,
    didJustFinish: false,
    errorCode: null,
    currentTimeSeconds: 0,
    durationSeconds: 0,
};

function notifyPlaybackListeners() {
    playbackListeners.forEach((listener) => listener());
}

function updatePlaybackSnapshot(partial: Partial<PlaybackSnapshot>) {
    playbackSnapshot = {
        ...playbackSnapshot,
        ...partial,
    };
    notifyPlaybackListeners();
}

function getPlaybackSnapshot() {
    return playbackSnapshot;
}

function subscribeToPlayback(listener: () => void) {
    playbackListeners.add(listener);
    return () => playbackListeners.delete(listener);
}

function clearLoadingTimeout() {
    if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
    }
}

function teardownCurrentPlayer() {
    if (currentPlayerSubscription) {
        currentPlayerSubscription.remove();
        currentPlayerSubscription = null;
    }
    if (currentPlayer) {
        try {
            currentPlayer.pause();
        } catch {
            // Best effort.
        }
        try {
            currentPlayer.remove();
        } catch {
            // Best effort.
        }
        currentPlayer = null;
    }
}

async function stopSharedPlayback() {
    pendingPlayForMessageId = null;
    clearLoadingTimeout();
    teardownCurrentPlayer();
    updatePlaybackSnapshot({
        activeMessageId: null,
        activeAudioUrl: null,
        isPlaying: false,
        isLoaded: false,
        isBuffering: false,
        didJustFinish: false,
        errorCode: null,
        currentTimeSeconds: 0,
        durationSeconds: 0,
    });
}

function attachPlayer(player: any) {
    currentPlayerSubscription = player.addListener("playbackStatusUpdate", (status: any) => {
        updatePlaybackSnapshot({
            isPlaying: !!status.playing,
            isLoaded: !!status.isLoaded,
            isBuffering: !!status.isBuffering,
            didJustFinish: !!status.didJustFinish,
            currentTimeSeconds: Number(status.currentTime || 0),
            durationSeconds: Number(status.duration || 0),
            errorCode: null,
        });

        if (status.isLoaded && pendingPlayForMessageId && playbackSnapshot.activeMessageId === pendingPlayForMessageId) {
            if (Number(status.duration || 0) <= 0) {
                Logger.warn("VoicePlayback", "Audio source is unavailable", {
                    activeMessageId: playbackSnapshot.activeMessageId,
                    activeAudioUrl: playbackSnapshot.activeAudioUrl,
                });
                pendingPlayForMessageId = null;
                clearLoadingTimeout();
                teardownCurrentPlayer();
                updatePlaybackSnapshot({
                    isPlaying: false,
                    isLoaded: false,
                    isBuffering: false,
                    errorCode: "unavailable",
                    currentTimeSeconds: 0,
                    durationSeconds: 0,
                });
                return;
            }

            pendingPlayForMessageId = null;
            clearLoadingTimeout();
            player.play();
        }

        if (status.didJustFinish) {
            void stopSharedPlayback();
        }
    });
}

export default function VoiceMessageBubble({
    messageId,
    audioUrl,
    durationMs,
    mine,
}: VoiceMessageBubbleProps) {
    const [snapshot, setSnapshot] = useState<PlaybackSnapshot>(() => getPlaybackSnapshot());

    useEffect(() => {
        const unsubscribe = subscribeToPlayback(() => setSnapshot(getPlaybackSnapshot()));
        return () => {
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        return () => {
            if (getPlaybackSnapshot().activeMessageId === messageId) {
                void stopSharedPlayback();
            }
        };
    }, [messageId]);

    const isActive = snapshot.activeMessageId === messageId;
    const isPlaying = isActive && snapshot.isPlaying;
    const isLoading = isActive && !snapshot.errorCode && (!snapshot.isLoaded || snapshot.isBuffering);
    const hasFailed = isActive && snapshot.errorCode === "load_failed";
    const isUnavailable = isActive && snapshot.errorCode === "unavailable";
    const resolvedDurationMs =
        isActive && snapshot.durationSeconds > 0
            ? Math.round(snapshot.durationSeconds * 1000)
            : durationMs;

    const togglePlayback = async () => {
        if (!audioUrl) {
            Logger.warn("VoicePlayback", "Audio URL missing", { messageId });
            updatePlaybackSnapshot({
                activeMessageId: messageId,
                activeAudioUrl: null,
                errorCode: "unavailable",
                isPlaying: false,
                isLoaded: false,
                isBuffering: false,
            });
            return;
        }

        try {
            await setAudioModeAsync({
                allowsRecording: false,
                playsInSilentMode: true,
                interruptionMode: "doNotMix",
                shouldRouteThroughEarpiece: false,
                shouldPlayInBackground: false,
            });

            if (isActive && isPlaying) {
                currentPlayer?.pause();
                updatePlaybackSnapshot({
                    isPlaying: false,
                    isBuffering: false,
                    errorCode: null,
                });
                return;
            }

            if (isActive && currentPlayer && !hasFailed && !isUnavailable) {
                currentPlayer.play();
                updatePlaybackSnapshot({
                    isPlaying: true,
                    isBuffering: false,
                    errorCode: null,
                });
                return;
            }

            clearLoadingTimeout();
            teardownCurrentPlayer();

            updatePlaybackSnapshot({
                activeMessageId: messageId,
                activeAudioUrl: audioUrl,
                isPlaying: false,
                isLoaded: false,
                isBuffering: true,
                didJustFinish: false,
                errorCode: null,
                currentTimeSeconds: 0,
                durationSeconds: 0,
            });

            pendingPlayForMessageId = messageId;
            const nextPlayer = createAudioPlayer({ uri: audioUrl }, {
                updateInterval: 250,
                downloadFirst: true,
            });
            currentPlayer = nextPlayer;
            attachPlayer(nextPlayer);

            loadingTimeout = setTimeout(() => {
                if (pendingPlayForMessageId === messageId) {
                    Logger.warn("VoicePlayback", "Audio loading timed out", {
                        messageId,
                        audioUrl,
                    });
                    pendingPlayForMessageId = null;
                    teardownCurrentPlayer();
                    updatePlaybackSnapshot({
                        activeMessageId: messageId,
                        activeAudioUrl: audioUrl,
                        isPlaying: false,
                        isLoaded: false,
                        isBuffering: false,
                        errorCode: "unavailable",
                        currentTimeSeconds: 0,
                        durationSeconds: 0,
                    });
                }
            }, 8000);
        } catch (error) {
            Logger.error("VoicePlayback", "Playback failed", error);
            pendingPlayForMessageId = null;
            clearLoadingTimeout();
            teardownCurrentPlayer();
            updatePlaybackSnapshot({
                activeMessageId: messageId,
                activeAudioUrl: audioUrl,
                isPlaying: false,
                isLoaded: false,
                isBuffering: false,
                errorCode: "load_failed",
                currentTimeSeconds: 0,
                durationSeconds: 0,
            });
        }
    };

    return (
        <View style={styles.voiceCard}>
            <Pressable
                onPress={togglePlayback}
                disabled={!audioUrl || isUnavailable}
                hitSlop={10}
                style={[
                    styles.voiceButton,
                    !mine && styles.voiceButtonOther,
                    hasFailed && styles.voiceButtonFailed,
                    (isUnavailable || !audioUrl) && styles.voiceButtonDisabled,
                ]}
            >
                {isLoading ? (
                    <ActivityIndicator size="small" color={mine ? "#fff" : COLORS.accent} />
                ) : (
                    <AppIcon
                        name={isUnavailable ? "block" : hasFailed ? "refresh" : isPlaying ? "pause" : "play-arrow"}
                        size={18}
                        color={mine ? "#fff" : COLORS.accent}
                    />
                )}
            </Pressable>
            <View style={styles.waveform}>
                {BARS.map((height, index) => (
                    <View
                        key={`${height}-${index}`}
                        style={[
                            styles.waveformBar,
                            !mine && styles.waveformBarOther,
                            isActive && styles.waveformBarActive,
                            hasFailed && styles.waveformBarFailed,
                            {
                                height,
                                opacity: isPlaying ? 1 : 0.68,
                            },
                        ]}
                    />
                ))}
            </View>
            <View style={styles.voiceMeta}>
                <Text style={mine ? styles.voiceDurationMine : styles.voiceDurationOther}>
                    {formatVoiceDuration(resolvedDurationMs)}
                </Text>
                {isUnavailable ? (
                    <Text style={mine ? styles.voiceStatusMine : styles.voiceStatusOther}>Unavailable</Text>
                ) : hasFailed ? (
                    <Text style={mine ? styles.voiceStatusMine : styles.voiceStatusOther}>Retry</Text>
                ) : isLoading ? (
                    <Text style={mine ? styles.voiceStatusMine : styles.voiceStatusOther}>Loading</Text>
                ) : isActive && !isPlaying ? (
                    <Text style={mine ? styles.voiceStatusMine : styles.voiceStatusOther}>Paused</Text>
                ) : null}
            </View>
        </View>
    );
}

const BARS = [18, 12, 22, 14, 24, 11, 20, 16, 25, 13, 18];
