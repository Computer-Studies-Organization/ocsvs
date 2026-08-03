import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFrontendBuildEnv, validateFrontendBuildEnv } from "./validate-frontend-build-env";

function createFrontendEnvDirectory(): string {
  const frontendDir = mkdtempSync(join(tmpdir(), "validate-frontend-build-env-"));
  writeFileSync(
    join(frontendDir, ".env"),
    [
      "PUBLIC_API_BASE_URL=http://localhost:8787",
      "PUBLIC_TURNSTILE_SITEKEY=1x00000000000000000000AA",
      "",
    ].join("\n"),
  );
  return frontendDir;
}

describe("validateFrontendBuildEnv", () => {
  it("rejects a non-empty API origin for the same-origin production build", () => {
    expect(() =>
      validateFrontendBuildEnv({
        apiBaseUrl: "http://localhost:8787",
        turnstileSitekey: "real-sitekey",
      }),
    ).toThrow("PUBLIC_API_BASE_URL must be empty");
  });

  it("rejects the dummy Turnstile site key", () => {
    expect(() =>
      validateFrontendBuildEnv({
        apiBaseUrl: "",
        turnstileSitekey: "1x00000000000000000000AA",
      }),
    ).toThrow("PUBLIC_TURNSTILE_SITEKEY");
  });

  it("accepts a real site key with an empty API origin", () => {
    expect(() =>
      validateFrontendBuildEnv({
        apiBaseUrl: "",
        turnstileSitekey: "real-sitekey",
      }),
    ).not.toThrow();
  });

  it("validates values loaded from the frontend env files when process env omits them", () => {
    const frontendDir = createFrontendEnvDirectory();

    try {
      const buildEnv = loadFrontendBuildEnv({
        frontendDir,
        processEnv: {},
      });

      expect(buildEnv.apiBaseUrl).toBe("http://localhost:8787");
      expect(() => validateFrontendBuildEnv(buildEnv)).toThrow("PUBLIC_API_BASE_URL must be empty");
    } finally {
      rmSync(frontendDir, { recursive: true, force: true });
    }
  });

  it("lets explicit process env values override frontend env files", () => {
    const frontendDir = createFrontendEnvDirectory();

    try {
      const buildEnv = loadFrontendBuildEnv({
        frontendDir,
        processEnv: {
          PUBLIC_API_BASE_URL: "",
          PUBLIC_TURNSTILE_SITEKEY: "real-sitekey",
        },
      });

      expect(buildEnv).toEqual({
        apiBaseUrl: "",
        turnstileSitekey: "real-sitekey",
      });
      expect(() => validateFrontendBuildEnv(buildEnv)).not.toThrow();
    } finally {
      rmSync(frontendDir, { recursive: true, force: true });
    }
  });
});
