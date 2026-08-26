import "dotenv/config";

import { bootstrapAdminRequestSchema } from "@maglive/contracts";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { loadConfig } from "../config/env.js";
import { logger } from "../config/logger.js";
import { bootstrapAdministrator } from "../services/adminBootstrap.js";

function loadBootstrapInput() {
  return bootstrapAdminRequestSchema.parse({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    updateExisting: process.env.ADMIN_UPDATE_EXISTING === "true"
  });
}

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const input = loadBootstrapInput();
  await connectDatabase(config.mongoUri);

  try {
    const result = await bootstrapAdministrator(input);
    logger.info(
      { action: result.action, adminId: result.admin.id, email: result.admin.email },
      "Administrator bootstrap completed"
    );
    process.stdout.write(`Administrator ${result.action}: ${result.admin.email}\n`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error: unknown) => {
  logger.fatal({ error }, "Administrator bootstrap failed");
  process.exitCode = 1;
});
