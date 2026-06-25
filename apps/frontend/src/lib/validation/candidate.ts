import { z } from "zod";

export const createCandidateSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(200, "Name too long"),
  manifesto: z.string().min(1, "Manifesto is required").max(5000, "Manifesto too long"),
});

export const updateCandidateSchema = z.object({
  manifesto: z.string().min(1, "Manifesto is required").max(5000, "Manifesto too long").optional(),
  isActive: z.coerce.number().int().min(0).max(1).optional(),
});

export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;
export type UpdateCandidateInput = z.infer<typeof updateCandidateSchema>;
