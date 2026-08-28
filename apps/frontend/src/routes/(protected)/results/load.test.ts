import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCacheGet } = vi.hoisted(() => ({
  mockCacheGet: vi.fn(),
}));

vi.mock("$lib/cache", () => ({
  appCache: { get: mockCacheGet },
}));

import { load } from "./+page";

describe("/results smart redirect loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to lastClosed election results when lastClosed exists", async () => {
    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "votingState") {
          return {
            open: null,
            nextDraft: null,
            lastClosed: { id: "closed-election-1" },
            myVotes: { electionId: null, hasVoted: false },
          };
        }
        return null;
      }),
    }));

    await expect(
      load({
        fetch: vi.fn(),
      } as any),
    ).rejects.toMatchObject({ status: 302, location: "/elections/closed-election-1/results" });
  });

  it("redirects to open election results if user has already voted", async () => {
    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "votingState") {
          return {
            open: { id: "open-election-1" },
            nextDraft: null,
            lastClosed: null,
            myVotes: { electionId: "open-election-1", hasVoted: true },
          };
        }
        return null;
      }),
    }));

    await expect(
      load({
        fetch: vi.fn(),
      } as any),
    ).rejects.toMatchObject({ status: 302, location: "/elections/open-election-1/results" });
  });

  it("redirects to first closed election from elections list if votingState has no lastClosed", async () => {
    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "votingState") {
          return {
            open: null,
            nextDraft: null,
            lastClosed: null,
            myVotes: { electionId: null, hasVoted: false },
          };
        }
        if (resource === "elections") {
          return [
            { id: "draft-1", status: "draft" },
            { id: "closed-list-1", status: "closed" },
          ];
        }
        return null;
      }),
    }));

    await expect(
      load({
        fetch: vi.fn(),
      } as any),
    ).rejects.toMatchObject({ status: 302, location: "/elections/closed-list-1/results" });
  });

  it("redirects to /elections fallback if no closed elections exist", async () => {
    mockCacheGet.mockImplementation((resource: string) => ({
      fetchOrThrow: vi.fn().mockImplementation(async () => {
        if (resource === "votingState") {
          return {
            open: null,
            nextDraft: null,
            lastClosed: null,
            myVotes: { electionId: null, hasVoted: false },
          };
        }
        if (resource === "elections") {
          return [{ id: "draft-1", status: "draft" }];
        }
        return null;
      }),
    }));

    await expect(
      load({
        fetch: vi.fn(),
      } as any),
    ).rejects.toMatchObject({ status: 302, location: "/elections" });
  });
});
