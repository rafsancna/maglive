export const DEFAULT_ADMIN_RETURN_PATH = "/admin";

export function getSafeAdminReturnPath(value: string | null | undefined): string {
  if (
    value === null ||
    value === undefined ||
    !value.startsWith("/admin") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return DEFAULT_ADMIN_RETURN_PATH;
  }

  try {
    const parsed = new URL(value, "https://admin-return.invalid");
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    if (
      parsed.origin !== "https://admin-return.invalid" ||
      parsed.pathname === "/admin/login" ||
      parsed.pathname.startsWith("/admin/login/") ||
      normalized !== value
    ) {
      return DEFAULT_ADMIN_RETURN_PATH;
    }
    return normalized;
  } catch {
    return DEFAULT_ADMIN_RETURN_PATH;
  }
}

export function buildAdminLoginPath(returnPath: string): string {
  const safeReturnPath = getSafeAdminReturnPath(returnPath);
  return `/admin/login?returnTo=${encodeURIComponent(safeReturnPath)}`;
}
