import type { LoginRequest } from "@maglive/contracts";
import { randomBytes } from "node:crypto";
import { AppError } from "../errors/AppError.js";
import { UserModel, type UserDocument } from "../models/User.js";
import { hashPassword, passwordHashNeedsUpgrade, verifyPassword } from "../auth/password.js";

const dummyPasswordHash = hashPassword(randomBytes(32).toString("base64url"));

export async function authenticateAdministrator(credentials: LoginRequest): Promise<UserDocument> {
  const user = await UserModel.findOne({ email: credentials.email }).select("+passwordHash");
  const passwordHash = user?.passwordHash ?? (await dummyPasswordHash);
  const passwordMatches = await verifyPassword(passwordHash, credentials.password);

  if (user === null || !passwordMatches || !user.active) {
    throw new AppError(401, "INVALID_CREDENTIALS", "The email or password is incorrect.");
  }

  if (passwordHashNeedsUpgrade(user.passwordHash)) {
    user.passwordHash = await hashPassword(credentials.password);
    user.passwordChangedAt = new Date();
  }
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}
