import { uploadFileToConvex } from "../../src/services/convex/storageService";

describe("storage upload service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses the caller's resource-authorized upload URL and performs no URL lookup", async () => {
    const generateUploadUrl = jest.fn().mockResolvedValue("https://upload.example.test");
    const fileBlob = { type: "image/jpeg" } as Blob;
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        blob: jest.fn().mockResolvedValue(fileBlob),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ storageId: "storage:new-file" }),
      } as unknown as Response);

    await expect(uploadFileToConvex({
      uri: "file:///profile.jpg",
      mimeType: "image/jpeg",
      fileName: "profile.jpg",
      generateUploadUrl,
    })).resolves.toEqual({
      storageId: "storage:new-file",
      url: null,
    });

    expect(generateUploadUrl).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://upload.example.test", {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: fileBlob,
    });
  });
});
