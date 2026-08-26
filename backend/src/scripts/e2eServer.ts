import "dotenv/config";

import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { createApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { loadConfig, type AppConfig } from "../config/env.js";
import { logger } from "../config/logger.js";
import { createMongoSessionStore } from "../config/session.js";
import {
  CategoryModel,
  type PublishedCategoryGlobal,
  type PublishedCategoryLocale,
  type PublishedCategoryLocaleData,
} from "../models/Category.js";
import { MediaModel } from "../models/Media.js";
import {
  ProductModel,
  type PublishedProductGlobal,
  type PublishedProductLocale,
  type PublishedProductLocaleData,
} from "../models/Product.js";
import { UserModel } from "../models/User.js";
import { bootstrapAdministrator } from "../services/adminBootstrap.js";

const E2E_PORT = Number(process.env.PORT) || 5100;
const E2E_FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
const E2E_ADMIN_EMAIL = "admin@example.com";
const E2E_ADMIN_PASSWORD = "Correct horse battery staple 42!";

function makeConfig(mongoUri: string): AppConfig {
  const secrets = "e2e-secret-" + "0".repeat(32);
  return loadConfig({
    NODE_ENV: "development",
    PORT: String(E2E_PORT),
    MONGODB_URI: mongoUri,
    FRONTEND_ORIGIN: E2E_FRONTEND_ORIGIN,
    SESSION_SECRET: secrets,
    PREVIEW_SIGNING_SECRET: secrets,
    PREVIEW_EXCHANGE_SECRET: secrets,
    UPLOAD_ROOT: "./uploads-e2e",
    PUBLIC_MEDIA_BASE_URL: `http://localhost:${E2E_PORT}/uploads`,
    NEXT_REVALIDATION_URL: `${E2E_FRONTEND_ORIGIN}/api/internal/revalidate`,
    NEXT_REVALIDATION_SECRET: secrets,
    TRUST_PROXY: "false",
  });
}

function hash64(): string {
  return randomUUID().replace(/-/g, "").repeat(2).slice(0, 64);
}

function categorySnapshot(name: string, globalRevision: string): PublishedCategoryLocale {
  return {
    sourceVersion: 0,
    sourceHash: hash64(),
    globalRevision,
    publicationRevision: randomUUID(),
    publishedAt: new Date(),
    data: {
      name,
      seo: { title: name },
    } satisfies PublishedCategoryLocaleData,
  };
}

async function seedPublishedCategory(input: {
  slug: string;
  parentId: Types.ObjectId | null;
  sortOrder: number;
  globalRevision: string;
  names: { en: string; zh: string };
  actorId: Types.ObjectId;
}): Promise<Types.ObjectId> {
  const global: PublishedCategoryGlobal = {
    sourceVersion: 0,
    sourceHash: hash64(),
    globalRevision: input.globalRevision,
    publishedAt: new Date(),
    data: {
      slug: input.slug,
      parentId: input.parentId,
      sortOrder: input.sortOrder,
    },
  };
  const category = await CategoryModel.create({
    slug: input.slug,
    parentId: input.parentId,
    sortOrder: input.sortOrder,
    translations: new Map([
      ["en", { name: input.names.en, seo: {} }],
      ["zh", { name: input.names.zh, seo: {} }],
    ]),
    publishedGlobal: global,
    publishedSnapshots: new Map([
      ["en", categorySnapshot(input.names.en, input.globalRevision)],
      ["zh", categorySnapshot(input.names.zh, input.globalRevision)],
    ]),
    status: "active",
    firstPublishedAt: new Date(),
    createdBy: input.actorId,
    updatedBy: input.actorId,
  });
  return category._id;
}

type LocalizedProductCopy = {
  name: string;
  shortDescription: string;
  longDescriptionMarkdown?: string;
};

function productLocaleSnapshot(
  locale: LocalizedProductCopy,
  globalRevision: string,
  label: { electrical: string; maximumPower: string },
): PublishedProductLocale {
  return {
    sourceVersion: 0,
    sourceHash: hash64(),
    globalRevision,
    publicationRevision: randomUUID(),
    publishedAt: new Date(),
    data: {
      name: locale.name,
      shortDescription: locale.shortDescription,
      ...(locale.longDescriptionMarkdown === undefined
        ? {}
        : { longDescriptionMarkdown: locale.longDescriptionMarkdown }),
      features: [],
      advantages: [],
      applications: [],
      seo: { title: locale.name, keywords: [] },
      specifications: [
        {
          key: "electrical",
          label: label.electrical,
          items: [{ key: "maximum-power", label: label.maximumPower }],
        },
      ],
      mediaUsages: [],
    } satisfies PublishedProductLocaleData,
  };
}

function productWorkingTranslation(locale: LocalizedProductCopy) {
  return {
    name: locale.name,
    shortDescription: locale.shortDescription,
    ...(locale.longDescriptionMarkdown === undefined
      ? {}
      : { longDescriptionMarkdown: locale.longDescriptionMarkdown }),
    features: [],
    advantages: [],
    applications: [],
    seo: {},
  };
}

async function seedPublishedProduct(input: {
  slug: string;
  categoryId: Types.ObjectId;
  actorId: Types.ObjectId;
  displayOrder: number;
  featured: boolean;
  model: string;
  series: string;
  en: LocalizedProductCopy;
  zh: LocalizedProductCopy;
}): Promise<void> {
  const globalRevision = randomUUID();
  const maximumPower = input.model.includes("630") ? "630" : "550";

  const global: PublishedProductGlobal = {
    sourceVersion: 0,
    sourceHash: hash64(),
    globalRevision,
    publishedAt: new Date(),
    data: {
      slug: input.slug,
      categoryId: input.categoryId,
      model: input.model,
      series: input.series,
      specifications: [
        {
          key: "electrical",
          order: 0,
          items: [{ key: "maximum-power", order: 0, value: maximumPower, unit: "W" }],
        },
      ],
      mediaUsages: [],
      pageTemplate: "topcon-premium",
      displayOrder: input.displayOrder,
      featured: input.featured,
    },
  };

  const product = await ProductModel.create({
    slug: input.slug,
    categoryId: input.categoryId,
    model: input.model,
    series: input.series,
    translations: new Map([
      ["en", productWorkingTranslation(input.en)],
      ["zh", productWorkingTranslation(input.zh)],
    ]),
    specifications: [
      {
        key: "electrical",
        order: 0,
        translations: new Map([
          ["en", { label: "Electrical characteristics" }],
          ["zh", { label: "电气参数" }],
        ]),
        items: [
          {
            key: "maximum-power",
            order: 0,
            value: maximumPower,
            unit: "W",
            translations: new Map([
              ["en", { label: "Maximum power" }],
              ["zh", { label: "最大功率" }],
            ]),
          },
        ],
      },
    ],
    mediaUsages: [],
    pageTemplate: "topcon-premium",
    displayOrder: input.displayOrder,
    featured: input.featured,
    publishedGlobal: global,
    publishedSnapshots: new Map([
      [
        "en",
        productLocaleSnapshot(input.en, globalRevision, {
          electrical: "Electrical characteristics",
          maximumPower: "Maximum power",
        }),
      ],
      [
        "zh",
        productLocaleSnapshot(input.zh, globalRevision, {
          electrical: "电气参数",
          maximumPower: "最大功率",
        }),
      ],
    ]),
    status: "published",
    firstPublishedAt: new Date(),
    createdBy: input.actorId,
    updatedBy: input.actorId,
  });

  logger.info({ slug: product.slug }, "E2E product seeded");
}

async function seedCatalog(actorId: Types.ObjectId): Promise<void> {
  const globalRevision = randomUUID();

  const rootId = await seedPublishedCategory({
    slug: "solar",
    parentId: null,
    sortOrder: 0,
    globalRevision,
    names: { en: "Solar", zh: "太阳能" },
    actorId,
  });

  const leafId = await seedPublishedCategory({
    slug: "modules",
    parentId: rootId,
    sortOrder: 0,
    globalRevision,
    names: { en: "Modules", zh: "组件" },
    actorId,
  });

  await seedPublishedProduct({
    slug: "630w-topcon",
    categoryId: leafId,
    actorId,
    displayOrder: 10,
    featured: true,
    model: "MG-630N",
    series: "N-Type",
    en: {
      name: "630 W TOPCon module",
      shortDescription: "High-output bifacial solar module.",
      longDescriptionMarkdown: "Designed for utility-scale solar generation with industry-leading efficiency.",
    },
    zh: {
      name: "630瓦TOPCon组件",
      shortDescription: "高功率双面太阳能组件。",
      longDescriptionMarkdown: "专为大型太阳能项目设计，具有业界领先的转换效率。",
    },
  });

  await seedPublishedProduct({
    slug: "550w-perc",
    categoryId: leafId,
    actorId,
    displayOrder: 20,
    featured: false,
    model: "MG-550M",
    series: "P-Type",
    en: {
      name: "550 W PERC module",
      shortDescription: "Reliable mono-facial PERC solar module.",
    },
    zh: {
      name: "550瓦PERC组件",
      shortDescription: "可靠的单面PERC太阳能组件。",
    },
  });

  logger.info("E2E catalog seeded");
}

async function listen(app: ReturnType<typeof createApp>, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.once("error", reject);
  });
}

