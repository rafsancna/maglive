import { describe, expect, it } from "vitest";
import {
  DatabaseCapabilityError,
  assertTransactionCapability
} from "../src/config/database.js";
import { requireSafeTestDatabaseUri } from "./helpers/databaseSafety.js";

describe("MongoDB integrity prerequisites", () => {
  it("accepts a session-capable replica set or mongos hello response", () => {
    expect(() =>
      assertTransactionCapability({ setName: "maglive-rs", logicalSessionTimeoutMinutes: 30 })
    ).not.toThrow();
    expect(() =>
      assertTransactionCapability({ msg: "isdbgrid", logicalSessionTimeoutMinutes: 30 })
    ).not.toThrow();
  });

  it("rejects a standalone MongoDB hello response", () => {
    expect(() =>
      assertTransactionCapability({ isWritablePrimary: true, logicalSessionTimeoutMinutes: 30 })
    ).toThrow(DatabaseCapabilityError);
  });

  it("guards database-backed tests by name and replica-set URI", () => {
    const safe = "mongodb://localhost:27017/maglive_test?replicaSet=maglive-rs";
    expect(requireSafeTestDatabaseUri({ MONGODB_TEST_URI: safe })).toBe(safe);
    expect(() =>
      requireSafeTestDatabaseUri({ MONGODB_TEST_URI: "mongodb://localhost:27017/maglive" })
    ).toThrow(/test marker/);
    expect(() =>
      requireSafeTestDatabaseUri({ MONGODB_TEST_URI: "mongodb://localhost:27017/maglive_test" })
    ).toThrow(/replica set/);
    expect(() => requireSafeTestDatabaseUri({})).toThrow(/required/);
  });
});
