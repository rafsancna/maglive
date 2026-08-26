import { createServer } from "node:http";
import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";
import { createGracefulShutdown } from "../src/runtime/gracefulShutdown.js";

describe("graceful shutdown", () => {
  it("stops accepting HTTP traffic and closes the database once", async () => {
    const server = createServer((_request, response) => response.end("ok"));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const disconnect = vi.fn(async () => undefined);
    const shutdown = createGracefulShutdown({
      server,
      disconnect,
      logger: pino({ level: "silent" }),
      timeoutMs: 1_000
    });

    await shutdown("SIGTERM");
    await shutdown("SIGINT");

    expect(server.listening).toBe(false);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
