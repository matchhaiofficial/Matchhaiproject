import { Id } from "../../../convex/_generated/dataModel";

type UploadFileInput = {
    uri: string;
    mimeType: string;
    fileName: string;
    generateUploadUrl: () => Promise<string>;
};

export async function uploadFileToConvex({
    uri,
    mimeType,
    generateUploadUrl,
}: UploadFileInput): Promise<{ storageId: Id<"_storage">; url: string | null }> {
    const uploadUrl = await generateUploadUrl();

    const localFileResponse = await fetch(uri);
    if (!localFileResponse.ok) {
        throw new Error("Failed to read local file for upload.");
    }

    const fileBlob = await localFileResponse.blob();

    const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
            "Content-Type": mimeType || fileBlob.type || "application/octet-stream",
        },
        body: fileBlob,
    });

    if (!response.ok) {
        throw new Error("File upload failed.");
    }

    const payload = await response.json();
    const storageId = payload.storageId as Id<"_storage">;
    return { storageId, url: null };
}
