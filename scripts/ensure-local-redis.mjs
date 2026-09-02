import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379");
const host =
  redisUrl.hostname === "localhost" ? "127.0.0.1" : redisUrl.hostname;
const port = redisUrl.port === "" ? 6379 : Number.parseInt(redisUrl.port, 10);

function pingRedis(timeoutMs = 750) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let response = "";
    let settled = false;
    const finish = (ready) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ready);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once("error", () => finish(false));
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      if (response.includes("+PONG")) finish(true);
    });
    socket.once("connect", () => socket.write("*1\r\n$4\r\nPING\r\n"));
  });
}

async function isFile(candidate) {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function findRecursively(directory, filename, depth = 4) {
  if (depth < 0) return undefined;
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return undefined;
  }
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === filename)
      return candidate;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const result = await findRecursively(
      path.join(directory, entry.name),
      filename,
      depth - 1,
    );
    if (result !== undefined) return result;
  }
  return undefined;
}

async function findRedisServer() {
  const executable =
    process.platform === "win32" ? "redis-server.exe" : "redis-server";
  const configured = process.env.REDIS_SERVER_PATH;
  if (configured !== undefined && (await isFile(configured))) return configured;
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    if (directory === "") continue;
    const candidate = path.join(directory, executable);
    if (await isFile(candidate)) return candidate;
  }
  if (process.platform === "win32" && process.env.LOCALAPPDATA !== undefined) {
    const packageRoot = path.join(
      process.env.LOCALAPPDATA,
      "Microsoft",
      "WinGet",
      "Packages",
    );
    return findRecursively(packageRoot, executable);
  }
  return undefined;
}

function redisConfigPath(input) {
  if (process.platform !== "win32") return input;
  const match = /^([a-z]):[\\/](.*)$/i.exec(input);
  if (match === null) return input.replaceAll("\\", "/");
  return `/cygdrive/${match[1].toLowerCase()}/${match[2].replaceAll("\\", "/")}`;
}

async function ensureLocalRedis() {
  if (await pingRedis()) {
    console.log(`Redis is ready at ${host}:${port}.`);
    return;
  }
  if (host !== "127.0.0.1" && host !== "::1") {
    throw new Error(
      `Redis is unavailable at ${host}:${port}. Start it before running Maglive.`,
    );
  }
  const redisServer = await findRedisServer();
  if (redisServer === undefined) {
    throw new Error(
      "Redis is not installed. Install Redis or set REDIS_SERVER_PATH before running Maglive.",
    );
  }
  const runtimeRoot =
    process.platform === "win32" && process.env.LOCALAPPDATA !== undefined
      ? path.join(process.env.LOCALAPPDATA, "Maglive")
      : path.join(process.cwd(), ".runtime", "redis");
  const dataRoot = path.join(runtimeRoot, "redis-data");
  const configPath = path.join(runtimeRoot, "redis.conf");
  await mkdir(dataRoot, { recursive: true });
  await writeFile(
    configPath,
    [
      "bind 127.0.0.1 -::1",
      "protected-mode yes",
      `port ${port}`,
      "daemonize no",
      "supervised no",
      "loglevel notice",
      `logfile \"${redisConfigPath(path.join(runtimeRoot, "redis.log"))}\"`,
      "databases 16",
      "always-show-logo no",
      "save 900 1",
      "save 300 10",
      "save 60 10000",
      "stop-writes-on-bgsave-error yes",
      "rdbcompression yes",
      "rdbchecksum yes",
      "dbfilename dump.rdb",
      `dir \"${redisConfigPath(dataRoot)}\"`,
      "appendonly yes",
      'appendfilename "appendonly.aof"',
      'appenddirname "appendonlydir"',
      "appendfsync everysec",
      "aof-load-truncated yes",
      "",
    ].join("\n"),
    "utf8",
  );
  const child = spawn(redisServer, [redisConfigPath(configPath)], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (await pingRedis()) {
      console.log(`Started Redis at ${host}:${port}.`);
      return;
    }
  }
  throw new Error(`Redis could not be started at ${host}:${port}.`);
}

await ensureLocalRedis();
