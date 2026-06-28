import { beforeEach, describe, expect, it, vi } from "vitest";
import { accounts } from "@/database/schema";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import router from "./index";

// Mock the auth middleware
vi.mock("@/middleware/auth", () => ({
  requireAuth: async (c: any, next: any) => {
    c.set("authUser", {
      id: "test-user-id",
      email: "test@example.com",
      username: "testuser",
      role: "admin",
    });
    await next();
  },
}));

// Mock the database
let mockDb: any;

function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    all: vi.fn(),
    get: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    run: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    batch: vi.fn().mockResolvedValue(undefined),
  };
}

mockDb = createMockDb();

vi.mock("@/config/db", () => ({
  createDb: vi.fn(() => ({ db: mockDb })),
}));

// Hoisted mocks
const {
  mockExistsActiveForAccountPosition,
  mockCreate,
  mockListForAdminTable,
  mockGetForAdminView,
  mockUpdate,
  mockSoftDelete,
  mockUpdateImageUrl,
  mockValidateFile,
  mockValidateMagicBytes,
  mockUploadImage,
  mockDeleteImage,
  mockDownloadImage,
  mockAuditInsert,
} = vi.hoisted(() => ({
  mockExistsActiveForAccountPosition: vi.fn(),
  mockCreate: vi.fn(),
  mockListForAdminTable: vi.fn(),
  mockGetForAdminView: vi.fn(),
  mockUpdate: vi.fn(),
  mockSoftDelete: vi.fn(),
  mockUpdateImageUrl: vi.fn(),
  mockValidateFile: vi.fn(),
  mockValidateMagicBytes: vi.fn().mockReturnValue({ valid: true }),
  mockUploadImage: vi.fn(),
  mockDeleteImage: vi.fn(),
  mockDownloadImage: vi.fn(),
  mockAuditInsert: vi.fn(),
}));

vi.mock("@/database/repositories/candidates.repository", () => ({
  candidateRepo: {
    existsActiveForAccountPosition: mockExistsActiveForAccountPosition,
    create: mockCreate,
    listForAdminTable: mockListForAdminTable,
    getForAdminView: mockGetForAdminView,
    update: mockUpdate,
    softDelete: mockSoftDelete,
    updateImageUrl: mockUpdateImageUrl,
  },
}));

vi.mock("@/lib/b2-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/b2-client")>("@/lib/b2-client");
  return {
    ...actual,
    B2Client: vi.fn().mockImplementation(() => ({
      validateFile: mockValidateFile,
      validateMagicBytes: mockValidateMagicBytes,
      uploadImage: mockUploadImage,
      deleteImage: mockDeleteImage,
      downloadImage: mockDownloadImage,
    })),
  };
});

vi.mock("@/database/repositories/audit-log.repository", () => ({
  auditLogRepo: {
    insert: mockAuditInsert,
  },
}));

