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
});
