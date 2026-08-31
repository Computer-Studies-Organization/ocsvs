import { z } from "zod";

export const createCandidateSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(200, "Name too long"),
  manifesto: z.string().max(5000, "Manifesto too long"),
});

export const updateCandidateSchema = z
  .object({
    manifesto: z.string().max(5000, "Manifesto too long").optional(),
  })
  .strict();
