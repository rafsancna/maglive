import MongoStore, { createWebCryptoAdapter } from "connect-mongo";
import session, { type Store } from "express-session";
import mongoose from "mongoose";
import type { AppConfig } from "./env.js";

export const SESSION_COOKIE_NAME = "maglive_admin_session";
export const SESSION_COLLECTION_NAME = "admin_sessions";

export function createMongoSessionStore(config: AppConfig): MongoStore {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB must be connected before the administrator session store is created.");
  }

  return MongoStore.create({
    client: mongoose.connection.getClient(),
    collectionName: SESSION_COLLECTION_NAME,
    ttl: Math.ceil(config.sessionAbsoluteTimeoutMs / 1_000),
    autoRemove: "native",
    touchAfter: 60,
    timestamps: true,
    cryptoAdapter: createWebCryptoAdapter({ secret: config.sessionSecret })
  });
}

function resolveStore(config: AppConfig, providedStore: Store | undefined): Store {
  if (providedStore !== undefined) {
    return providedStore;
  }
  if (config.nodeEnv === "test") {
    return new session.MemoryStore();
  }
  throw new Error("A Mongo-backed session store is required outside the test environment.");
}

export function createSessionMiddleware(config: AppConfig, store?: Store) {
  return session({
    name: SESSION_COOKIE_NAME,
    secret: config.sessionSecret,
    store: resolveStore(config, store),
    resave: false,
    saveUninitialized: false,
    rolling: false,
    unset: "destroy",
    cookie: {
      httpOnly: true,
      secure: config.nodeEnv === "production",
      sameSite: "lax",
      path: "/",
      maxAge: config.sessionAbsoluteTimeoutMs
    }
  });
}