async function main(): Promise<void> {
  logger.info("Starting E2E test environment…");

  const replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const mongoUri = replicaSet.getUri("maglive_e2e");
  logger.info("MongoDB replica set ready");

  await connectDatabase(mongoUri);
  await Promise.all([
    UserModel.syncIndexes(),
    CategoryModel.syncIndexes(),
    MediaModel.syncIndexes(),
    ProductModel.syncIndexes(),
  ]);
  logger.info("Indexes synced");

  const admin = await bootstrapAdministrator({
    email: E2E_ADMIN_EMAIL,
    password: E2E_ADMIN_PASSWORD,
    updateExisting: true,
  });
  logger.info({ email: admin.admin.email, action: admin.action }, "Admin bootstrapped");

  await seedCatalog(new Types.ObjectId());

  const config = makeConfig(mongoUri);
  const sessionStore = createMongoSessionStore(config);
  const app = createApp({ config, sessionStore });
  const server = await listen(app, E2E_PORT);
  logger.info({ port: E2E_PORT }, "E2E API server ready");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "E2E server shutting down");
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDatabase();
    await replicaSet.stop({ force: true });
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  process.stdout.write(`E2E_SERVER_PORT=${E2E_PORT}\n`);
}

main().catch((error: unknown) => {
  logger.fatal({ error }, "E2E server startup failed");
  process.exitCode = 1;
});