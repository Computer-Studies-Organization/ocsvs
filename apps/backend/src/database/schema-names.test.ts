import { z } from "@hono/zod-openapi";
import { describe, expect, it } from "vitest";
import { UserApiSchema } from "./openapi-schemas";
import { DbSelectUserSchema, elections, positions } from "./schema";

describe("user schema exports", () => {
  it("uses distinct names for database and API user schemas", () => {
    expect(DbSelectUserSchema).toBeDefined();
    expect(UserApiSchema).toBeDefined();
  });

  it("keeps integer storage in the database schema and does not leak hasVoted into the API", () => {
    const baseUser = {
      createdAt: 1,
      updatedAt: 1,
      id: "user-1",
      accountId: "account-1",
      studentId: "2023-12345",
      firstName: "John",
      lastName: "Doe",
      yearLevel: "3rd Year",
      course: "BSCS",
    };

    // DB select: only the persisted integer columns; no hasVoted in DB or API
    const dbRow = DbSelectUserSchema.parse(baseUser);
    expect(dbRow).toEqual(baseUser);
    expect((dbRow as { hasVoted?: unknown }).hasVoted).toBeUndefined();

    // API schema: also has no hasVoted (votes table is the source of truth)
    const apiRow = UserApiSchema.parse(baseUser);
    expect((apiRow as { hasVoted?: unknown }).hasVoted).toBeUndefined();
  });

  it("produces an OpenAPI-capable zod schema for API routes", () => {
    expect(UserApiSchema).toBeInstanceOf(z.ZodObject);
  });
});

describe("election management schema", () => {
  it("exports the new elections and positions tables", () => {
    expect(elections).toBeDefined();
    expect(positions).toBeDefined();
  });
});
