import "express-session";

declare module "express-session" {
  interface SessionData {
    admin?: {
      userId: string;
      startedAtMs: number;
      lastSeenAtMs: number;
      absoluteExpiresAtMs: number;
    };
    csrfTokenHash?: string;
    csrfIssuedAtMs?: number;
  }
}
