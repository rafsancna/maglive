import { Router } from "express";
import type { DatabaseHealth } from "../../config/database.js";
import { createHealthRouter } from "./health.js";

export function createV1Router(getDatabaseHealth: () => DatabaseHealth): Router {
  const router = Router();
  router.use(createHealthRouter(getDatabaseHealth));
  return router;
}
