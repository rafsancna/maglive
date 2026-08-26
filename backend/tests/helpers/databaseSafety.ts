const TEST_DATABASE_PATTERN = /(?:^|[_-])test(?:$|[_-])/i;

export function requireSafeTestDatabaseUri(environment: NodeJS.ProcessEnv): string {
  const value = environment.MONGODB_TEST_URI;
  if (value === undefined || value === "") {
    throw new Error("MONGODB_TEST_URI is required for database-backed tests.");
  }

  const url = new URL(value);
  if (url.protocol !== "mongodb:" && url.protocol !== "mongodb+srv:") {
    throw new Error("MONGODB_TEST_URI must use a MongoDB protocol.");
  }

  const databaseName = url.pathname.replace(/^\//, "");
  if (!TEST_DATABASE_PATTERN.test(databaseName)) {
    throw new Error("MONGODB_TEST_URI database name must contain an explicit test marker.");
  }

  if (url.protocol === "mongodb:" && url.searchParams.get("replicaSet") === null) {
    throw new Error("MONGODB_TEST_URI must identify a transaction-capable replica set.");
  }

  return value;
}
