import B2 from "backblaze-b2";

export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const MAGIC_BYTES: Readonly<
  Record<Exclude<(typeof ALLOWED_TYPES)[number], "image/webp">, number[][]>
> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
};

export interface B2Config {
  applicationKeyId: string;
  applicationKey: string;
  bucketName: string;
  /** Public download URL prefix, e.g. `https://f003.backblazeb2.com/file`. */
  publicBaseUrl: string;
}

export interface UploadResult {
  url: string;
  key: string;
}

export class B2Client {
  private b2: InstanceType<typeof B2>;
  private bucketName: string;
  private bucketId: string | null = null;
  private authorized = false;
  private publicBaseUrl: string;

  constructor(config: B2Config) {
    this.b2 = new B2({
      applicationKeyId: config.applicationKeyId,
      applicationKey: config.applicationKey,
    });
    this.bucketName = config.bucketName;
    this.publicBaseUrl = config.publicBaseUrl;
  }

  private async ensureAuthorized(): Promise<void> {
    if (!this.authorized) {
      const response = await this.b2.authorize();
      this.authorized = true;

      const allowed = response.data?.allowed;
      if (allowed && allowed.bucketId) {
        if (allowed.bucketName && allowed.bucketName !== this.bucketName) {
          throw new Error(
            `Key is restricted to bucket "${allowed.bucketName}", but configured to use "${this.bucketName}"`,
          );
        }
        this.bucketId = allowed.bucketId;
      }
    }
    if (!this.bucketId) {
      const response = await this.b2.listBuckets();
      const responseData = response.data as {
        buckets: Array<{ bucketId: string; bucketName: string }>;
      };
      const bucket = responseData.buckets.find((b) => b.bucketName === this.bucketName);
      if (!bucket) {
        throw new Error(`B2 bucket "${this.bucketName}" not found`);
      }
      this.bucketId = bucket.bucketId;
    }
  }

  private generateKey(candidateId: string, filename: string): string {
    const parts = filename.split(".");
    const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : "jpg";
    const uuid = crypto.randomUUID();
    return `candidates/${candidateId}/${uuid}.${ext}`;
  }

