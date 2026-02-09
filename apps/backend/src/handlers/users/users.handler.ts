import { createDb } from "@/config/db";
import { users } from "@/database/schema";
import { AppRouteHandler } from "@/lib/types/app-types";
import * as httpStatusCodes from "@/openapi/http-status-codes";
import { listUsersRoute } from "@/routes/users/routes";

import { count } from "drizzle-orm";

export const listUsers: AppRouteHandler<typeof listUsersRoute> = async (c) => {
    const { db } = createDb(c);
    const { page, limit } = c.req.valid('query');

    const offset = (page - 1) * limit;

    const [usersResult, totalResult] = await Promise.all([
        db.select().from(users).limit(limit).offset(offset).all(),
        db.select({ count: count() }).from(users).get(),
    ]);

    const total = totalResult?.count ?? 0;
    const totalPages = Math.ceil(total / limit);

    return c.json(
        {
            data: usersResult,
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
