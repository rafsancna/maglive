import { Router } from "express";
import type { DatabaseHealth } from "../../config/database.js";

export function createHealthRouter(getDatabaseHealth: () => DatabaseHealth): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    const database = getDatabaseHealth();
    const ready = database.status === "ready";
    response.status(ready ? 200 : 503).json({
      data: {
        status: ready ? "ok" : "degraded",
        api: "ready",
        database
      }
    });
  });

  return router;
}
