import { z } from "zod";

export function validateAdminPayload<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown
): { success: true; data: z.infer<TSchema> } | { success: false; error: { error: string; issues: z.ZodIssue[] } } {
  const result = schema.safeParse(value);

  if (!result.success) {
    return {
      success: false,
      error: {
        error: "Invalid admin payload",
        issues: result.error.issues
      }
    };
  }

  return { success: true, data: result.data };
}
