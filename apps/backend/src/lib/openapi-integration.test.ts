import { beforeAll, describe, expect, it, vi } from "vitest";
import { createRouter } from "@/lib/create-app";
import auditLog from "@/routes/audit-log";
import { getElectionAuditRoute, getPositionAuditRoute } from "@/routes/elections/audit.routes";
import { getCandidateAuditRoute } from "@/routes/candidates/audit.routes";
import { getUserAuditRoute } from "@/routes/users/audit.routes";
import { loginRoute } from "@/routes/auth/routes";
import { createUserRoute, importUsersRoute, resetUserPasswordRoute } from "@/routes/users/routes";
import {
  listCandidateAudit,
  listElectionAudit,
  listPositionAudit,
  listUserAudit,
} from "@/handlers/audit-log/audit-log.handler";

vi.mock("@/middleware/auth", () => ({
  requireAuth: async (c: any, next: any) => {
    c.set("authUser", { id: "x", email: null, username: "x", role: "admin" });
    await next();
  },
  requireAdmin: async (_c: any, next: any) => {
    await next();
  },
  withAdmin: (handler: any) => async (c: any, next: any) => {
    return handler(c, next);
  },
}));

vi.mock("@/database/repositories/audit-log.repository", () => ({
  auditLogRepo: {
    list: vi.fn(async () => ({ items: [], nextCursor: null })),
    listByTarget: vi.fn(async () => []),
  },
}));

vi.mock("@/config/db", () => ({
  createDb: vi.fn(() => ({ db: {} })),
}));

describe("OpenAPI doc for audit-log endpoints", () => {
  let doc: any;

  beforeAll(async () => {
    const app = createRouter();
    app.route("/", auditLog);
    app.openapi(getElectionAuditRoute, listElectionAudit);
    app.openapi(getPositionAuditRoute, listPositionAudit);
    app.openapi(getCandidateAuditRoute, listCandidateAudit);
    app.openapi(getUserAuditRoute, listUserAudit);
    app.doc("/docs", { openapi: "3.0.0", info: { title: "Test", version: "1.0.0" } });
    const res = await app.request("/docs");
    doc = await res.json();
  });

  it("registers all 5 paths and references both schemas", () => {
    expect(doc.openapi).toBe("3.0.0");
    const { paths, components } = doc;
    expect(paths["/audit-log"]?.get).toBeDefined();
    expect(paths["/elections/{id}/audit"]?.get).toBeDefined();
    expect(paths["/elections/{id}/positions/{positionId}/audit"]?.get).toBeDefined();
    expect(paths["/candidates/{id}/audit"]?.get).toBeDefined();
    expect(paths["/users/{id}/audit"]?.get).toBeDefined();
    expect(components.schemas).toHaveProperty("AuditLogEntrySchema");
    expect(components.schemas).toHaveProperty("AuditLogListResponse");
  });
});

describe("OpenAPI doc for student-ID constraints", () => {
  it("publishes the student-ID pattern for every user-input schema", async () => {
    const app = createRouter();
    app.openapi(loginRoute, ((c: any) => c.json({})) as any);
    app.openapi(importUsersRoute, ((c: any) => c.json({})) as any);
    app.openapi(createUserRoute, ((c: any) => c.json({})) as any);
    app.doc("/docs", { openapi: "3.0.0", info: { title: "Test", version: "1.0.0" } });

    const doc = (await (await app.request("/docs")).json()) as any;
    const expectedPattern = "^[AC]\\d{2}-\\d{2}-\\d{4,6}-[A-Z]{3}\\d{3}$";
    const loginStudentNumber =
      doc.paths["/login"].post.requestBody.content["application/json"].schema.properties
        .studentNumber;
    const importStudentId =
      doc.components.schemas.ImportUsersBody.properties.users.items.properties.studentId;
    const createStudentId = doc.components.schemas.CreateUserBody.properties.studentId;

    expect(loginStudentNumber.pattern).toBe(expectedPattern);
    expect(importStudentId.pattern).toBe(expectedPattern);
    expect(createStudentId.pattern).toBe(expectedPattern);
  });
});

describe("OpenAPI doc for reset-password validation", () => {
  it("documents the 422 response produced by the validation hook", async () => {
    const app = createRouter();
    app.openapi(resetUserPasswordRoute, ((c: any) => c.json({})) as any);
    app.doc("/docs", { openapi: "3.0.0", info: { title: "Test", version: "1.0.0" } });

    const doc = (await (await app.request("/docs")).json()) as any;
    const responses = doc.paths["/users/{userId}/reset-password"].post.responses;

    expect(responses["422"]).toBeDefined();
  });
});
