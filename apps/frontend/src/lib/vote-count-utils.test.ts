import { expect, test } from "vitest";
import { mergeVoteCounts } from "./vote-count-utils";

test("mergeVoteCounts returns empty map for empty inputs", () => {
  const result = mergeVoteCounts([], []);
  expect(result.voteCounts).toEqual({});
  expect(result.isLoading).toBe(false);
});

test("mergeVoteCounts extracts voteCount from object data", () => {
  const result = mergeVoteCounts(
    ["c1", "c2"],
    [
      {
        data: { candidateId: "c1", candidateName: "Alice", position: "president", voteCount: 5 },
        isLoading: false,
      },
      {
        data: { candidateId: "c2", candidateName: "Bob", position: "president", voteCount: 12 },
        isLoading: false,
      },
    ],
  );
  expect(result.voteCounts).toEqual({ c1: 5, c2: 12 });
  expect(result.isLoading).toBe(false);
});

test("mergeVoteCounts extracts voteCount from full API response shape", () => {
  const result = mergeVoteCounts(
    ["c1"],
    [
      {
        data: { candidateId: "c1", candidateName: "Alice", position: "president", voteCount: 42 },
        isLoading: false,
      },
    ],
  );
  expect(result.voteCounts).toEqual({ c1: 42 });
  expect(result.isLoading).toBe(false);
});

test("mergeVoteCounts reports loading when any query is loading", () => {
  const result = mergeVoteCounts(
    ["c1", "c2"],
    [
      {
        data: { candidateId: "c1", candidateName: "Alice", position: "president", voteCount: 5 },
        isLoading: false,
      },
      { data: undefined, isLoading: true },
    ],
  );
  expect(result.isLoading).toBe(true);
});

test("mergeVoteCounts skips entries with no query result", () => {
  const result = mergeVoteCounts(
    ["c1", "c2"],
    [
      {
        data: { candidateId: "c1", candidateName: "Alice", position: "president", voteCount: 5 },
        isLoading: false,
      },
    ],
  );
  expect(result.voteCounts).toEqual({ c1: 5 });
});

test("mergeVoteCounts handles undefined data gracefully", () => {
  const result = mergeVoteCounts(
    ["c1", "c2"],
    [
      { data: undefined, isLoading: false },
      {
        data: { candidateId: "c2", candidateName: "Bob", position: "vp", voteCount: 3 },
        isLoading: false,
      },
    ],
  );
  expect(result.voteCounts).toEqual({ c2: 3 });
  expect(result.isLoading).toBe(false);
});