  validateFile(file: { size: number; type: string }): { valid: boolean; error?: string } {
    if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
      return {
        valid: false,
        error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}`,
      };
    }

    if (file.size > MAX_SIZE) {
      return {
        valid: false,
        error: `File too large. Maximum size: ${MAX_SIZE / 1024 / 1024}MB`,
      };
    }

    return { valid: true };
  }

  /**
   * Validates that the file content matches the declared MIME type by checking
   * magic bytes (file signatures). Catches spoofed Content-Type headers.
   */
  validateMagicBytes(buffer: Buffer, declaredType: string): { valid: boolean; error?: string } {
    if (declaredType === "image/webp") {
      if (buffer.length < 12) {
        return {
          valid: false,
          error: `File content does not match declared type ${declaredType}`,
        };
      }
      const isRiff =
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
      const isWebp =
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
      if (!isRiff || !isWebp) {
        return {
          valid: false,
          error: `File content does not match declared type ${declaredType}`,
        };
      }
      return { valid: true };
    }

    const expected = MAGIC_BYTES[declaredType as keyof typeof MAGIC_BYTES];
    if (!expected) {
      return { valid: false, error: `Unsupported file type: ${declaredType}` };
    }

    const matches = expected.some((sig) => sig.every((byte, i) => buffer[i] === byte));
    if (!matches) {
      return {
        valid: false,
        error: `File content does not match declared type ${declaredType}`,
      };
    }

    return { valid: true };
  }

  async uploadImage(
    candidateId: string,
    file: Buffer,
    contentType: string,
    filename: string,
  ): Promise<UploadResult> {
    await this.ensureAuthorized();

    const key = this.generateKey(candidateId, filename);

    const uploadUrl = await this.b2.getUploadUrl({
      bucketId: this.bucketId!,
    });

    await this.b2.uploadFile({
      uploadUrl: uploadUrl.data.uploadUrl,
      uploadAuthToken: uploadUrl.data.authorizationToken,
      fileName: key,
      data: file,
      mime: contentType,
    });

    const url = `${this.publicBaseUrl}/${this.bucketName}/${key}`;

    return { url, key };
  }

  async deleteImage(key: string): Promise<void> {
    await this.ensureAuthorized();

    // @ts-expect-error: @types/backblaze-b2 requires startFileName/delimiter which B2 doesn't need at runtime
    const listResponse = await this.b2.listFileNames({
      bucketId: this.bucketId!,
      prefix: key,
      maxFileCount: 1,
    });

    const files = listResponse.data.files as Array<{ fileName: string; fileId: string }>;
    const file = files.find((f) => f.fileName === key);

    if (!file) {
      // File already deleted or never existed — treat as success
      return;
    }

    await this.b2.deleteFileVersion({
      fileName: key,
      fileId: file.fileId,
    });
  }

  async downloadImage(key: string): Promise<{ data: ArrayBuffer; contentType: string }> {
    await this.ensureAuthorized();

    const response = await this.b2.downloadFileByName({
      bucketName: this.bucketName,
      fileName: key,
      responseType: "arraybuffer",
    });

    const contentType = (response.headers["content-type"] as string) || "image/jpeg";
    return {
      data: response.data as ArrayBuffer,
      contentType,
    };
  }
}

export function resolveCandidateImageUrl(
  imageUrl: string | null,
  candidateId: string,
  env: {
    B2_BUCKET_NAME: string;
    B2_PUBLIC_ACCESS: boolean | string;
    B2_PUBLIC_BASE_URL: string;
  },
  requestUrl: string,
): string | null {
  if (!imageUrl) return null;
  const b2BucketName = env.B2_BUCKET_NAME;
  const publicAccess = env.B2_PUBLIC_ACCESS === "true" || env.B2_PUBLIC_ACCESS === true;
  if (publicAccess || !b2BucketName) return imageUrl;

  const bucketPrefix = `${env.B2_PUBLIC_BASE_URL}/${b2BucketName}/`;
  if (imageUrl.startsWith(bucketPrefix)) {
    let origin = "http://localhost";
    try {
      origin = new URL(requestUrl).origin;
    } catch {
      try {
        origin = new URL(requestUrl, "http://localhost").origin;
      } catch {
        // fallback to default
      }
    }
    return `${origin}/candidates/${candidateId}/image`;
  }
  return imageUrl;
}

export interface UploadResult {
  url: string;
  key: string;
}

export interface DownloadedImage {
  data: ArrayBuffer;
  contentType: string;
}

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

export interface ImageStorage {
  /**
   * Uploads an image for a Candidate.
   * Performs file size validation, mime-type verification, and magic-byte signature check.
   * Internally generates the secure candidate key and returns the public URL.
   *
   * Invariants:
   * - Only JPEG, PNG, and WebP files are accepted.
   * - File size must be under 5MB.
   * - Content bytes must match the declared file MIME type (magic bytes check).
   *
   * Throws:
   * - ImageValidationError (for validation failures like bad size, format, or mismatching magic bytes)
   * - Error (for transient connection or system failures)
   */
  upload(candidateId: string, file: File): Promise<UploadResult>;

  /**
   * Deletes the candidate image from storage if it exists.
   * Uses either the raw storage key or the full image URL to locate and remove the file.
   *
   * Invariants:
   * - Idempotent: If the file does not exist, it treats it as success and does not throw.
   */
  delete(imageUrl: string): Promise<void>;

  /**
   * Downloads the candidate image from storage.
   * Returns the raw image data and its verified content type.
   */
  download(imageUrl: string): Promise<DownloadedImage>;
}

export class B2ImageStorage implements ImageStorage {
  private client: B2Client;
  private bucketName: string;
  private publicBaseUrl: string;

  constructor(config: B2Config) {
    this.client = new B2Client(config);
    this.bucketName = config.bucketName;
    this.publicBaseUrl = config.publicBaseUrl;
  }

  async upload(candidateId: string, file: File): Promise<UploadResult> {
    const validation = this.client.validateFile({
      size: file.size,
      type: file.type,
    });
    if (!validation.valid) {
      throw new ImageValidationError(validation.error || "Unsupported media type");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const magicCheck = this.client.validateMagicBytes(buffer, file.type);
    if (!magicCheck.valid) {
      throw new ImageValidationError(magicCheck.error || "Unsupported media type");
    }

    return this.client.uploadImage(candidateId, buffer, file.type, file.name);
  }

  async delete(imageUrl: string): Promise<void> {
    const key = this.parseKeyFromUrl(imageUrl);
    await this.client.deleteImage(key);
  }

  async download(imageUrl: string): Promise<DownloadedImage> {
    const key = this.parseKeyFromUrl(imageUrl);
    return this.client.downloadImage(key);
  }

  private parseKeyFromUrl(imageUrl: string): string {
    const bucketPrefix = `${this.publicBaseUrl}/${this.bucketName}/`;
    if (imageUrl.startsWith(bucketPrefix)) {
      return imageUrl.substring(bucketPrefix.length);
    }
    const index = imageUrl.indexOf("/candidates/");
    if (index !== -1) {
      return imageUrl.substring(index + 1);
    }
    throw new Error(`Invalid candidate image URL: ${imageUrl}`);
  }
}

export class InMemoryImageStorage implements ImageStorage {
  private files = new Map<string, { data: Buffer; type: string; name: string }>();

  async upload(candidateId: string, file: File): Promise<UploadResult> {
    if (!ALLOWED_TYPES.includes(file.type as any)) {
      throw new ImageValidationError(`Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}`);
    }
    if (file.size > MAX_SIZE) {
      throw new ImageValidationError(`File too large. Maximum size: ${MAX_SIZE / 1024 / 1024}MB`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    // Create a temporary B2Client instance to use its validation logic locally
    const validator = new B2Client({
      applicationKeyId: "mock",
      applicationKey: "mock",
      bucketName: "mock",
      publicBaseUrl: "https://mock.b2.com",
    });
    const magicCheck = validator.validateMagicBytes(buffer, file.type);
    if (!magicCheck.valid) {
      throw new ImageValidationError(magicCheck.error || "Unsupported media type");
    }

    const uuid = crypto.randomUUID();
    const parts = file.name.split(".");
    const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : "jpg";
    const key = `candidates/${candidateId}/${uuid}.${ext}`;
    const url = `https://mock.b2.com/mock-bucket/${key}`;

