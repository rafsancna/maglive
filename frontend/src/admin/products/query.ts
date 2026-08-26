import {
  adminProductListQuerySchema,
  type AdminProductListQuery,
} from "@maglive/contracts";

type SearchParameters = Pick<URLSearchParams, "entries" | "getAll">;

export type ParsedProductListQuery =
  | Readonly<{ success: true; query: AdminProductListQuery }>
  | Readonly<{ success: false; message: string }>;

export function parseProductListQuery(
  searchParameters: SearchParameters,
): ParsedProductListQuery {
  const raw: Record<string, string> = {};
  for (const [key, value] of searchParameters.entries()) {
    if (searchParameters.getAll(key).length !== 1) {
      return {
        success: false,
        message: `The “${key}” filter can appear only once.`,
      };
    }
    raw[key] = value;
  }
  const parsed = adminProductListQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ??
        "The Product list URL contains invalid filters.",
    };
  }
  return { success: true, query: parsed.data };
}
