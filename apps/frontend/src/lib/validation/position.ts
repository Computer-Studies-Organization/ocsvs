import { z } from "zod";

export const createPositionSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

export const updatePositionSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});
