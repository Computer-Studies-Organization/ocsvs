import { describe, expect, it } from "vitest";
import { getSeedPassword, getSeedDatabaseUrl } from "./seed-utils";

describe("seed environment safety", () => {
  it("allows local database URLs", () => {
    expect(
      getSeedDatabaseUrl({
        NODE_ENV: "development",
        TURSO_DATABASE_URL: "http://127.0.0.1:8080",
      }),
    ).toBe("http://127.0.0.1:8080");
  });

  it("rejects production even when the database URL is local", () => {
    expect(() =>
      getSeedDatabaseUrl({
        NODE_ENV: "production",
        TURSO_DATABASE_URL: "file:./local.db",
      }),
    ).toThrow("Refusing to seed while NODE_ENV=production");
  });

  it("rejects remote database URLs without an explicit opt-in", () => {
    expect(() =>
      getSeedDatabaseUrl({
        NODE_ENV: "development",
        TURSO_DATABASE_URL: "libsql://staging-cso.turso.io",
      }),
    ).toThrow("ALLOW_REMOTE_SEEDING=true");
  });

  it("allows a remote non-production URL with an explicit opt-in", () => {
    expect(
      getSeedDatabaseUrl({
        NODE_ENV: "staging",
        TURSO_DATABASE_URL: "libsql://staging-cso.turso.io",
        ALLOW_REMOTE_SEEDING: "true",
      }),
    ).toBe("libsql://staging-cso.turso.io");
  });

  it("requires a password environment variable", () => {
    expect(() => getSeedPassword({}, "VOTER_PASSWORD")).toThrow("VOTER_PASSWORD is required");
  });

  it("returns the password without altering its value", () => {
    expect(getSeedPassword({ VOTER_PASSWORD: " test password " }, "VOTER_PASSWORD")).toBe(
      " test password ",
    );
  });
});
