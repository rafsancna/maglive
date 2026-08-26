import { LOCALE_CODES, PRODUCT_LIMITS } from "@maglive/contracts";

const localeCodes = new Set<string>(LOCALE_CODES);

export const strictSubdocumentOptions = Object.freeze({
  _id: false,
  strict: "throw" as const,
});

export function hasOnlySupportedLocaleKeys(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  const keys =
    value instanceof Map
      ? [...value.keys()]
      : typeof value === "object"
        ? Object.keys(value)
        : [];
  return keys.every((key) => localeCodes.has(key));
}

export function isSupportedLocaleValue(value: unknown): boolean {
  return value === undefined || (typeof value === "string" && localeCodes.has(value));
}

export function hasUniqueNestedKeys(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const keys = value.map((item: unknown) =>
    typeof item === "object" && item !== null && "key" in item
      ? Reflect.get(item, "key")
      : undefined,
  );
  return (
    keys.every((key) => typeof key === "string") &&
    new Set(keys).size === keys.length
  );
}

export function arrayHasAtMost(maximum: number) {
  return (value: unknown): boolean =>
    Array.isArray(value) && value.length <= maximum;
}

export const supportedLocaleValidator = Object.freeze({
  validator: hasOnlySupportedLocaleKeys,
  message: "Localized map keys must use a supported locale.",
});

export const supportedLocaleValueValidator = Object.freeze({
  validator: isSupportedLocaleValue,
  message: "The locale must be supported.",
});

export const uniqueNestedKeyValidator = Object.freeze({
  validator: hasUniqueNestedKeys,
  message: "Nested keys must be unique within their list.",
});

export function boundedArrayValidator(maximum: number) {
  return {
    validator: arrayHasAtMost(maximum),
    message: `The list cannot contain more than ${maximum} items.`,
  };
}

export const productArrayValidators = Object.freeze({
  content: [
    boundedArrayValidator(PRODUCT_LIMITS.contentItemsPerList),
    uniqueNestedKeyValidator,
  ],
  specificationGroups: [
    boundedArrayValidator(PRODUCT_LIMITS.specificationGroups),
    uniqueNestedKeyValidator,
  ],
  specificationItems: [
    boundedArrayValidator(PRODUCT_LIMITS.specificationItemsPerGroup),
    uniqueNestedKeyValidator,
  ],
  mediaUsages: [boundedArrayValidator(PRODUCT_LIMITS.mediaUsages)],
  seoKeywords: [boundedArrayValidator(PRODUCT_LIMITS.seoKeywords)],
});