    this.files.set(key, { data: buffer, type: file.type, name: file.name });
    return { url, key };
  }

  async delete(imageUrl: string): Promise<void> {
    const key = this.parseKeyFromUrl(imageUrl);
    this.files.delete(key);
  }

  async download(imageUrl: string): Promise<DownloadedImage> {
    const key = this.parseKeyFromUrl(imageUrl);
    const file = this.files.get(key);
    if (!file) {
      throw new Error(`File not found: ${key}`);
    }
    return {
      data: (file.data.buffer as ArrayBuffer).slice(
        file.data.byteOffset,
        file.data.byteOffset + file.data.byteLength,
      ),
      contentType: file.type,
    };
  }

  private parseKeyFromUrl(imageUrl: string): string {
    const index = imageUrl.indexOf("/candidates/");
    if (index !== -1) {
      return imageUrl.substring(index + 1);
    }
    return imageUrl;
  }
}

export function getImageStorage(env: {
  NODE_ENV?: string;
  B2_APPLICATION_KEY_ID?: string;
  B2_APPLICATION_KEY?: string;
  B2_BUCKET_NAME?: string;
  B2_PUBLIC_BASE_URL?: string;
}): ImageStorage {
  const hasCredentials =
    env.B2_APPLICATION_KEY_ID &&
    env.B2_APPLICATION_KEY &&
    env.B2_BUCKET_NAME &&
    env.B2_PUBLIC_BASE_URL;

  if (!hasCredentials) {
    if (env.NODE_ENV === "production") {
      throw new Error("Missing required Backblaze B2 environment variables in production");
    }
    return new InMemoryImageStorage();
  }
  return new B2ImageStorage({
    applicationKeyId: env.B2_APPLICATION_KEY_ID!,
    applicationKey: env.B2_APPLICATION_KEY!,
    bucketName: env.B2_BUCKET_NAME!,
    publicBaseUrl: env.B2_PUBLIC_BASE_URL!,
  });
}
