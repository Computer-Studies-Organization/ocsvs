import { z } from "zod";

export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { ok: true; data: T } | { ok: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    errors: Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message])),
  };
}
