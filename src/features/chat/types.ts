export type ChatAttachment = {
    storageId: string;
    url?: string | null;
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    width?: number;
    height?: number;
};

export type ChatReaction = {
    emoji: string;
    userId: string;
    createdAt: number;
};

export type ChatThreadMessage = {
    id: string;
    text: string;
    senderUid: string;
    senderName: string;
    createdAt: number;
    type: "text" | "voice" | "image" | "file";
    audioUrl?: string | null;
    audioDurationMs?: number | null;
    attachment?: ChatAttachment | null;
    reactions?: ChatReaction[];
    editedAt?: number | null;
    replyTo?: {
        messageId: string;
        senderName: string;
        snippet: string;
    };
    deletedFor?: string[];
};

export type ChatParticipant = {
    uid: string;
    label: string;
    photoURL?: string | null;
};
