import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    InteractionManager,
    Keyboard,
    KeyboardAvoidingView,
    type KeyboardEvent,
    Linking,
    Modal,
    Platform,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import EmojiPicker from "rn-emoji-keyboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "../../components/AppIcon";
import Screen from "../../components/Screen";
import { COLORS } from "../../theme";
import ChatAttachmentMenu from "./ChatAttachmentMenu";
import ChatPinnedBanner from "./ChatPinnedBanner";
import { ChatReactionPicker, ChatReactionRow } from "./ChatReactionRow";
import SwipeableMessageRow from "./SwipeableMessageRow";
import styles from "./chatThread.styles";
import type { ChatParticipant, ChatSeenReceipt, ChatThreadMessage } from "./types";
import {
    buildSeenLabel,
    formatRelativeChatTime,
    useRelativeNow,
} from "./utils";
import VoiceMessageBubble from "./VoiceMessageBubble";

type ChatThreadProps = {
    title: string;
    subtitle?: string;
    currentUserId?: string | null;
    messages: ChatThreadMessage[];
    participants?: ChatParticipant[];
    loading?: boolean;
    emptyTitle?: string;
    emptySubtitle?: string;
    contextCard?: React.ReactNode;
    input: string;
    onInputChange: (value: string) => void;
    onBack: () => void;
    onSendText: () => void;
    onToggleRecording: () => void;
    sending?: boolean;
    recording?: boolean;
    recordingDurationLabel?: string;
    onMessageLongPress?: (message: ChatThreadMessage) => void;
    onToggleReaction?: (messageId: string, emoji: string) => void;
    replyTo?: ChatThreadMessage | null;
    onClearReply?: () => void;
    seenReceiptsByMessageId?: Record<string, ChatSeenReceipt[]>;
    showComposer?: boolean;
    composerDisabled?: boolean;
    composerPlaceholder?: string;
    composerStatus?: React.ReactNode;
    onPickImage?: () => void;
    onPickFile?: () => void;
    typingNames?: string[];
    // Phase 4 — swipe-to-reply
    onSwipeReply?: (message: ChatThreadMessage) => void;
    // Phase 4 — editing
    editingMessage?: ChatThreadMessage | null;
    onClearEdit?: () => void;
    // Phase 4 — pinned messages
    pinnedMessages?: ChatThreadMessage[];
    onPinMessage?: (messageId: string) => void;
    onUnpinMessage?: (messageId: string) => void;
    canUnpin?: boolean;
    // Phase 4 — presence
    presenceLabel?: string | null;
};

type RenderableChatMessage = ChatThreadMessage & {
    dayLabel: string;
    showDayLabel: boolean;
};

const ANDROID_KEYBOARD_OVERLAY_THRESHOLD = 24;

function formatFileSize(bytes?: number) {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImagePreviewModal({
    uri,
    visible,
    onClose,
}: {
    uri: string | null;
    visible: boolean;
    onClose: () => void;
}) {
    if (!uri) return null;
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent={Platform.OS === "android"}
            navigationBarTranslucent={false}
            onRequestClose={onClose}
        >
            <Pressable style={styles.imagePreviewBackdrop} onPress={onClose}>
                <Image
                    source={{ uri }}
                    style={styles.imagePreviewFull}
                    contentFit="contain"
                    transition={150}
                />
            </Pressable>
        </Modal>
    );
}

const MAX_HEADER_AVATARS = 3;

function initialsFor(label: string) {
    return label.trim().charAt(0).toUpperCase() || "?";
}

function HeaderAvatar({
    participant,
    size = 36,
    borderColor = COLORS.cardDark,
}: {
    participant: ChatParticipant;
    size?: number;
    borderColor?: string;
}) {
    return (
        <View
            style={[
                styles.avatarBase,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderColor,
                },
            ]}
        >
            {participant.photoURL ? (
                <Image
                    source={{ uri: participant.photoURL }}
                    style={{ width: size, height: size, borderRadius: size / 2 }}
                    contentFit="cover"
                    transition={120}
                />
            ) : (
                <Text style={styles.avatarText}>{initialsFor(participant.label)}</Text>
            )}
        </View>
    );
}

