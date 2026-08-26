import type { z } from "zod";
import { AppError } from "../errors/AppError.js";

export function parseRequestValue<TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
  source: "body" | "params" | "query",
): z.output<TSchema> {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  throw new AppError(
    422,
    "VALIDATION_FAILED",
    `The request ${source} is invalid.`,
    result.error.issues.map((issue) => ({
      path: [source, ...issue.path.map(String)].join("."),
      code: "INVALID_VALUE",
      message: issue.message,
    })),
  );
}
