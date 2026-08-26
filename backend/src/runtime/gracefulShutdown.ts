import type { Server } from "node:http";
import type { Logger } from "pino";

type GracefulShutdownDependencies = Readonly<{
  server: Server;
  disconnect: () => Promise<void>;
  logger: Logger;
  timeoutMs?: number;
}>;

export function createGracefulShutdown({
  server,
  disconnect,
  logger,
  timeoutMs = 10_000
}: GracefulShutdownDependencies): (signal: NodeJS.Signals) => Promise<void> {
  let shuttingDown = false;

  return async (signal) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "Graceful shutdown started");

    const forcedShutdown = setTimeout(() => {
      logger.error("Graceful shutdown timed out");
      server.closeAllConnections();
      process.exitCode = 1;
    }, timeoutMs);
    forcedShutdown.unref();

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      });
      await disconnect();
      logger.info("Graceful shutdown completed");
    } finally {
      clearTimeout(forcedShutdown);
    }
  };
}