function HeaderAvatarStack({ others }: { others: ChatParticipant[] }) {
    if (others.length === 0) {
        return (
            <View style={styles.headerAvatarFallback}>
                <AppIcon name="chat" size={18} color="#fff" />
            </View>
        );
    }

    if (others.length === 1) {
        return <HeaderAvatar participant={others[0]} size={44} />;
    }

    const shown = others.slice(0, MAX_HEADER_AVATARS);
    const overflow = others.length - shown.length;

    return (
        <View style={styles.headerAvatarStack}>
            {shown.map((participant, index) => (
                <View
                    key={participant.uid}
                    style={[styles.headerAvatarStackItem, index > 0 && styles.headerAvatarStackItemOffset]}
                >
                    <HeaderAvatar participant={participant} size={36} />
                </View>
            ))}
            {overflow > 0 ? (
                <View style={[styles.headerAvatarStackItem, styles.headerAvatarStackItemOffset, styles.headerAvatarOverflow]}>
                    <Text style={styles.headerAvatarOverflowText}>+{overflow}</Text>
                </View>
            ) : null}
        </View>
    );
}

function TypingBubble({ label = "typing" }: { label?: string }) {
    const [dotCount, setDotCount] = useState(1);

    useEffect(() => {
        const timer = setInterval(() => {
            setDotCount((current) => (current >= 3 ? 1 : current + 1));
        }, 450);
        return () => clearInterval(timer);
    }, []);

    return (
        <View style={styles.typingBubbleRow}>
            <View style={styles.typingBubble}>
                <Text style={styles.typingBubbleText}>
                    {label}
                    {".".repeat(dotCount)}
                </Text>
            </View>
        </View>
    );
}

function FormattedMessageText({ text, mine }: { text: string; mine: boolean }) {
    const textStyle = mine ? styles.bubbleTextMine : styles.bubbleTextOther;
    const lines = String(text || "").split("\n");
    return (
        <View>
            {lines.map((line, index) => {
                const trimmed = line.trim();
                const bullet = trimmed.match(/^[-•]\s+(.*)$/);
                if (!trimmed) {
                    return <View key={`space-${index}`} style={styles.messageLineGap} />;
                }
                return (
                    <Text key={`${trimmed}-${index}`} style={[textStyle, bullet && styles.messageBulletLine]}>
                        {bullet ? `• ${bullet[1]}` : trimmed}
                    </Text>
                );
            })}
        </View>
    );
}

function SupportMatchroomCards({ cards }: { cards?: ChatThreadMessage["supportCards"] }) {
    const matchrooms = cards?.matchrooms || [];
    if (!matchrooms.length) return null;
    return (
        <View style={styles.supportCardsWrap}>
            {matchrooms.slice(0, 3).map((room) => (
                <View key={room.id} style={styles.supportMatchroomCard}>
                    <View style={styles.supportCardHeader}>
                        <Text style={styles.supportCardTitle} numberOfLines={1}>
                            {room.title || "Matchroom"}
                        </Text>
                        {room.status ? <Text style={styles.supportCardStatus}>{room.status}</Text> : null}
                    </View>
                    <View style={styles.supportCardMetaGrid}>
                        {room.game ? <Text style={styles.supportCardMeta}>Game: {room.game}</Text> : null}
                        {room.scheduledAt ? <Text style={styles.supportCardMeta}>Time: {new Date(room.scheduledAt).toLocaleString()}</Text> : null}
                        {room.bookingStatus ? <Text style={styles.supportCardMeta}>Booking: {room.bookingStatus}</Text> : null}
                        {room.paymentStatus ? <Text style={styles.supportCardMeta}>Payment: {room.paymentStatus}</Text> : null}
                        {room.resultStatus ? <Text style={styles.supportCardMeta}>Result: {room.resultStatus}</Text> : null}
                    </View>
                </View>
            ))}
        </View>
    );
}

