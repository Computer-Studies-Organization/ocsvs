import { z } from "zod";

export const createPositionSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

export type CreatePositionInput = z.infer<typeof createPositionSchema>;
