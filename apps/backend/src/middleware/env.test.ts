import { describe, expect, it, vi } from "vitest";

const { configMock, expandMock } = vi.hoisted(() => ({
  configMock: vi.fn(),
  expandMock: vi.fn(),
}));

vi.mock("dotenv", () => ({ config: configMock }));
vi.mock("dotenv-expand", () => ({ expand: expandMock }));

import { parseEnv } from "./env";

describe("runtime environment module", () => {
  it("does not load dotenv during Worker module import", () => {
    parseEnv({ NODE_ENV: "development", TURSO_DATABASE_URL: "libsql://local.db" });

    expect(configMock).not.toHaveBeenCalled();
    expect(expandMock).not.toHaveBeenCalled();
  });

  it.each(["http://127.0.0.1:8080", "http://localhost:8080", "file:./local.db"])(
    "accepts offline development with a local database URL: %s",
    (url) => {
      expect(
        parseEnv({ NODE_ENV: "development", OFFLINE_DEV: "true", TURSO_DATABASE_URL: url }),
      ).toMatchObject({ OFFLINE_DEV: true, TURSO_DATABASE_URL: url });
    },
  );

  it("parses the explicit offline false value", () => {
    expect(
      parseEnv({
        NODE_ENV: "development",
        OFFLINE_DEV: "false",
        TURSO_DATABASE_URL: "file:./local.db",
      }),
    ).toMatchObject({ OFFLINE_DEV: false });
  });

  it("rejects offline development with a remote database URL", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "development",
        OFFLINE_DEV: true,
        TURSO_DATABASE_URL: "libsql://remote.turso.io",
      }),
    ).toThrow("OFFLINE_DEV requires a local TURSO_DATABASE_URL");
  });

  it("rejects offline development in production", () => {
    expect(() =>
      parseEnv({
        NODE_ENV: "production",
        OFFLINE_DEV: true,
        TURSO_DATABASE_URL: "http://127.0.0.1:8080",
        TURNSTILE_SECRET_KEY: "secret",
        HMAC_SECRET: "c2VjcmV0LWtleS0zMi1jaGFyYWN0ZXJzLW1pbmltdW0tcGVwcGVy",
      }),
    ).toThrow("OFFLINE_DEV is not allowed in production");
  });
});