const ChatMessageRow = React.memo(function ChatMessageRow({
    item,
    todayLabel,
    currentUserId,
    latestOutgoingMessageId,
    seenReceipts,
    otherParticipantCount,
    onMessageLongPress,
    onToggleReaction,
    onPreviewImage,
    onSwipeReply,
    activeReactionMessageId,
    onToggleReactionPicker,
    onDismissReactionPicker,
    nowMs,
}: {
    item: RenderableChatMessage;
    todayLabel: string;
    currentUserId: string | null | undefined;
    latestOutgoingMessageId: string | null;
    seenReceipts: ChatSeenReceipt[];
    otherParticipantCount: number;
    onMessageLongPress?: (message: ChatThreadMessage) => void;
    onToggleReaction?: (messageId: string, emoji: string) => void;
    onPreviewImage?: (uri: string) => void;
    onSwipeReply?: (message: ChatThreadMessage) => void;
    activeReactionMessageId: string | null;
    onToggleReactionPicker: (messageId: string) => void;
    onDismissReactionPicker: () => void;
    nowMs: number;
}) {
    const mine = item.senderUid === currentUserId;
    const isDeletedForMe =
        !!currentUserId &&
        Array.isArray(item.deletedFor) &&
        item.deletedFor.includes(currentUserId);

    const showReactionPicker = activeReactionMessageId === item.id;
    const hasOpenReactionPicker = !!activeReactionMessageId;

    const seenLabel = buildSeenLabel(seenReceipts, otherParticipantCount);
    const statusLabel =
        mine && !isDeletedForMe && latestOutgoingMessageId === item.id
            ? seenLabel || "Sent"
            : "";

    const openActions = useCallback(() => {
        onMessageLongPress?.(item);
    }, [item, onMessageLongPress]);

    const relativeTime = useMemo(
        () => formatRelativeChatTime(item.createdAt, nowMs),
        [item.createdAt, nowMs]
    );

    const handleReactionSelect = useCallback(
        (emoji: string) => {
            onToggleReaction?.(item.id, emoji);
        },
        [item.id, onToggleReaction]
    );

    const handleReactionChipToggle = useCallback(
        (emoji: string) => {
            onToggleReaction?.(item.id, emoji);
        },
        [item.id, onToggleReaction]
    );

    const handleSwipeReply = useCallback(() => {
        onSwipeReply?.(item);
    }, [item, onSwipeReply]);

    const handleDotsPress = useCallback((event: any) => {
        event.stopPropagation();
        if (onToggleReaction) {
            onToggleReactionPicker(item.id);
        }
        openActions();
    }, [item.id, onToggleReaction, onToggleReactionPicker, openActions]);

    const handleMessageSurfacePress = useCallback((event: any) => {
        event.stopPropagation();
        if (hasOpenReactionPicker && !showReactionPicker) {
            onDismissReactionPicker();
        }
    }, [hasOpenReactionPicker, onDismissReactionPicker, showReactionPicker]);

    const actionDots = onMessageLongPress || onToggleReaction ? (
        <Pressable
            onPress={handleDotsPress}
            hitSlop={10}
            style={styles.rowActionDots}
            accessibilityRole="button"
            accessibilityLabel="Message actions"
        >
            <AppIcon name="more-horiz" size={16} color={COLORS.textSecondary} />
        </Pressable>
    ) : null;

    const messageContent = (
        <View>
            {item.showDayLabel ? (
                <View style={styles.dayDivider}>
                    <Text style={styles.dayDividerText}>
                        {item.dayLabel === todayLabel ? "Today" : item.dayLabel}
                    </Text>
                </View>
            ) : null}
            {showReactionPicker && onToggleReaction ? (
                <View style={[styles.reactionPickerWrap, mine ? styles.reactionPickerMine : styles.reactionPickerOther]}>
                    <ChatReactionPicker
                        onSelect={handleReactionSelect}
                        onClose={onDismissReactionPicker}
                    />
                </View>
            ) : null}
            <View style={[styles.row, mine ? styles.rowMine : styles.rowOther]}>
                {mine ? actionDots : null}
                <View style={styles.bubbleWrap}>
                    <Pressable
                        onPress={handleMessageSurfacePress}
                        onLongPress={onMessageLongPress ? openActions : undefined}
                        style={styles.messagePressable}
                    >
                        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                            {item.replyTo ? (
                                <View style={[styles.replyCard, !mine && styles.replyCardOther]}>
                                    <Text style={[styles.replyLabel, mine ? styles.replyLabelMine : styles.replyLabelOther]}>
                                        Replying to {item.replyTo.senderName}
                                    </Text>
                                    <Text
                                        numberOfLines={1}
                                        style={mine ? styles.replySnippetMine : styles.replySnippetOther}
                                    >
                                        {item.replyTo.snippet}
                                    </Text>
                                </View>
                            ) : null}

                            {isDeletedForMe ? (
                                <Text style={styles.deletedText}>Message deleted</Text>
                            ) : item.type === "voice" ? (
                                <VoiceMessageBubble
                                    messageId={item.id}
                                    audioUrl={item.audioUrl}
                                    durationMs={item.audioDurationMs}
                                    mine={mine}
                                />
                            ) : item.type === "image" && item.attachment?.url ? (
                                <Pressable
                                    onPress={(event) => {
                                        event.stopPropagation();
                                        if (hasOpenReactionPicker && !showReactionPicker) {
                                            onDismissReactionPicker();
                                            return;
                                        }
                                        onPreviewImage?.(item.attachment!.url!);
                                    }}
                                >
                                    <Image
                                        source={{ uri: item.attachment.url }}
                                        style={styles.imageBubble}
                                        contentFit="cover"
                                        transition={200}
                                    />
                                    {item.text ? (
                                        <Text style={mine ? styles.bubbleTextMine : styles.bubbleTextOther}>
                                            {item.text}
                                        </Text>
                                    ) : null}
                                </Pressable>
                            ) : item.type === "file" && item.attachment ? (
                                <Pressable
                                    style={styles.fileBubble}
                                    onPress={(event) => {
                                        event.stopPropagation();
                                        if (hasOpenReactionPicker && !showReactionPicker) {
                                            onDismissReactionPicker();
                                            return;
                                        }
                                        if (item.attachment?.url) void Linking.openURL(item.attachment.url);
                                    }}
                                >
                                    <AppIcon name="insert-drive-file" size={28} color={mine ? "#fff" : COLORS.accent} />
                                    <View style={styles.fileBubbleMeta}>
                                        <Text
                                            numberOfLines={1}
                                            style={mine ? styles.fileNameMine : styles.fileNameOther}
                                        >
                                            {item.attachment.fileName || "File"}
                                        </Text>
                                        {item.attachment.sizeBytes ? (
                                            <Text style={mine ? styles.fileSizeMine : styles.fileSizeOther}>
                                                {formatFileSize(item.attachment.sizeBytes)}
                                            </Text>
                                        ) : null}
                                    </View>
                                    <AppIcon name="file-download" size={20} color={mine ? "rgba(255,255,255,0.7)" : COLORS.textSecondary} />
                                </Pressable>
                            ) : (
                                <>
                                    <FormattedMessageText text={item.text} mine={mine} />
                                    {!mine ? <SupportMatchroomCards cards={item.supportCards} /> : null}
                                </>
                            )}
                        </View>
                    </Pressable>
                    {!isDeletedForMe && item.reactions && item.reactions.length > 0 ? (
                        <ChatReactionRow
                            reactions={item.reactions}
                            currentUserId={currentUserId}
                            mine={mine}
                            onToggle={handleReactionChipToggle}
                        />
                    ) : null}
                    <View style={[styles.bubbleFooter, mine ? styles.bubbleFooterMine : styles.bubbleFooterOther]}>
                        <Text style={styles.relativeTimeText}>{relativeTime}</Text>
                        {item.editedAt ? <Text style={styles.editedTag}> · (edited)</Text> : null}
                        {statusLabel ? <Text style={styles.seenText}> · {statusLabel}</Text> : null}
                    </View>
                </View>
                {!mine ? actionDots : null}
            </View>
        </View>
    );

    if (onSwipeReply && !isDeletedForMe) {
        return (
            <SwipeableMessageRow onSwipeReply={handleSwipeReply}>
                {messageContent}
            </SwipeableMessageRow>
        );
    }
    return messageContent;
});

