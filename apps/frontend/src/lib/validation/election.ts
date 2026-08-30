import { z } from "zod";

export const createElectionSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  description: z.string().max(1000, "Description too long").optional(),
});

export const updateElectionSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long").optional(),
  description: z.string().max(1000, "Description too long").nullable().optional(),
});
