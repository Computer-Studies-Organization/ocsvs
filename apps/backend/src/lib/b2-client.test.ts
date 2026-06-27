import { describe, expect, it, vi, beforeEach } from "vitest";
import { B2Client, ALLOWED_TYPES, MAX_SIZE } from "./b2-client";

// Mock the B2 SDK
vi.mock("backblaze-b2", () => ({
  default: vi.fn().mockImplementation(() => ({
    authorize: vi.fn().mockResolvedValue({ data: {} }),
    listBuckets: vi.fn().mockResolvedValue({
      data: {
        buckets: [{ bucketId: "test-bucket-id", bucketName: "test-bucket" }],
      },
    }),
    getUploadUrl: vi.fn().mockResolvedValue({
      data: { uploadUrl: "https://test.upload.url", authorizationToken: "test-token" },
    }),
    uploadFile: vi.fn().mockResolvedValue({
      data: { fileId: "test-file-id", fileName: "test.jpg" },
    }),
    listFileNames: vi.fn().mockResolvedValue({
      data: {
        files: [{ fileName: "candidates/candidate-123/test.jpg", fileId: "test-file-id" }],
      },
    }),
    deleteFileVersion: vi.fn().mockResolvedValue({ data: {} }),
  })),
}));

describe("B2Client", () => {
  let client: B2Client;

  beforeEach(() => {
    client = new B2Client({
      applicationKeyId: "test-key-id",
      applicationKey: "test-key",
      bucketName: "test-bucket",
    });
  });

  it("should validate allowed file types", () => {
    expect(ALLOWED_TYPES).toContain("image/jpeg");
    expect(ALLOWED_TYPES).toContain("image/png");
    expect(ALLOWED_TYPES).toContain("image/webp");
  });

  it("should enforce 5MB size limit", () => {
    expect(MAX_SIZE).toBe(5 * 1024 * 1024);
  });

  it("should reject invalid file type", () => {
    const result = client.validateFile({ size: 100, type: "application/pdf" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid file type");
  });

  it("should reject file exceeding size limit", () => {
    const result = client.validateFile({ size: MAX_SIZE + 1, type: "image/jpeg" });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("File too large");
  });

  it("should accept valid file", () => {
    const result = client.validateFile({ size: 1024, type: "image/jpeg" });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should upload file and return URL", async () => {
    const file = Buffer.from("test image data");
    const result = await client.uploadImage("candidate-123", file, "image/jpeg", "test.jpg");

    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("key");
    expect(result.key).toContain("candidates/candidate-123/");
    expect(result.key).toMatch(/\.jpg$/);
  });

  it("should use UUID-based keys to avoid collisions", async () => {
    const file = Buffer.from("test image data");
    const result1 = await client.uploadImage("candidate-123", file, "image/jpeg", "a.jpg");
    const result2 = await client.uploadImage("candidate-123", file, "image/jpeg", "a.jpg");

    expect(result1.key).not.toBe(result2.key);
    expect(result1.key).toContain("candidates/candidate-123/");
    expect(result2.key).toContain("candidates/candidate-123/");
  });

  it("should preserve extension from filename", async () => {
    const file = Buffer.from("test image data");
    const result = await client.uploadImage("candidate-123", file, "image/png", "photo.png");
    expect(result.key).toMatch(/\.png$/);
  });

  it("should default to jpg when no extension", async () => {
    const file = Buffer.from("test image data");
    const result = await client.uploadImage("candidate-123", file, "image/jpeg", "noext");
    expect(result.key).toMatch(/\.jpg$/);
  });

  it("should delete file by key", async () => {
    await expect(client.deleteImage("candidates/candidate-123/test.jpg")).resolves.not.toThrow();
  });

  describe("validateMagicBytes", () => {
    it("should accept valid JPEG magic bytes", () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const result = client.validateMagicBytes(buffer, "image/jpeg");
      expect(result.valid).toBe(true);
    });

    it("should accept valid PNG magic bytes", () => {
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const result = client.validateMagicBytes(buffer, "image/png");
      expect(result.valid).toBe(true);
    });

    it("should accept valid WebP magic bytes (RIFF and WEBP)", () => {
      const buffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);
      const result = client.validateMagicBytes(buffer, "image/webp");
      expect(result.valid).toBe(true);
    });

    it("should reject HTML content declared as image/jpeg", () => {
      const buffer = Buffer.from("<html><body>alert(1)</body></html>");
      const result = client.validateMagicBytes(buffer, "image/jpeg");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("does not match declared type");
    });

    it("should reject empty buffer", () => {
      const buffer = Buffer.alloc(0);
      const result = client.validateMagicBytes(buffer, "image/jpeg");
      expect(result.valid).toBe(false);
    });

    it("should reject unsupported MIME type", () => {
      const buffer = Buffer.from([0xff, 0xd8, 0xff]);
      const result = client.validateMagicBytes(buffer, "image/gif");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Unsupported file type");
    });
  });
});
