import { createDb } from "@/config/db";
import { candidates, accounts } from "@/database/schema";
import { AppRouteHandler } from "@/lib/types/app-types";
import * as httpStatusCodes from "@/openapi/http-status-codes";
import {
    createCandidateRoute,
    listCandidatesRoute,
    getCandidateRoute,
    updateCandidateRoute,
    deleteCandidateRoute
} from "@/routes/candidates/routes";
import { eq, count, and } from "drizzle-orm";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

export const createCandidate: AppRouteHandler<typeof createCandidateRoute> = async (c) => {
    const { fullName, accountId, position, manifesto } = c.req.valid("json");
    const { db } = createDb(c);

    // Check if the account exists
    const account = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .get();

    if (!account) {
        return c.json(
            { message: ERROR_MESSAGES.ACCOUNT_NOT_FOUND },
            httpStatusCodes.BAD_REQUEST
        );
    }

    // Check if this account already has a candidate for this position
    const existingCandidate = await db
        .select()
        .from(candidates)
        .where(and(
            eq(candidates.accountId, accountId),
            eq(candidates.position, position),
            eq(candidates.isActive, 1)
        ))
        .get();

    if (existingCandidate) {
        return c.json(
            { message: ERROR_MESSAGES.CANDIDATE_ALREADY_EXISTS },
            httpStatusCodes.CONFLICT
        );
    }

    const candidateId = crypto.randomUUID();

    await db
        .insert(candidates)
        .values({
            id: candidateId,
            fullName,
            accountId,
            position,
            manifesto,
        })
        .run();

    return c.json(
        {
            message: ERROR_MESSAGES.CANDIDATE_CREATED_SUCCESSFULLY,
            candidate: {
                id: candidateId,
                fullName,
                accountId,
                position,
                manifesto,
            },
        },
        httpStatusCodes.OK
    );
};

export const listCandidates: AppRouteHandler<typeof listCandidatesRoute> = async (c) => {
    const { db } = createDb(c);
    const { page, limit } = c.req.valid('query');

    const offset = (page - 1) * limit;

    const [candidatesResult, totalResult] = await Promise.all([
        db.select().from(candidates).where(eq(candidates.isActive, 1)).limit(limit).offset(offset).all(),
        db.select({ count: count() }).from(candidates).where(eq(candidates.isActive, 1)).get(),
    ]);

    const total = totalResult?.count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return c.json(
        {
            data: candidatesResult,
            meta: {
                total,
                page,
                limit,
                totalPages,
            },
        },
        httpStatusCodes.OK
    );
};

export const getCandidate: AppRouteHandler<typeof getCandidateRoute> = async (c) => {
    const { id } = c.req.valid('param');
    const { db } = createDb(c);

    const candidate = await db
        .select()
        .from(candidates)
        .where(and(
            eq(candidates.id, id),
            eq(candidates.isActive, 1)
        ))
        .get();

    if (!candidate) {
        return c.json(
            { message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND },
            httpStatusCodes.NOT_FOUND
        );
    }

    return c.json(candidate, httpStatusCodes.OK);
};

export const updateCandidate: AppRouteHandler<typeof updateCandidateRoute> = async (c) => {
    const { id } = c.req.valid('param');
    const updateData = c.req.valid("json");
    const { db } = createDb(c);

    // Check if candidate exists
    const existingCandidate = await db
        .select()
        .from(candidates)
        .where(and(
            eq(candidates.id, id),
            eq(candidates.isActive, 1)
        ))
        .get();

    if (!existingCandidate) {
        return c.json(
            { message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND },
            httpStatusCodes.NOT_FOUND
        );
    }

    // Update candidate
    await db
        .update(candidates)
        .set({
            ...updateData,
            updatedAt: Date.now(),
        })
        .where(eq(candidates.id, id))
        .run();

    // Get updated candidate
    const updatedCandidate = await db
        .select()
        .from(candidates)
        .where(eq(candidates.id, id))
        .get();

    return c.json(
        {
            message: ERROR_MESSAGES.CANDIDATE_UPDATED_SUCCESSFULLY,
            candidate: updatedCandidate,
        },
        httpStatusCodes.OK
    );
};

export const deleteCandidate: AppRouteHandler<typeof deleteCandidateRoute> = async (c) => {
    const { id } = c.req.valid('param');
    const { db } = createDb(c);

    // Check if candidate exists
    const existingCandidate = await db
        .select()
        .from(candidates)
        .where(and(
            eq(candidates.id, id),
            eq(candidates.isActive, 1)
        ))
        .get();

    if (!existingCandidate) {
        return c.json(
            { message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND },
            httpStatusCodes.NOT_FOUND
        );
    }

    // Soft delete candidate
    await db
        .update(candidates)
        .set({
            isActive: 0,
            updatedAt: Date.now(),
        })
        .where(eq(candidates.id, id))
        .run();

    return c.json(
        { message: ERROR_MESSAGES.CANDIDATE_DELETED_SUCCESSFULLY },
        httpStatusCodes.OK
    );
};