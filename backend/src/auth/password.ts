import argon2 from "argon2";

export const ARGON2ID_PARAMETERS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32
});

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2ID_PARAMETERS);
}

export async function verifyPassword(passwordHash: string, candidate: string): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, candidate);
  } catch {
    return false;
  }
}

export function passwordHashNeedsUpgrade(passwordHash: string): boolean {
  try {
    return argon2.needsRehash(passwordHash, ARGON2ID_PARAMETERS);
  } catch {
    return true;
  }
}
