import { beforeEach, expect, it, vi } from "vitest";

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));

vi.mock("./client", () => ({ apiFetch: mockApiFetch }));

import {
  IMPORT_USERS_BATCH_SIZE,
  fetchUsers,
  importUsersInBatches,
  type ImportUsersResponse,
} from "./users";

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockResolvedValue({
    data: [],
    meta: { total: 0, page: 1, limit: 25, totalPages: 0 },
  });
});

it("sends the selected role to the users endpoint", async () => {
  await fetchUsers({ page: 1, limit: 25, role: "admin" });

  expect(mockApiFetch).toHaveBeenCalledWith(expect.stringContaining("role=admin"), undefined);
});

it("submits 300-record batches sequentially and keeps earlier results when a later batch fails", async () => {
  const users = Array.from({ length: 301 }, (_, index) => ({
    studentId: `student-${index}`,
    firstName: `First${index}`,
    lastName: "Last",
    course: "BSCS",
    yearLevel: "1st Year",
  }));
  const firstResult: ImportUsersResponse = {
    message: "Import completed successfully",
    imported: [
      { studentId: "student-0", fullName: "FIRST0 LAST", username: "first0.last", password: "pw" },
    ],
    skipped: [{ studentId: "student-1", reason: "Student ID already exists in the system" }],
  };
  let resolveFirst!: (result: ImportUsersResponse) => void;
  const firstRequest = new Promise<ImportUsersResponse>((resolve) => {
    resolveFirst = resolve;
  });
  const batchResults: ImportUsersResponse[] = [];

  mockApiFetch
    .mockReturnValueOnce(firstRequest)
    .mockRejectedValueOnce(new Error("second batch failed"));

  const result = importUsersInBatches(users, (batch) => batchResults.push(batch));

  expect(IMPORT_USERS_BATCH_SIZE).toBe(300);
  expect(mockApiFetch).toHaveBeenNthCalledWith(1, "/users/import", {
    method: "POST",
    body: JSON.stringify({ users: users.slice(0, 300) }),
  });
  expect(mockApiFetch).toHaveBeenCalledTimes(1);

  resolveFirst(firstResult);

  await expect(result).rejects.toThrow("second batch failed");
  expect(mockApiFetch).toHaveBeenNthCalledWith(2, "/users/import", {
    method: "POST",
    body: JSON.stringify({ users: users.slice(300) }),
  });
  expect(batchResults).toEqual([firstResult]);
});
