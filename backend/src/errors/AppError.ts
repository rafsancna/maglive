import type { FieldError } from "@maglive/contracts";

export class AppError extends Error {
  readonly details?: readonly FieldError[];

  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    details?: readonly FieldError[]
  ) {
    super(message);
    this.name = "AppError";
    if (details !== undefined) {
      this.details = details;
    }
  }
}
