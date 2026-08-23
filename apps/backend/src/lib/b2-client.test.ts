import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  B2Client,
  ALLOWED_TYPES,
  MAX_SIZE,
  getImageStorage,
  InMemoryImageStorage,
  B2ImageStorage,
  _resetImageStorageForTest,
  resolveCandidateImageUrl,
} from "./b2-client";

const { mockB2Constructor } = vi.hoisted(() => ({ mockB2Constructor: vi.fn() }));

// Mock the B2 SDK
vi.mock("backblaze-b2", () => {
  mockB2Constructor.mockImplementation(() => ({
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
  }));
  return { default: mockB2Constructor };
});

describe("B2Client", () => {
  let client: B2Client;

  beforeEach(() => {
    mockB2Constructor.mockClear();
    client = new B2Client({
      applicationKeyId: "test-key-id",
      applicationKey: "test-key",
      bucketName: "test-bucket",
      publicBaseUrl: "https://test.b2.com/file",
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
    expect(result.code).toBe("FILE_TOO_LARGE");
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

describe("getImageStorage", () => {
  const validConfig = {
    B2_APPLICATION_KEY_ID: "key-id",
    B2_APPLICATION_KEY: "key",
    B2_BUCKET_NAME: "bucket",
    B2_PUBLIC_BASE_URL: "https://b2.com",
  };

  it("should return B2ImageStorage when all credentials are provided", () => {
    const storage = getImageStorage(validConfig);
    expect(storage).toBeInstanceOf(B2ImageStorage);
  });

  it("should force in-memory storage in offline development", () => {
    _resetImageStorageForTest();
    mockB2Constructor.mockClear();
    const storage = getImageStorage({ ...validConfig, OFFLINE_DEV: true });
    expect(storage).toBeInstanceOf(InMemoryImageStorage);
    expect(mockB2Constructor).not.toHaveBeenCalled();
  });

  it("should expose offline uploads through the local candidate image route", async () => {
    const storage = getImageStorage({ ...validConfig, OFFLINE_DEV: true });
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "image.jpg", {
      type: "image/jpeg",
    });

    const uploaded = await storage.upload("candidate-123", file);

    expect(uploaded.url).toMatch(/^\/candidates\/candidate-123\/image\?v=[0-9a-f-]+$/);
    await expect(storage.download(uploaded.url)).resolves.toMatchObject({
      contentType: "image/jpeg",
    });
    await expect(storage.delete(uploaded.url)).resolves.toBeUndefined();
    await expect(storage.download(uploaded.url)).rejects.toThrow("File not found");
  });

  it("should version local image URLs when replacing an upload", async () => {
    const storage = new InMemoryImageStorage();
    const first = await storage.upload(
      "candidate-123",
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "first.jpg", {
        type: "image/jpeg",
      }),
    );
    const second = await storage.upload(
      "candidate-123",
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "second.png", {
        type: "image/png",
      }),
    );

    expect(second.url).not.toBe(first.url);
    await expect(storage.download(first.url)).rejects.toThrow("File not found");
    await expect(storage.download(second.url)).resolves.toMatchObject({
      contentType: "image/png",
    });
  });

  it("should resolve local candidate image URLs to the API origin", () => {
    expect(
      resolveCandidateImageUrl(
        "/candidates/candidate-123/image?v=version",
        "candidate-123",
        {
          B2_BUCKET_NAME: "bucket",
          B2_PUBLIC_ACCESS: false,
          B2_PUBLIC_BASE_URL: "https://b2.example/file",
        },
        "http://localhost:8787/candidates/candidate-123",
      ),
    ).toBe("http://localhost:8787/candidates/candidate-123/image?v=version");
  });

  it("should return InMemoryImageStorage when credentials are missing in non-production", () => {
    const storage = getImageStorage({ ...validConfig, B2_APPLICATION_KEY: undefined });
    expect(storage).toBeInstanceOf(InMemoryImageStorage);
  });

  it("should throw an error when credentials are missing in production", () => {
    expect(() =>
      getImageStorage({
        ...validConfig,
        B2_APPLICATION_KEY: undefined,
        NODE_ENV: "production",
      }),
    ).toThrow("Missing required Backblaze B2 environment variables in production");
  });

  it("should throw an error when credentials are missing in staging", () => {
    expect(() =>
      getImageStorage({
        ...validConfig,
        B2_APPLICATION_KEY: undefined,
        NODE_ENV: "staging",
      }),
    ).toThrow("Missing required Backblaze B2 environment variables in staging");
  });

  it("should return the same InMemoryImageStorage instance across calls in non-production", () => {
    // Singleton: dev uploads must persist between requests within the same process.
    const cfg = { ...validConfig, B2_APPLICATION_KEY: undefined };
    const a = getImageStorage(cfg);
    const b = getImageStorage(cfg);
    expect(a).toBe(b);
  });

  it("_resetImageStorageForTest clears the singleton so the next call returns a new instance", () => {
    const cfg = { ...validConfig, B2_APPLICATION_KEY: undefined };
    const before = getImageStorage(cfg);
    _resetImageStorageForTest();
    const after = getImageStorage(cfg);
    expect(after).toBeInstanceOf(InMemoryImageStorage);
    expect(after).not.toBe(before);
  });
});
