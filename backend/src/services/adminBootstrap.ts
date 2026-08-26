import {
  bootstrapAdminRequestSchema,
  type BootstrapAdminRequest,
  type SafeAdminDto
} from "@maglive/contracts";
import { hashPassword } from "../auth/password.js";
import { UserModel, toSafeAdminDto } from "../models/User.js";

export class AdministratorAlreadyExistsError extends Error {
  constructor(email: string) {
    super(`An administrator with email ${email} already exists. Set ADMIN_UPDATE_EXISTING=true to update it.`);
    this.name = "AdministratorAlreadyExistsError";
  }
}

export type BootstrapAdminResult = Readonly<{
  action: "created" | "updated";
  admin: SafeAdminDto;
}>;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11_000
  );
}

export async function bootstrapAdministrator(
  rawInput: BootstrapAdminRequest
): Promise<BootstrapAdminResult> {
  const input = bootstrapAdminRequestSchema.parse(rawInput);
  const existing = await UserModel.findOne({ email: input.email }).select("+passwordHash");

  if (existing !== null) {
    if (!input.updateExisting) {
      throw new AdministratorAlreadyExistsError(input.email);
    }

    existing.passwordHash = await hashPassword(input.password);
    existing.passwordChangedAt = new Date();
    existing.active = true;
    await existing.save();
    return { action: "updated", admin: toSafeAdminDto(existing) };
  }

  try {
    const created = await UserModel.create({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      passwordChangedAt: new Date(),
      role: "admin",
      active: true
    });
    return { action: "created", admin: toSafeAdminDto(created) };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AdministratorAlreadyExistsError(input.email);
    }
    throw error;
  }
}
