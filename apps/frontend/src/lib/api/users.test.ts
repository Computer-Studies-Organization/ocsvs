import { beforeEach, expect, it, vi } from "vitest";

const { mockApiFetch } = vi.hoisted(() => ({ mockApiFetch: vi.fn() }));

vi.mock("./client", () => ({ apiFetch: mockApiFetch }));

import { fetchUsers } from "./users";

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
