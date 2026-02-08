import { createDb } from "@/config/db";
import { accounts, users } from "@/database/schema";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, setSessionCookie, deleteSession, clearSessionCookie, getSessionIdFromCookie } from "@/lib/session";
import { AppRouteHandler } from "@/lib/types/app-types";
import * as httpStatusCodes from "@/openapi/http-status-codes";
import { loginRoute, logoutRoute, meRoute, registerRoute } from "@/routes/auth/routes";
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
    const passwordHash = await hashPassword(password);

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
    const { identifier, password } = c.req.valid("json");
    const { db } = createDb(c);

    // Try finding by email or username first
    let account = await db
        .select()
        .from(accounts)
        .where(or(eq(accounts.email, identifier), eq(accounts.username, identifier)))
        .get();

    // If not found, check studentId via users table (joined)
    if (!account) {
        const result = await db
            .select({
                id: accounts.id,
                email: accounts.email,
                username: accounts.username,
                password_hash: accounts.password_hash,
                role: accounts.role,
                createdAt: accounts.createdAt,
                updatedAt: accounts.updatedAt,
                lastLogin: accounts.lastLogin,
            })
            .from(users)
            .innerJoin(accounts, eq(users.accountId, accounts.id))
            .where(eq(users.studentId, identifier))
            .get();

        if (result) {
            account = result;
        }
    }

    if (!account) {
        return c.json(
            { message: "Invalid credentials" },
            httpStatusCodes.UNAUTHORIZED
        );
    }

    const isValid = await verifyPassword(password, account.password_hash);
    if (!isValid) {
        return c.json(
            { message: "Invalid credentials" },
            httpStatusCodes.UNAUTHORIZED
        );
    }

    // Create session and set cookie
    const session = await createSession(db, account.id);
    setSessionCookie(c, session.id, session.expiresAt);

    return c.json(
        {
            message: "User logged in successfully",
            user: {
                id: account.id,
                email: account.email,
                username: account.username,
                role: account.role,
            },
        },
        httpStatusCodes.OK
    );
};

export const logout: AppRouteHandler<typeof logoutRoute> = async (c) => {
    const { db } = createDb(c);
    const sessionId = getSessionIdFromCookie(c);

    if (sessionId) {
        await deleteSession(db, sessionId);
    }

    clearSessionCookie(c);

    return c.json(
        { message: "Logged out successfully" },
        httpStatusCodes.OK
    );
};

export const me: AppRouteHandler<typeof meRoute> = async (c) => {
    const account = c.var.authUser;

    return c.json(
        {
            user: {
                id: account.id,
                email: account.email,
                username: account.username,
                role: account.role,
            },
        },
        httpStatusCodes.OK
    );
};
