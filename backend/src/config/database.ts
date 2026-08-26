import mongoose from "mongoose";
import { z } from "zod";

const helloSchema = z.object({
  setName: z.string().min(1).optional(),
  msg: z.string().optional(),
  logicalSessionTimeoutMinutes: z.number().optional()
});

export type DatabaseHealth = Readonly<{ status: "ready" | "not-ready" }>;

export class DatabaseCapabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseCapabilityError";
  }
}

export function assertTransactionCapability(helloResponse: unknown): void {
  const hello = helloSchema.safeParse(helloResponse);
  if (!hello.success) {
    throw new DatabaseCapabilityError("MongoDB did not return a valid hello response.");
  }

  const isReplicaSet = hello.data.setName !== undefined;
  const isMongos = hello.data.msg === "isdbgrid";
  if ((!isReplicaSet && !isMongos) || hello.data.logicalSessionTimeoutMinutes === undefined) {
    throw new DatabaseCapabilityError(
      "MongoDB must be a transaction-capable replica set or sharded cluster."
    );
  }
}

export async function connectDatabase(uri: string): Promise<void> {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8_000,
    maxPoolSize: 10
  });

  try {
    const database = mongoose.connection.db;
    if (database === undefined) {
      throw new DatabaseCapabilityError("MongoDB connection has no selected database.");
    }
    const hello = await database.admin().command({ hello: 1 });
    assertTransactionCapability(hello);
  } catch (error) {
    await mongoose.disconnect();
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function getDatabaseHealth(): DatabaseHealth {
  return { status: mongoose.connection.readyState === 1 ? "ready" : "not-ready" };
}