export default function ChatThread({
    title,
    subtitle,
    currentUserId,
    messages,
    participants = [],
    loading = false,
    emptyTitle = "No messages yet",
    emptySubtitle = "Start the conversation.",
    contextCard,
    input,
    onInputChange,
    onBack,
    onSendText,
    onToggleRecording,
    sending = false,
    recording = false,
    recordingDurationLabel = "0:00",
    onMessageLongPress,
    onToggleReaction,
    replyTo,
    onClearReply,
    seenReceiptsByMessageId = {},
    showComposer = true,
    composerDisabled = false,
    composerPlaceholder = "Type message...",
    composerStatus,
    onPickImage,
    onPickFile,
    typingNames = [],
    onSwipeReply,
    editingMessage,
    onClearEdit,
    pinnedMessages = [],
    onPinMessage,
    onUnpinMessage,
    canUnpin = false,
    presenceLabel,
}: ChatThreadProps) {
    const insets = useSafeAreaInsets();
    const listRef = useRef<FlatList<RenderableChatMessage>>(null);
    const isNearBottomRef = useRef(true);
    const hasInitialScrollRef = useRef(false);
    const shouldAutoScrollRef = useRef(false);
    const previousMessageCountRef = useRef(messages.length);
    const didInitialLayoutScrollRef = useRef(false);
    const initialScrollScheduledRef = useRef(false);
    const initialScrollSettledRef = useRef(false);
    const keyboardShellRef = useRef<View | null>(null);
    const keyboardFrameTopRef = useRef<number | null>(null);
    const keyboardMeasureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const nowMs = useRelativeNow(60_000);

    const [emojiOpen, setEmojiOpen] = useState(false);
    const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
    const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
    const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
    const [androidKeyboardInset, setAndroidKeyboardInset] = useState(0);
    const keyboardScrollTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    const handleEmojiSelected = useCallback(
        (emoji: { emoji: string }) => {
            onInputChange(input + emoji.emoji);
        },
        [input, onInputChange]
    );
    const openPreviewImage = useCallback((uri: string) => setPreviewImageUri(uri), []);
    const dismissReactionPicker = useCallback(() => {
        setActiveReactionMessageId(null);
    }, []);
    const toggleReactionPicker = useCallback((messageId: string) => {
        setActiveReactionMessageId((current) => current === messageId ? null : messageId);
    }, []);
    const clearKeyboardMeasureTimer = useCallback(() => {
        if (keyboardMeasureTimerRef.current) {
            clearTimeout(keyboardMeasureTimerRef.current);
            keyboardMeasureTimerRef.current = null;
        }
    }, []);
    const measureAndroidKeyboardOverlap = useCallback((keyboardTop: number | null) => {
        if (Platform.OS !== "android" || !Number.isFinite(keyboardTop)) return;

        keyboardShellRef.current?.measureInWindow((_x, y, _width, height) => {
            const shellBottom = y + height;
            const overlap = Math.max(0, Math.ceil(shellBottom - Number(keyboardTop)));
            setAndroidKeyboardInset(
                overlap > ANDROID_KEYBOARD_OVERLAY_THRESHOLD ? overlap : 0
            );
        });
    }, []);
    const scheduleAndroidKeyboardMeasure = useCallback((event?: KeyboardEvent) => {
        if (Platform.OS !== "android") return;
        const nextKeyboardTop = Number(event?.endCoordinates?.screenY ?? keyboardFrameTopRef.current);
        if (!Number.isFinite(nextKeyboardTop) || nextKeyboardTop <= 0) return;

        keyboardFrameTopRef.current = nextKeyboardTop;
        clearKeyboardMeasureTimer();

        requestAnimationFrame(() => measureAndroidKeyboardOverlap(nextKeyboardTop));
        keyboardMeasureTimerRef.current = setTimeout(() => {
            measureAndroidKeyboardOverlap(nextKeyboardTop);
        }, 80);
    }, [clearKeyboardMeasureTimer, measureAndroidKeyboardOverlap]);
    const handleKeyboardShellLayout = useCallback(() => {
        if (keyboardFrameTopRef.current != null) {
            scheduleAndroidKeyboardMeasure();
        }
    }, [scheduleAndroidKeyboardMeasure]);

    useEffect(() => {
        if (Platform.OS !== "android") return undefined;

        const showSubscription = Keyboard.addListener("keyboardDidShow", scheduleAndroidKeyboardMeasure);
        const frameSubscription = Keyboard.addListener("keyboardDidChangeFrame", scheduleAndroidKeyboardMeasure);
        const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
            keyboardFrameTopRef.current = null;
            clearKeyboardMeasureTimer();
            setAndroidKeyboardInset(0);
        });

        return () => {
            showSubscription.remove();
            frameSubscription.remove();
            hideSubscription.remove();
            clearKeyboardMeasureTimer();
        };
    }, [clearKeyboardMeasureTimer, scheduleAndroidKeyboardMeasure]);

    const groupedMessages = useMemo<RenderableChatMessage[]>(() => {
        return messages.map((message, index) => {
            const previous = messages[index - 1];
            const currentDate = new Date(message.createdAt).toDateString();
            const previousDate = previous ? new Date(previous.createdAt).toDateString() : null;
            return {
                ...message,
                dayLabel: currentDate,
                showDayLabel: currentDate !== previousDate,
            };
        });
    }, [messages]);

    const latestOutgoingMessageId = useMemo(() => {
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            const message = messages[index];
            if (message.senderUid === currentUserId) {
                return message.id;
            }
        }
        return null;
    }, [currentUserId, messages]);

    const otherParticipants = useMemo(
        () => participants.filter((participant) => participant.uid !== currentUserId),
        [currentUserId, participants]
    );
    const otherParticipantCount = otherParticipants.length;

    const todayLabel = useMemo(() => new Date().toDateString(), []);

    const listContentContainerStyle = useMemo(() => {
        return [styles.listContent, { paddingBottom: 8 }];
    }, []);

    const trimmedInput = input.trim();
    const trailingAction = recording
        ? "send"
        : trimmedInput
            ? "send"
            : "mic";
    const trailingActionDisabled = composerDisabled || sending || (!recording && trailingAction === "send" && !trimmedInput);
    const handleTrailingActionPress = () => {
        dismissReactionPicker();
        if (recording) {
            onToggleRecording();
            return;
        }
        if (trimmedInput) {
            onSendText();
            return;
        }
        onToggleRecording();
    };

    useEffect(() => {
        if (messages.length === 0) {
            previousMessageCountRef.current = 0;
            return;
        }

        if (!hasInitialScrollRef.current) {
            shouldAutoScrollRef.current = true;
        } else if (messages.length > previousMessageCountRef.current) {
            const latestMessage = messages[messages.length - 1];
            shouldAutoScrollRef.current =
                isNearBottomRef.current || latestMessage?.senderUid === currentUserId;
        }

        previousMessageCountRef.current = messages.length;
    }, [currentUserId, messages]);

    useEffect(() => {
        setActiveReactionMessageId((current) => {
            if (!current) return null;
            return messages.some((message) => message.id === current) ? current : null;
        });
    }, [messages]);

    const maybeScrollToBottom = useCallback((animated: boolean) => {
        requestAnimationFrame(() => {
            listRef.current?.scrollToEnd({ animated });
        });
    }, []);

    const scrollToLatestMessage = useCallback(() => {
        maybeScrollToBottom(true);
        keyboardScrollTimersRef.current.forEach((timer) => clearTimeout(timer));
        keyboardScrollTimersRef.current = [
            setTimeout(() => maybeScrollToBottom(false), 90),
            setTimeout(() => maybeScrollToBottom(false), 220),
        ];
    }, [maybeScrollToBottom]);

    const ensureInitialScrollToLatest = useCallback(() => {
        if (initialScrollSettledRef.current || initialScrollScheduledRef.current) return;
        if (groupedMessages.length === 0) return;

        const run = () => {
            initialScrollScheduledRef.current = false;
            hasInitialScrollRef.current = true;
            shouldAutoScrollRef.current = false;
            maybeScrollToBottom(false);
            setTimeout(() => maybeScrollToBottom(false), 40);
            setTimeout(() => maybeScrollToBottom(false), 140);
            setTimeout(() => maybeScrollToBottom(false), 300);
            setTimeout(() => {
                maybeScrollToBottom(false);
                initialScrollSettledRef.current = true;
            }, 600);
        };

        initialScrollScheduledRef.current = true;
        InteractionManager.runAfterInteractions(run);
    }, [groupedMessages.length, maybeScrollToBottom]);

    useEffect(() => {
        ensureInitialScrollToLatest();
    }, [ensureInitialScrollToLatest]);

    useEffect(() => {
        const onKeyboardShow = () => {
            scrollToLatestMessage();
        };

        const subShow = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
            onKeyboardShow
        );

        return () => {
            subShow.remove();
            keyboardScrollTimersRef.current.forEach((timer) => clearTimeout(timer));
            keyboardScrollTimersRef.current = [];
        };
    }, [scrollToLatestMessage]);

    const handleContentSizeChange = useCallback(() => {
        if (!initialScrollSettledRef.current) {
            ensureInitialScrollToLatest();
            return;
        }

        if (shouldAutoScrollRef.current) {
            shouldAutoScrollRef.current = false;
            maybeScrollToBottom(true);
        }
    }, [ensureInitialScrollToLatest, maybeScrollToBottom]);

    const handleListLayout = useCallback(() => {
        if (didInitialLayoutScrollRef.current) return;
        didInitialLayoutScrollRef.current = true;
        ensureInitialScrollToLatest();
    }, [ensureInitialScrollToLatest]);

    const handleScroll = useCallback((event: any) => {
        if (activeReactionMessageId) {
            dismissReactionPicker();
        }
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const distanceFromBottom =
            contentSize.height - (contentOffset.y + layoutMeasurement.height);
        isNearBottomRef.current = distanceFromBottom < 96;
    }, [activeReactionMessageId, dismissReactionPicker]);

    const keyExtractor = useCallback((item: RenderableChatMessage) => item.id, []);

    const renderItem = useCallback(({ item }: { item: RenderableChatMessage }) => {
        return (
            <ChatMessageRow
                item={item}
                todayLabel={todayLabel}
                currentUserId={currentUserId}
                latestOutgoingMessageId={latestOutgoingMessageId}
                seenReceipts={seenReceiptsByMessageId[item.id] || []}
                otherParticipantCount={otherParticipantCount}
                onMessageLongPress={onMessageLongPress}
                onToggleReaction={onToggleReaction}
                onPreviewImage={openPreviewImage}
                onSwipeReply={onSwipeReply}
                activeReactionMessageId={activeReactionMessageId}
                onToggleReactionPicker={toggleReactionPicker}
                onDismissReactionPicker={dismissReactionPicker}
                nowMs={nowMs}
            />
        );
    }, [
        currentUserId,
        latestOutgoingMessageId,
        nowMs,
        onMessageLongPress,
        onSwipeReply,
        onToggleReaction,
        activeReactionMessageId,
        dismissReactionPicker,
        openPreviewImage,
        otherParticipantCount,
        seenReceiptsByMessageId,
        todayLabel,
        toggleReactionPicker,
    ]);

    // Bottom padding for the composer: respect gesture-nav inset, but don't add
    // artificial extra space on phones with hardware buttons (insets.bottom === 0).
    const composerBottomPadding = Math.max(insets.bottom, Platform.OS === "ios" ? 4 : 0) + 8;
    const keyboardContentStyle = useMemo(
        () => [
            styles.keyboardContent,
            androidKeyboardInset > 0 && { paddingBottom: androidKeyboardInset },
        ],
        [androidKeyboardInset]
    );

    return (
        <Screen style={styles.screen} scroll={false} contentStyle={styles.screenContent}>
            <GestureHandlerRootView style={styles.flex1}>
                <View style={styles.shell}>
                    <View style={styles.shellSurface}>
                        {/* ── Header ── */}
                        <View style={styles.header}>
                            <Pressable onPress={onBack} style={styles.headerAction} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back">
                                <AppIcon name="arrow-back" size={20} color={COLORS.text} />
                            </Pressable>
                            <View style={styles.headerAvatarWrap}>
                                <HeaderAvatarStack others={otherParticipants} />
                            </View>
                            <View style={styles.flex1}>
                                <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
                                {typingNames.length > 0 ? (
                                    <Text style={styles.headerTypingSubtitle} numberOfLines={1}>
                                        {typingNames.length === 1
                                            ? `${typingNames[0]} is typing\u2026`
                                            : `${typingNames.slice(0, 2).join(", ")} typing\u2026`}
                                    </Text>
                                ) : presenceLabel ? (
                                    <Text style={styles.headerPresenceSubtitle} numberOfLines={1}>{presenceLabel}</Text>
                                ) : subtitle ? (
                                    <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text>
                                ) : null}
                            </View>
                        </View>

                        {/*
                         * Android uses the native resize mode from app.json. Pairing that with
                         * KeyboardAvoidingView height/pan causes the full chat surface to jump.
                         */}
                        <KeyboardAvoidingView
                            style={styles.keyboardShell}
                            behavior={Platform.OS === "ios" ? "padding" : undefined}
                            keyboardVerticalOffset={Platform.OS === "ios" ? 84 : undefined}
                        >
                            <View
                                ref={keyboardShellRef}
                                onLayout={handleKeyboardShellLayout}
                                style={keyboardContentStyle}
                            >
                            <View style={styles.threadContent}>
                                {pinnedMessages.length > 0 ? (
                                    <ChatPinnedBanner
                                        pinnedMessages={pinnedMessages}
                                        onUnpin={onUnpinMessage}
                                        canUnpin={canUnpin}
                                    />
                                ) : null}
                                {loading ? (
                                    <View style={styles.emptyState}>
                                        <ActivityIndicator color={COLORS.accent} />
                                    </View>
                                ) : (
                                    <Pressable
                                        style={styles.messageListDismissLayer}
                                        onPress={dismissReactionPicker}
                                        disabled={!activeReactionMessageId}
                                    >
                                        <FlatList<RenderableChatMessage>
                                            ref={listRef}
                                            style={styles.messageList}
                                            data={groupedMessages}
                                            keyExtractor={keyExtractor}
                                            contentContainerStyle={listContentContainerStyle}
                                            keyboardShouldPersistTaps="always"
                                            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                                            onContentSizeChange={handleContentSizeChange}
                                            onLayout={handleListLayout}
                                            onScroll={handleScroll}
                                            scrollEventThrottle={16}
                                            renderItem={renderItem}
                                            ListHeaderComponent={
                                                contextCard ? <View style={styles.contextCard}>{contextCard}</View> : undefined
                                            }
                                            ListEmptyComponent={
                                                <View style={styles.emptyState}>
                                                    <AppIcon name="forum" size={38} color="#94a3b8" />
                                                    <Text style={styles.emptyTitle}>{emptyTitle}</Text>
                                                    <Text style={styles.emptySubtitle}>{emptySubtitle}</Text>
                                                </View>
                                            }
                                            ListFooterComponent={
                                                typingNames.length > 0 ? (
                                                    <TypingBubble
                                                        label={
                                                            typingNames.length === 1
                                                                ? `${typingNames[0]} is typing`
                                                                : `${typingNames.slice(0, 2).join(", ")} typing`
                                                        }
                                                    />
                                                ) : null
                                            }
                                        />
                                    </Pressable>
                                )}
                            </View>

                            {showComposer ? (
                                    <View
                                        style={[
                                            styles.composerShell,
                                            { paddingBottom: composerBottomPadding },
                                        ]}
                                    >
                                        <View style={styles.composerContent}>
                                            {editingMessage ? (
                                                <View style={styles.composerEditBanner}>
                                                    <AppIcon name="edit" size={14} color={COLORS.accent} />
                                                    <View style={styles.flex1}>
                                                        <Text style={styles.composerReplyTitle}>Editing message</Text>
                                                        <Text style={styles.composerReplyText} numberOfLines={1}>
                                                            {editingMessage.text}
                                                        </Text>
                                                    </View>
                                                    <Pressable onPress={onClearEdit} style={styles.headerAction} hitSlop={8}>
                                                        <AppIcon name="close" size={16} color={COLORS.textSecondary} />
                                                    </Pressable>
                                                </View>
                                            ) : replyTo ? (
                                                <View style={styles.composerReply}>
                                                    <View style={styles.flex1}>
                                                        <Text style={styles.composerReplyTitle}>Replying to {replyTo.senderName}</Text>
                                                        <Text style={styles.composerReplyText} numberOfLines={1}>
                                                            {replyTo.type === "voice" ? "Voice message" : replyTo.text}
                                                        </Text>
                                                    </View>
                                                    <Pressable onPress={onClearReply} style={styles.headerAction} hitSlop={8}>
                                                        <AppIcon name="close" size={16} color={COLORS.textSecondary} />
                                                    </Pressable>
                                                </View>
                                            ) : null}

                                            {composerStatus ? composerStatus : null}

                                            {recording ? (
                                                <View style={styles.recordingPill}>
                                                    <Text style={styles.recordingText}>
                                                        Recording... {recordingDurationLabel}
                                                    </Text>
                                                </View>
                                            ) : null}

                                            <View style={styles.composerRow}>
                                                {(onPickImage || onPickFile) ? (
                                                    <Pressable
                                                        onPress={() => {
                                                            dismissReactionPicker();
                                                            setAttachmentMenuOpen(true);
                                                        }}
                                                        style={styles.composerIconAction}
                                                        accessibilityRole="button"
                                                        accessibilityLabel="Attach file"
                                                    >
                                                        <AppIcon name="add" size={22} color={COLORS.accent} />
                                                    </Pressable>
                                                ) : null}

                                                <View style={styles.composerInputWrap}>
                                                    <TextInput
                                                        value={input}
                                                        onChangeText={onInputChange}
                                                        style={styles.composerInput}
                                                        placeholder={composerPlaceholder}
                                                        placeholderTextColor={COLORS.textSecondary}
                                                        editable={!composerDisabled && !sending}
                                                        onFocus={() => {
                                                            dismissReactionPicker();
                                                            scrollToLatestMessage();
                                                        }}
                                                        multiline
                                                    />
                                                    <Pressable
                                                        onPress={() => {
                                                            dismissReactionPicker();
                                                            setEmojiOpen(true);
                                                        }}
                                                        disabled={composerDisabled || sending}
                                                        style={styles.composerEmojiAction}
                                                        accessibilityRole="button"
                                                        accessibilityLabel="Emoji picker"
                                                    >
                                                        <AppIcon name="mood" size={22} color={COLORS.textSecondary} />
                                                    </Pressable>
                                                </View>

                                                <Pressable
                                                    onPress={handleTrailingActionPress}
                                                    disabled={trailingActionDisabled}
                                                    style={({ pressed }) => [
                                                        styles.composerSendAction,
                                                        trailingAction === "send" && styles.composerSendActionActive,
                                                        trailingAction === "mic" && recording && styles.recordActive,
                                                        trailingActionDisabled && styles.composerSendActionDisabled,
                                                        pressed && { opacity: 0.88 },
                                                    ]}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={
                                                        trailingAction === "send"
                                                            ? "Send message"
                                                            : recording
                                                                ? "Stop recording"
                                                                : "Record voice message"
                                                    }
                                                >
                                                    {sending ? (
                                                        <ActivityIndicator
                                                            color={trailingAction === "send" ? "#fff" : COLORS.accent}
                                                        />
                                                    ) : (
                                                        <AppIcon
                                                            name={trailingAction === "send" ? "send" : "keyboard-voice"}
                                                            size={20}
                                                            color={
                                                                trailingAction === "send"
                                                                    ? "#fff"
                                                                    : recording
                                                                        ? COLORS.error
                                                                        : COLORS.accent
                                                            }
                                                        />
                                                    )}
                                                </Pressable>
                                            </View>
                                            </View>
                                    </View>
                            ) : null}
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                </View>
                <ImagePreviewModal
                    uri={previewImageUri}
                    visible={!!previewImageUri}
                    onClose={() => setPreviewImageUri(null)}
                />
                {(onPickImage || onPickFile) ? (
                    <ChatAttachmentMenu
                        visible={attachmentMenuOpen}
                        onClose={() => setAttachmentMenuOpen(false)}
                        onPickImage={onPickImage || (() => undefined)}
                        onPickFile={onPickFile || (() => undefined)}
                    />
                ) : null}
                <EmojiPicker
                    open={emojiOpen}
                    onClose={() => setEmojiOpen(false)}
                    onEmojiSelected={handleEmojiSelected}
                    allowMultipleSelections
                />
            </GestureHandlerRootView>
        </Screen>
    );
}
