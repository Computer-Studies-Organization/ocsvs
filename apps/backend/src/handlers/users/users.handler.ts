import { createDb } from "@/config/db";
import { users } from "@/database/schema";
import { AppRouteHandler } from "@/lib/types/app-types";
import * as httpStatusCodes from "@/openapi/http-status-codes";
import { listUsersRoute } from "@/routes/users/routes";

export const listUsers: AppRouteHandler<typeof listUsersRoute> = async (c) => {
    const { db } = createDb(c);

    const result = await db.select().from(users).all();

    return c.json(
        result,
        httpStatusCodes.OK
    );
};
