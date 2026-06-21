import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import router from "./index";

let TEST_USER = {
  id: "test-user-id",
  email: "test@example.com",
  username: "testuser",
  role: "admin",
};
let AUTH_ENABLED = true;

vi.mock("@/middleware/auth", () => ({
  requireAuth: async (c: any, next: any) => {
    if (!AUTH_ENABLED) return c.json({ message: "Unauthorized" }, 401);
    c.set("authUser", { ...TEST_USER });
    await next();
  },
  requireAdmin: async (c: any, next: any) => {
    if (!AUTH_ENABLED || TEST_USER.role !== "admin") {
      return c.json({ message: "Forbidden" }, 403);
    }
    await next();
  },
}));

let mockDb: any;

function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    all: vi.fn(),
    get: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    run: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
}

mockDb = createMockDb();

vi.mock("@/config/db", () => ({
  createDb: vi.fn(() => ({ db: mockDb })),
}));

const {
  mockListByElection,
  mockCreate,
  mockFindById,
  mockUpdate,
  mockDelete,
  mockCountByPositionId,
  mockElectionFindById,
} = vi.hoisted(() => ({
  mockListByElection: vi.fn(),
  mockCreate: vi.fn(),
  mockFindById: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockCountByPositionId: vi.fn(),
  mockElectionFindById: vi.fn(),
}));

vi.mock("@/database/repositories/position.repository", () => ({
  positionRepo: {
    listByElection: mockListByElection,
    create: mockCreate,
    findById: mockFindById,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

vi.mock("@/database/repositories/candidates.repository", () => ({
  candidateRepo: {
    countByPositionId: mockCountByPositionId,
  },
}));

vi.mock("@/database/repositories/election.repository", () => ({
  electionRepo: {
    findById: mockElectionFindById,
  },
}));

const electionId = "elec-001";
const positionId = "pos-001";

function makeElection(overrides: Record<string, any> = {}) {
  return {
    id: electionId,
    name: "CSO 2026",
    description: null,
    status: "draft",
    opensAt: null,
    closesAt: null,
    createdAt: 1738000000,
    updatedAt: 1738000000,
    ...overrides,
  };
}

function makePosition(overrides: Record<string, any> = {}) {
  return {
    id: positionId,
    electionId,
    name: "President",
    displayOrder: 0,
    createdAt: 1738000000,
    updatedAt: 1738000000,
    ...overrides,
  };
}

describe("positions routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockListByElection.mockReset();
    mockCreate.mockReset();
    mockFindById.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
    mockCountByPositionId.mockReset();
    mockElectionFindById.mockReset();
    TEST_USER = {
      id: "test-user-id",
      email: "test@example.com",
      username: "testuser",
      role: "admin",
    };
    AUTH_ENABLED = true;
  });

  const setUser = () => {
    TEST_USER = { ...TEST_USER, role: "user" };
  };

  describe("authentication", () => {
    it("returns 401 when not authenticated for listPositions", async () => {
      AUTH_ENABLED = false;
      const res = await router.request(`/elections/${electionId}/positions`, { method: "GET" });
      expect(res.status).toBe(401);
    });

    it("returns 401 when not authenticated for createPosition", async () => {
      AUTH_ENABLED = false;
      const res = await router.request(`/elections/${electionId}/positions`, {
        method: "POST",
        body: JSON.stringify({ name: "President" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(401);
    });
  });

  describe("gET /elections/:id/positions (listPositions)", () => {
    it("returns 200 with array of positions", async () => {
      const rows = [makePosition({ id: "p1" }), makePosition({ id: "p2", name: "Vice President" })];
      mockListByElection.mockResolvedValue(rows);
      const res = await router.request(`/elections/${electionId}/positions`, { method: "GET" });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json).toHaveLength(2);
      expect(mockListByElection).toHaveBeenCalledWith(mockDb, electionId);
    });
  });

  describe("pOST /elections/:id/positions (createPosition)", () => {
    it("returns 403 when caller is not admin", async () => {
      setUser();
      const res = await router.request(`/elections/${electionId}/positions`, {
        method: "POST",
        body: JSON.stringify({ name: "President" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(403);
    });

    it("returns 404 when election is missing", async () => {
      mockElectionFindById.mockResolvedValue(null);
      const res = await router.request(`/elections/${electionId}/positions`, {
        method: "POST",
        body: JSON.stringify({ name: "President" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(404);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.ELECTION_NOT_FOUND);
    });

    it("returns 409 when election status is not draft", async () => {
      mockElectionFindById.mockResolvedValue(makeElection({ status: "open" }));
      const res = await router.request(`/elections/${electionId}/positions`, {
        method: "POST",
        body: JSON.stringify({ name: "President" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(409);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.ELECTION_NOT_IN_DRAFT);
    });

    it("returns 201 with the created position when election is draft", async () => {
      mockElectionFindById.mockResolvedValue(makeElection({ status: "draft" }));
      mockCreate.mockResolvedValue(positionId);
      mockFindById.mockResolvedValue(makePosition());
      const res = await router.request(`/elections/${electionId}/positions`, {
        method: "POST",
        body: JSON.stringify({ name: "President" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(201);
      const json = (await res.json()) as any;
      expect(json.id).toBe(positionId);
      expect(json.name).toBe("President");
    });
  });

  describe("pATCH /elections/:id/positions/:positionId (updatePosition)", () => {
    it("returns 403 when caller is not admin", async () => {
      setUser();
      const res = await router.request(`/elections/${electionId}/positions/${positionId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "New" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(403);
    });

    it("returns 404 when position is missing", async () => {
      mockFindById.mockResolvedValue(null);
      const res = await router.request(`/elections/${electionId}/positions/${positionId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "New" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(404);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.POSITION_NOT_FOUND);
    });

    it("returns 404 when position belongs to a different election", async () => {
      mockFindById.mockResolvedValue(makePosition({ electionId: "other-elec" }));
      const res = await router.request(`/elections/${electionId}/positions/${positionId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "New" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(404);
    });

    it("returns 200 with the updated position", async () => {
      mockFindById
        .mockResolvedValueOnce(makePosition())
        .mockResolvedValueOnce(makePosition({ name: "Renamed" }));
      const res = await router.request(`/elections/${electionId}/positions/${positionId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Renamed" }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.name).toBe("Renamed");
    });
  });

  describe("dELETE /elections/:id/positions/:positionId (deletePosition)", () => {
    it("returns 403 when caller is not admin", async () => {
      setUser();
      const res = await router.request(`/elections/${electionId}/positions/${positionId}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(403);
    });

    it("returns 404 when position is missing", async () => {
      mockFindById.mockResolvedValue(null);
      const res = await router.request(`/elections/${electionId}/positions/${positionId}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });

    it("returns 409 when position has candidates", async () => {
      mockFindById.mockResolvedValue(makePosition());
      mockCountByPositionId.mockResolvedValue(2);
      const res = await router.request(`/elections/${electionId}/positions/${positionId}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(409);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.POSITION_HAS_CANDIDATES);
    });

    it("returns 200 when position is empty", async () => {
      mockFindById.mockResolvedValue(makePosition());
      mockCountByPositionId.mockResolvedValue(0);
      mockDelete.mockResolvedValue(true);
      const res = await router.request(`/elections/${electionId}/positions/${positionId}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.POSITION_DELETED_SUCCESSFULLY);
      expect(mockDelete).toHaveBeenCalledWith(mockDb, positionId);
    });
  });
});
