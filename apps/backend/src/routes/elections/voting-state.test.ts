import { beforeEach, describe, expect, it, vi } from "vitest";
import router from "./index";
import * as votingStateQueries from "@/database/queries/voting-state.queries";
import type { VotingState } from "@/database/queries/voting-state.queries";

let TEST_USER = { id: "acc-1", email: "t@e.com", username: "t", role: "user" };
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
  withAdmin: (handler: any) => async (c: any, next: any) => {
    if (!AUTH_ENABLED || (TEST_USER.role !== "admin" && TEST_USER.role !== "super_admin")) {
      return c.json({ message: "Forbidden" }, 403);
    }
    return handler(c, next);
  },
}));

vi.mock("@/config/db", () => ({ createDb: vi.fn(() => ({ db: {} })) }));
vi.mock("@/lib/create-app", async (importOriginal) => {
  const { OpenAPIHono } = await import("@hono/zod-openapi");
  const original = await importOriginal<typeof import("@/lib/create-app")>();
  const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  return {
    ...original,
    createRouter: () => {
      const app = new OpenAPIHono({ strict: false });
      app.use("*", async (c: any, next: any) => {
        c.set("logger", mockLogger);
        await next();
      });
      return app;
    },
  };
});

vi.mock("@/database/queries/voting-state.queries", () => ({
  getVotingState: vi.fn(),
}));

const getState = vi.mocked(votingStateQueries.getVotingState);

beforeEach(() => {
  getState.mockReset();
  AUTH_ENABLED = true;
  TEST_USER = { id: "acc-1", email: "t@e.com", username: "t", role: "user" };
});

describe("GET /elections/state", () => {
  it("returns 401 when not authenticated", async () => {
    AUTH_ENABLED = false;
    const res = await router.request("/elections/state", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns the open election only when one exists", async () => {
    const open = {
      id: "e1",
      name: "Spring",
      description: null,
      status: "open",
      opensAt: 1,
      closesAt: 2,
      createdAt: 1,
      updatedAt: 1,
      eligibleVotersCount: 42,
    };
    getState.mockResolvedValue({
      open: open as VotingState["open"],
      nextDraft: null,
      lastClosed: null,
      ballot: null,
      myVotes: { electionId: null, hasVoted: false },
    });

    const res = await router.request("/elections/state", { method: "GET" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as VotingState;
    expect(body.open?.id).toBe(open.id);
    expect(body.open).not.toHaveProperty("eligibleVotersCount");
    expect(body.nextDraft).toBeNull();
    expect(body.lastClosed).toBeNull();
    expect(body.myVotes).toEqual({ electionId: null, hasVoted: false });
  });

  it("passes includeBallot=true to the state query", async () => {
    const ballot = { positions: [], parties: [], candidates: [] };
    getState.mockResolvedValue({
      open: null,
      nextDraft: null,
      lastClosed: null,
      ballot,
      myVotes: { electionId: null, hasVoted: false },
    });

    const res = await router.request("/elections/state?includeBallot=true", { method: "GET" });

    expect(res.status).toBe(200);
    expect(getState).toHaveBeenCalledWith({}, "acc-1", {
      includeBallot: true,
      hmacSecret: undefined,
      previousHmacSecrets: [],
    });
    const body = (await res.json()) as VotingState;
    expect(body.ballot).toEqual(ballot);
  });

  it("returns nextDraft when only a draft exists", async () => {
    getState.mockResolvedValue({
      open: null,
      nextDraft: { id: "d1", name: "Fall", opensAt: 100, closesAt: 200 },
      lastClosed: null,
      ballot: null,
      myVotes: { electionId: null, hasVoted: false },
    });

    const res = await router.request("/elections/state", { method: "GET" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as VotingState;
    expect(body.nextDraft?.id).toBe("d1");
  });

  it("returns lastClosed when only a closed election exists", async () => {
    getState.mockResolvedValue({
      open: null,
      nextDraft: null,
      lastClosed: {
        id: "c1",
        name: "Recent",
        closesAt: 200,
        results: [
          {
            positionId: "p1",
            positionName: "President",
            displayOrder: 1,
            totalVotes: 10,
            candidates: [],
          },
        ],
      },
      ballot: null,
      myVotes: { electionId: null, hasVoted: false },
    });

    const res = await router.request("/elections/state", { method: "GET" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as VotingState;
    expect(body.lastClosed?.results[0].totalVotes).toBe(10);
  });

  it("resolves private B2 image URLs in lastClosed results", async () => {
    const imageUrl =
      "https://f003.backblazeb2.com/file/cso-voting-candidates/candidates/cand-1/image.png";
    getState.mockResolvedValue({
      open: null,
      nextDraft: null,
      lastClosed: {
        id: "c1",
        name: "Recent",
        closesAt: 200,
        results: [
          {
            positionId: "p1",
            positionName: "President",
            displayOrder: 1,
            totalVotes: 10,
            candidates: [
              {
                candidateId: "cand-1",
                fullName: "Jane Doe",
                voteCount: 10,
                percentage: 100,
                imageUrl,
              },
            ],
          },
        ],
      },
      ballot: null,
      myVotes: { electionId: null, hasVoted: false },
    });

    const res = await router.request(
      "/elections/state",
      { method: "GET" },
      {
        B2_BUCKET_NAME: "cso-voting-candidates",
        B2_PUBLIC_ACCESS: false,
        B2_PUBLIC_BASE_URL: "https://f003.backblazeb2.com/file",
      },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as VotingState;
    expect(body.lastClosed?.results[0].candidates[0].imageUrl).toBe(
      "http://localhost/candidates/cand-1/image",
    );
  });

  it("returns both nextDraft and lastClosed when both exist", async () => {
    getState.mockResolvedValue({
      open: null,
      nextDraft: { id: "d1", name: "Summer", opensAt: 300, closesAt: 400 },
      lastClosed: {
        id: "c1",
        name: "Spring",
        closesAt: 200,
        results: [],
      },
      ballot: null,
      myVotes: { electionId: null, hasVoted: false },
    });

    const res = await router.request("/elections/state", { method: "GET" });
    const body = (await res.json()) as VotingState;
    expect(body.nextDraft?.id).toBe("d1");
    expect(body.lastClosed?.id).toBe("c1");
  });

  it("returns all-null shape when no elections exist", async () => {
    getState.mockResolvedValue({
      open: null,
      nextDraft: null,
      lastClosed: null,
      ballot: null,
      myVotes: { electionId: null, hasVoted: false },
    });

    const res = await router.request("/elections/state", { method: "GET" });
    const body = (await res.json()) as VotingState;
    expect(body).toEqual({
      open: null,
      nextDraft: null,
      lastClosed: null,
      ballot: null,
      myVotes: { electionId: null, hasVoted: false },
    });
  });

  it("returns only the requesting user's participation status", async () => {
    TEST_USER = { id: "acc-7", email: "u@e.com", username: "u", role: "user" };
    getState.mockResolvedValue({
      open: null,
      nextDraft: null,
      lastClosed: null,
      ballot: null,
      myVotes: { electionId: "e-voted", hasVoted: true },
    });

    const res = await router.request("/elections/state", { method: "GET" });
    const body = (await res.json()) as VotingState;
    expect(body.myVotes).toEqual({
      electionId: "e-voted",
      hasVoted: true,
    });
    expect(getState).toHaveBeenCalledWith({}, "acc-7", {
      includeBallot: false,
      hmacSecret: undefined,
      previousHmacSecrets: [],
    });
  });
});