describe("candidate Routes (repository)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockExistsActiveForAccountPosition.mockReset();
    mockCreate.mockReset();
    mockListForAdminTable.mockReset();
    mockGetForAdminView.mockReset();
    mockUpdate.mockReset();
    mockSoftDelete.mockReset();
    mockUpdateImageUrl.mockReset();
    mockValidateFile.mockReset();
    mockValidateMagicBytes.mockReturnValue({ valid: true });
    mockUploadImage.mockReset();
    mockDeleteImage.mockReset();
    mockAuditInsert.mockReset();
  });

  describe("pOST /candidates (createCandidate)", () => {
    it("should create a new candidate successfully", async () => {
      const input = {
        fullName: "Jane Doe",
        accountId: "account-123",
        positionId: "pos-101",
        manifesto: "Change the world",
      };
      mockExistsActiveForAccountPosition.mockResolvedValue(false);
      mockCreate.mockResolvedValue("new-candidate-id");

      // Mock account lookup: SELECT * FROM accounts WHERE id = ?
      mockDb.select.mockImplementationOnce(() => mockDb);
      mockDb.from.mockImplementationOnce((table: any) => (table === accounts ? mockDb : mockDb));
      mockDb.where.mockImplementationOnce(() => mockDb);
      mockDb.get.mockResolvedValueOnce({
        id: input.accountId,
        username: "testacc",
        role: "user",
      });

      const res = await router.request("/candidates", {
        method: "POST",
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.CANDIDATE_CREATED_SUCCESSFULLY);
      expect(json.candidate).toMatchObject({
        id: "new-candidate-id",
        ...input,
      });
    });

    it("should return 409 if candidate already exists for account+position", async () => {
      const input = {
        fullName: "Jane Doe",
        accountId: "account-123",
        positionId: "pos-101",
        manifesto: "Change the world",
      };
      mockExistsActiveForAccountPosition.mockResolvedValue(true);

      // Account exists, still need to pass account check to reach existsActive check
      mockDb.select.mockImplementationOnce(() => mockDb);
      mockDb.from.mockImplementationOnce((table: any) => (table === accounts ? mockDb : mockDb));
      mockDb.where.mockImplementationOnce(() => mockDb);
      mockDb.get.mockResolvedValueOnce({ id: input.accountId });

      const res = await router.request("/candidates", {
        method: "POST",
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(409);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.CANDIDATE_ALREADY_EXISTS);
    });
  });

  describe("gET /candidates (listCandidates)", () => {
    it("should list candidates with pagination", async () => {
      const mockCandidates = [
        {
          id: "1",
          fullName: "Alice",
          accountId: "acc1",
          positionId: "pos-101",
          manifesto: "...",
          isActive: 1,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];
      mockListForAdminTable.mockResolvedValue({
        data: mockCandidates,
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });

      const res = await router.request("/candidates?page=1&limit=10", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data).toHaveLength(1);
      expect(json.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it("should include inactive candidates when includeDeleted=true", async () => {
      const mockCandidates = [
        {
          id: "1",
          fullName: "Alice",
          isActive: 0,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ];
      mockListForAdminTable.mockResolvedValue({
        data: mockCandidates,
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });

      const res = await router.request("/candidates?page=1&limit=10&includeDeleted=true", {
        method: "GET",
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data[0].isActive).toBe(0);
    });
  });

  describe("gET /candidates/:id (getCandidate)", () => {
    it("should return candidate by id", async () => {
      const mockCandidate = {
        id: "cand-1",
        fullName: "Bob",
        accountId: "acc1",
        positionId: "pos-101",
        manifesto: "...",
        isActive: 1,
        createdAt: 1000,
        updatedAt: 1000,
      };
      mockGetForAdminView.mockResolvedValue(mockCandidate);

      const res = await router.request("/candidates/cand-1", { method: "GET" });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.id).toBe("cand-1");
    });

    it("should return 404 if candidate not found", async () => {
      mockGetForAdminView.mockResolvedValue(null);

      const res = await router.request("/candidates/unknown", {
        method: "GET",
      });

      expect(res.status).toBe(404);
    });
  });

  describe("pATCH /candidates/:id (updateCandidate)", () => {
    it("should update candidate successfully", async () => {
      let getCallCount = 0;
      mockGetForAdminView.mockImplementation(async () => {
        getCallCount++;
        if (getCallCount === 1) {
          return { id: "cand-1", isActive: 1, accountId: "acc1" };
        }
        return {
          id: "cand-1",
          fullName: "Updated Name",
          accountId: "acc1",
          positionId: "pos-101",
          manifesto: "Updated",
          isActive: 1,
          createdAt: 1000,
          updatedAt: 1000,
        };
      });

      const res = await router.request("/candidates/cand-1", {
        method: "PUT",
        body: JSON.stringify({
          fullName: "Updated Name",
          manifesto: "Updated",
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.CANDIDATE_UPDATED_SUCCESSFULLY);
    });

    it("should return 404 if candidate not found on update", async () => {
      mockGetForAdminView.mockResolvedValue(null);

      const res = await router.request("/candidates/cand-1", {
        method: "PUT",
        body: JSON.stringify({ fullName: "Updated" }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(404);
    });
  });

  describe("dELETE /candidates/:id (deleteCandidate)", () => {
    it("should soft-delete candidate", async () => {
      mockGetForAdminView.mockResolvedValue({ id: "cand-1", isActive: 1 });
      mockSoftDelete.mockResolvedValue(true);

      const res = await router.request("/candidates/cand-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.CANDIDATE_DELETED_SUCCESSFULLY);
    });

    it("should return 404 if candidate not found on delete", async () => {
      mockGetForAdminView.mockImplementation(async () => null);
      const res = await router.request("/candidates/cand-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /candidates/:id/image (uploadImage)", () => {
    it("should upload candidate image, update database, and write audit log", async () => {
      const candidateId = "cand-1";
      mockGetForAdminView.mockResolvedValueOnce({ id: candidateId, imageUrl: null });
      mockValidateFile.mockReturnValue({ valid: true });
      mockUploadImage.mockResolvedValue({ url: "https://b2.com/image.png", key: "key" });
      mockUpdateImageUrl.mockResolvedValue(true);
      mockGetForAdminView.mockResolvedValueOnce({
        id: candidateId,
        imageUrl: "https://b2.com/image.png",
      });

      const form = new FormData();
      form.append("image", new File([""], "image.png", { type: "image/png" }));

      const res = await router.request(
        `/candidates/${candidateId}/image`,
        {
          method: "POST",
          body: form,
        },
        {
          B2_PUBLIC_BASE_URL: "https://f003.backblazeb2.com/file",
          B2_APPLICATION_KEY_ID: "key-id",
          B2_APPLICATION_KEY: "key",
          B2_BUCKET_NAME: "bucket",
        },
      );

      expect(res.status).toBe(200);
      expect(mockValidateFile).toHaveBeenCalled();
      expect(mockUploadImage).toHaveBeenCalledWith(
        candidateId,
        expect.any(Buffer),
        "image/png",
        "image.png",
      );
      expect(mockUpdateImageUrl).toHaveBeenCalledWith(
        expect.anything(),
        candidateId,
        "https://b2.com/image.png",
      );
      expect(mockAuditInsert).toHaveBeenCalledWith(expect.anything(), {
        action: "candidate.update",
        targetType: "candidate",
        targetId: candidateId,
        actorAccountIdSnapshot: "test-user-id",
        actorUsernameSnapshot: "testuser",
      });
    });

    it("should delete old image from B2 first if it exists", async () => {
      const candidateId = "cand-1";
      mockGetForAdminView.mockResolvedValueOnce({
        id: candidateId,
        imageUrl: "https://b2.com/file/cso-voting-candidates/candidates/cand-1/old.png",
      });
      mockValidateFile.mockReturnValue({ valid: true });
      mockUploadImage.mockResolvedValue({ url: "https://b2.com/image.png", key: "key" });
      mockUpdateImageUrl.mockResolvedValue(true);
      mockGetForAdminView.mockResolvedValueOnce({
        id: candidateId,
        imageUrl: "https://b2.com/image.png",
      });

      const form = new FormData();
      form.append("image", new File([""], "image.png", { type: "image/png" }));

      const res = await router.request(
        `/candidates/${candidateId}/image`,
        {
          method: "POST",
          body: form,
        },
        {
          B2_PUBLIC_BASE_URL: "https://f003.backblazeb2.com/file",
          B2_APPLICATION_KEY_ID: "key-id",
          B2_APPLICATION_KEY: "key",
          B2_BUCKET_NAME: "bucket",
        },
      );

      expect(res.status).toBe(200);
      expect(mockDeleteImage).toHaveBeenCalledWith("candidates/cand-1/old.png");
      expect(mockUploadImage).toHaveBeenCalled();
    });

    it("should reject upload with 415 when magic bytes do not match declared type and not delete old image", async () => {
      const candidateId = "cand-1";
      mockGetForAdminView.mockResolvedValueOnce({
        id: candidateId,
        imageUrl: "https://b2.com/file/cso-voting-candidates/candidates/cand-1/old.png",
      });
      mockValidateFile.mockReturnValue({ valid: true });
      mockValidateMagicBytes.mockReturnValue({
        valid: false,
        error: `File content does not match declared type image/png`,
      });

      const form = new FormData();
      form.append(
        "image",
        new File(["<html><body>x</body></html>"], "image.png", { type: "image/png" }),
      );

      const res = await router.request(
        `/candidates/${candidateId}/image`,
        {
          method: "POST",
          body: form,
        },
        {
          B2_PUBLIC_BASE_URL: "https://f003.backblazeb2.com/file",
          B2_APPLICATION_KEY_ID: "key-id",
          B2_APPLICATION_KEY: "key",
          B2_BUCKET_NAME: "bucket",
        },
      );

      expect(res.status).toBe(415);
      expect(mockValidateMagicBytes).toHaveBeenCalledWith(expect.any(Buffer), "image/png");
      expect(mockDeleteImage).not.toHaveBeenCalled();
      expect(mockUploadImage).not.toHaveBeenCalled();
      expect(mockUpdateImageUrl).not.toHaveBeenCalled();
      expect(mockAuditInsert).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /candidates/:id/image (deleteImage)", () => {
    it("should delete candidate image from B2, update database, and write audit log", async () => {
      const candidateId = "cand-1";
      mockGetForAdminView.mockResolvedValueOnce({
        id: candidateId,
        imageUrl: "https://b2.com/file/cso-voting-candidates/candidates/cand-1/image.png",
      });
      mockUpdateImageUrl.mockResolvedValue(true);
      mockGetForAdminView.mockResolvedValueOnce({ id: candidateId, imageUrl: null });

      const res = await router.request(
        `/candidates/${candidateId}/image`,
        {
          method: "DELETE",
        },
        {
          B2_PUBLIC_BASE_URL: "https://f003.backblazeb2.com/file",
          B2_APPLICATION_KEY_ID: "key-id",
          B2_APPLICATION_KEY: "key",
          B2_BUCKET_NAME: "bucket",
        },
      );

      expect(res.status).toBe(200);
      expect(mockDeleteImage).toHaveBeenCalledWith("candidates/cand-1/image.png");
      expect(mockUpdateImageUrl).toHaveBeenCalledWith(expect.anything(), candidateId, null);
      expect(mockAuditInsert).toHaveBeenCalledWith(expect.anything(), {
        action: "candidate.update",
        targetType: "candidate",
        targetId: candidateId,
        actorAccountIdSnapshot: "test-user-id",
        actorUsernameSnapshot: "testuser",
      });
    });
  });

  describe("GET /candidates/:id/image (getCandidateImage)", () => {
    it("should return candidate image file from B2", async () => {
      const candidateId = "cand-1";
      mockGetForAdminView.mockResolvedValueOnce({
        id: candidateId,
        imageUrl:
          "https://f003.backblazeb2.com/file/cso-voting-candidates/candidates/cand-1/image.png",
      });
      mockDownloadImage.mockResolvedValueOnce({
        data: new ArrayBuffer(8),
        contentType: "image/png",
      });

      const res = await router.request(
        `/candidates/${candidateId}/image`,
        { method: "GET" },
        {
          B2_PUBLIC_BASE_URL: "https://f003.backblazeb2.com/file",
          B2_APPLICATION_KEY_ID: "key-id",
          B2_APPLICATION_KEY: "key",
          B2_BUCKET_NAME: "cso-voting-candidates",
        },
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(mockDownloadImage).toHaveBeenCalledWith("candidates/cand-1/image.png");
    });

    it("should return 404 if candidate has no image", async () => {
      const candidateId = "cand-1";
      mockGetForAdminView.mockResolvedValueOnce({
        id: candidateId,
        imageUrl: null,
      });

      const res = await router.request(
        `/candidates/${candidateId}/image`,
        { method: "GET" },
        {
          B2_PUBLIC_BASE_URL: "https://f003.backblazeb2.com/file",
          B2_APPLICATION_KEY_ID: "key-id",
          B2_APPLICATION_KEY: "key",
          B2_BUCKET_NAME: "cso-voting-candidates",
        },
      );

      expect(res.status).toBe(404);
    });
  });
});
