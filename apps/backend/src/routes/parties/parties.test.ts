import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import router from "./index";
import { createPartyListRoute, updatePartyListRoute } from "./parties.routes";

let mockAuthRole = "admin";

const {
  mockElectionFindById,
  mockPartyFindById,
  mockPartyListByElection,
  mockPartyDelete,
  mockAuditInsert,
} = vi.hoisted(() => ({
  mockElectionFindById: vi.fn(),
  mockPartyFindById: vi.fn(),
  mockPartyListByElection: vi.fn(),
  mockPartyDelete: vi.fn(),
  mockAuditInsert: vi.fn(),
}));

const mockDb: any = {
  transaction: vi.fn(async (callback) => await callback(mockDb)),
};

vi.mock("@/config/db", () => ({
  createDb: vi.fn(() => ({ db: mockDb })),
}));

vi.mock("@/middleware/auth", () => ({
  requireAuth: async (c: any, next: any) => {
    c.set("authUser", {
      id: "admin-1",
      email: "admin@example.com",
      username: "admin",
      role: mockAuthRole,
    });
    await next();
  },
  withAdmin: (handler: any) => async (c: any, next: any) => handler(c, next),
}));

vi.mock("@/database/repositories/election.repository", () => ({
  electionRepo: {
    findById: mockElectionFindById,
  },
}));

vi.mock("@/database/repositories/party-list.repository", () => ({
  partyListRepo: {
    findById: mockPartyFindById,
    listByElection: mockPartyListByElection,
    delete: mockPartyDelete,
  },
}));

vi.mock("@/database/repositories/audit-log.repository", () => ({
  auditLogRepo: {
    insert: mockAuditInsert,
  },
}));

describe("party-list routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthRole = "admin";
  });

  it("returns 409 when deleting a party outside draft", async () => {
    mockPartyFindById.mockResolvedValueOnce({
      id: "party-1",
      electionId: "election-1",
      name: "Innovators",
      code: "INNOV",
    });
    mockElectionFindById.mockResolvedValueOnce({
      id: "election-1",
      status: "open",
    });

    const response = await router.request("/elections/election-1/parties/party-1", {
      method: "DELETE",
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ message: ERROR_MESSAGES.ELECTION_NOT_IN_DRAFT });
    expect(mockPartyDelete).not.toHaveBeenCalled();
    expect(mockAuditInsert).not.toHaveBeenCalled();
  });

  it("returns 404 when a non-admin lists parties for a draft election", async () => {
    mockAuthRole = "user";
    mockElectionFindById.mockResolvedValueOnce({
      id: "election-1",
      status: "draft",
    });
    mockPartyListByElection.mockResolvedValueOnce([
      { id: "party-1", electionId: "election-1", name: "Innovators", code: "INNOV" },
    ]);

    const response = await router.request("/elections/election-1/parties", { method: "GET" });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: ERROR_MESSAGES.ELECTION_NOT_FOUND });
    expect(mockPartyListByElection).not.toHaveBeenCalled();
  });

  it("returns 404 when a non-admin lists parties for an incomplete open election", async () => {
    mockAuthRole = "user";
    mockElectionFindById.mockResolvedValueOnce({
      id: "election-1",
      status: "open",
      opensAt: Math.floor(Date.now() / 1000) - 60,
      closesAt: null,
    });
    mockPartyListByElection.mockResolvedValueOnce([
      { id: "party-1", electionId: "election-1", name: "Innovators", code: "INNOV" },
    ]);

    const response = await router.request("/elections/election-1/parties", { method: "GET" });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ message: ERROR_MESSAGES.ELECTION_NOT_FOUND });
    expect(mockPartyListByElection).not.toHaveBeenCalled();
  });

  it("keeps incomplete open-election parties visible to administrators", async () => {
    const parties = [
      { id: "party-1", electionId: "election-1", name: "Innovators", code: "INNOV" },
    ];
    mockElectionFindById.mockResolvedValueOnce({
      id: "election-1",
      status: "open",
      opensAt: Math.floor(Date.now() / 1000) - 60,
      closesAt: null,
    });
    mockPartyListByElection.mockResolvedValueOnce(parties);

    const response = await router.request("/elections/election-1/parties", { method: "GET" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(parties);
    expect(mockPartyListByElection).toHaveBeenCalledWith(expect.anything(), "election-1");
  });

  it("returns 422 when creating a party list with an invalid code", async () => {
    const response = await router.request("/elections/election-1/parties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Innovators",
        code: "INVALID CODE",
      }),
    });

    expect(response.status).toBe(422);
  });

  it("returns 422 when updating a party list with an invalid code", async () => {
    const response = await router.request("/elections/election-1/parties/party-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "PARTY(1)",
      }),
    });

    expect(response.status).toBe(422);
  });

  it.each([
    ["create", createPartyListRoute],
    ["update", updatePartyListRoute],
  ])("documents both conflict causes for %s", (_operation, route) => {
    expect(route.responses[409].description).toBe(
      "Party list conflict: duplicate name or code, or election is not in draft",
    );
  });
});
