import { describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import { getPasswordResetDatabaseUrl, resetPassword } from "./reset-password";

function createMockClient() {
  return {
    execute: vi.fn(),
    batch: vi.fn().mockResolvedValue([]),
  } as unknown as Pick<Client, "execute" | "batch">;
}

describe("password reset script", () => {
  it("requires explicit opt-in before using a remote database", () => {
    expect(() =>
      getPasswordResetDatabaseUrl({
        TURSO_DATABASE_URL: "libsql://cso-voting.turso.io",
      }),
    ).toThrow(/ALLOW_REMOTE_PASSWORD_RESET=true/);

    expect(
      getPasswordResetDatabaseUrl({
        TURSO_DATABASE_URL: "libsql://cso-voting.turso.io",
        ALLOW_REMOTE_PASSWORD_RESET: "true",
      }),
    ).toBe("libsql://cso-voting.turso.io");
  });

  it("rehashes the selected account and invalidates its sessions and attempts", async () => {
    const client = createMockClient();
    vi.mocked(client.execute).mockResolvedValueOnce({ rows: [{ id: "account-1" }] } as never);

    await resetPassword(client, "C24-01-00001-BSC001", "new-password", 1_700_000_000);

    expect(client.execute).toHaveBeenCalledWith({
      sql: expect.stringContaining("u.student_id = ?"),
      args: ["C24-01-00001-BSC001"],
    });

    const statements = vi.mocked(client.batch).mock.calls[0]?.[0] as Array<{
      sql: string;
      args: unknown[];
    }>;
    expect(statements).toHaveLength(3);
    expect(statements[0]?.sql).toContain("UPDATE accounts");
    expect(statements[0]?.args[0]).toEqual(expect.stringMatching(/^pbkdf2-sha256\$100000\$/));
    expect(statements[0]?.args).not.toContain("new-password");
    expect(statements[1]).toEqual({
      sql: "DELETE FROM sessions WHERE account_id = ?",
      args: ["account-1"],
    });
    expect(statements[2]).toEqual({
      sql: "DELETE FROM login_attempts WHERE identifier = ?",
      args: ["C24-01-00001-BSC001"],
    });
  });

  it("refuses to update an unknown student number", async () => {
    const client = createMockClient();
    vi.mocked(client.execute).mockResolvedValueOnce({ rows: [] } as never);

    await expect(resetPassword(client, "missing-student", "new-password")).rejects.toThrow(
      "No account found",
    );
    expect(client.batch).not.toHaveBeenCalled();
  });
});
