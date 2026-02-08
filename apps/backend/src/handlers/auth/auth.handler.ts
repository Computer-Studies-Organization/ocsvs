
import { createDb } from "@/config/db";
import { accounts, users } from "@/database/schema";
import { AppRouteHandler } from "@/lib/types/app-types";
import * as httpStatusCodes from "@/openapi/http-status-codes";
import { loginRoute, registerRoute } from "@/routes/auth/routes";
import { eq, or } from "drizzle-orm";

export const register: AppRouteHandler<typeof registerRoute> = async (c) => {
    const {
        firstName,
        lastName,
        email,
        username,
        password,
        studentId,
        course,
        yearLevel,
    } = c.req.valid("json");
    const { db } = createDb(c);

    const existing = await db
        .select()
        .from(accounts)
        .where(or(eq(accounts.email, email), eq(accounts.username, username)))
        .get();

    if (existing) {
        return c.json(
            { message: "User already exists" },
            httpStatusCodes.CONFLICT
        );
    }

    const accountId = crypto.randomUUID();
    const passwordHash = password; // TODO: Hash password

    await db
        .insert(accounts)
        .values({
            id: accountId,
            username,
            email,
            password_hash: passwordHash,
            role: "user",
        })
        .run();

    await db
        .insert(users)
        .values({
            id: crypto.randomUUID(),
            accountId,
            studentId,
            firstName,
            lastName,
            course,
            yearLevel,
        })
        .run();

    return c.json(
        {
            message: "User registered successfully",
            user: {
                id: accountId,
                email,
                username,
                role: "user",
                studentId,
            },
        },
        httpStatusCodes.OK
    );
};

export const login: AppRouteHandler<typeof loginRoute> = async (c) => {
    const { email, password } = c.req.valid("json");
    const { db } = createDb(c);

    const account = await db
        .select()
        .from(accounts)
        .where(eq(accounts.email, email))
        .get();

    if (!account || account.password_hash !== password) {
        return c.json(
            { message: "Unauthorized" },
            httpStatusCodes.UNAUTHORIZED
        );
    }

    return c.json(
        {
            message: "User logged in successfully",
            token: "placeholder-token",
            user: {
                id: account.id,
                email: account.email,
                username: account.username,
            },
        },
        httpStatusCodes.OK
    );
};
