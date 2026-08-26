import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { AppConfig } from "./config/env.js";
import { getDatabaseHealth, type DatabaseHealth } from "./config/database.js";
import { logger } from "./config/logger.js";
import { AppError } from "./errors/AppError.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { requestId } from "./middleware/requestId.js";
import { createV1Router } from "./routes/v1/index.js";

export type AppDependencies = Readonly<{
  config: AppConfig;
  databaseHealth?: () => DatabaseHealth;
}>;

export function createApp({ config, databaseHealth = getDatabaseHealth }: AppDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      autoLogging: config.nodeEnv !== "test",
      customProps: (_request, response) => ({
        requestId: response.getHeader("X-Request-Id")
      })
    })
  );
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (origin === undefined || origin === config.frontendOrigin) {
          callback(null, true);
          return;
        }
        callback(new AppError(403, "CORS_ORIGIN_DENIED", "The request origin is not allowed."));
      }
    })
  );
  app.use(express.json({ limit: config.jsonBodyLimitBytes }));

  app.use("/api/v1", createV1Router(databaseHealth));
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
