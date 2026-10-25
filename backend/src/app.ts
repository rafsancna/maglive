import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Store } from "express-session";
import type { AppConfig } from "./config/env.js";
import { getDatabaseHealth, type DatabaseHealth } from "./config/database.js";
import { logger } from "./config/logger.js";
import { createSessionMiddleware } from "./config/session.js";
import { AppError } from "./errors/AppError.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { requestId } from "./middleware/requestId.js";
import { createV1Router } from "./routes/v1/index.js";
import { LocalStorageProvider } from "./storage/LocalStorageProvider.js";
import { createFlagAssetsMiddleware } from "./storage/flagAssets.js";
import { createLocalMediaMiddleware } from "./storage/localMediaMiddleware.js";
import {
  FLAGS_ROUTE_PREFIX,
  MEDIA_ROUTE_PREFIX,
  createPublicOriginsMiddleware,
} from "./storage/publicMedia.js";
import type { StorageProvider } from "./storage/StorageProvider.js";
import type { MediaJobQueue } from "./media/mediaQueue.js";

export type AppDependencies = Readonly<{
  config: AppConfig;
  databaseHealth?: () => DatabaseHealth;
  sessionStore?: Store;
  storageProvider?: StorageProvider;
  mediaQueue?: MediaJobQueue;
  now?: () => number;
}>;

export function createApp({
  config,
  databaseHealth = getDatabaseHealth,
  sessionStore,
  storageProvider = new LocalStorageProvider(
    config.uploadRoot,
    config.publicMediaBaseUrl
  ),
  mediaQueue,
  now
}: AppDependencies): Express {
  const mediaSources =
    config.publicMediaBaseUrl !== "" && !config.publicMediaBaseUrl.startsWith("/")
      ? [config.publicMediaBaseUrl]
      : [];
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);

  app.use(requestId);
  // Resolves the public origin of this request so media links can be built for
  // whichever domain, IP address or proxy the deployment runs behind.
  app.use(createPublicOriginsMiddleware());
  app.use(
    pinoHttp({
      logger,
      autoLogging: config.nodeEnv !== "test",
      customProps: (_request, response) => ({
        requestId: response.getHeader("X-Request-Id")
      })
    })
  );
  app.use(
    helmet({
      contentSecurityPolicy:
        config.nodeEnv === "production"
          ? {
              directives: {
                defaultSrc: ["'self'"],
                baseUri: ["'self'"],
                frameAncestors: ["'none'"],
                objectSrc: ["'none'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", ...mediaSources],
                mediaSrc: ["'self'", ...mediaSources],
                connectSrc: ["'self'"],
              },
            }
          : false,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      crossOriginOpenerPolicy: { policy: "same-origin" },
      frameguard: { action: "deny" },
      noSniff: true,
      hsts:
        config.nodeEnv === "production"
          ? { maxAge: 31536000, includeSubDomains: true, preload: true }
          : false,
    }),
  );
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
  app.use(createSessionMiddleware(config, sessionStore));

  if (storageProvider instanceof LocalStorageProvider) {
    app.use(MEDIA_ROUTE_PREFIX, createLocalMediaMiddleware(storageProvider));
  }
  // Bundled country flags, available to every site origin.
  app.use(FLAGS_ROUTE_PREFIX, createFlagAssetsMiddleware());

  app.use(
    "/api/v1",
    createV1Router(databaseHealth, config, now, storageProvider, mediaQueue)
  );
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
