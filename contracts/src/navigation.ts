import { z } from "zod";
import { objectIdStringSchema } from "./api.js";
import { localeCodeSchema } from "./locale.js";

const navigationTextSchema = z
  .record(localeCodeSchema, z.string().trim().min(1).max(500))
  .refine((value) => Object.keys(value).length > 0, "At least one translation is required.");

export const navigationMenuKeySchema = z.enum([
  "products",
  "solutions",
  "cases",
  "news",
  "documents",
  "services",
]);

export const navigationPrimaryItemSchema = z.object({
  id: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
  label: navigationTextSchema,
  href: z.string().trim().startsWith("/").max(320),
  menu: navigationMenuKeySchema.optional(),
  visible: z.boolean().default(true),
  order: z.number().int().min(0).max(10_000).default(0),
}).strict();

export const DEFAULT_NAVIGATION_PRIMARY_ITEMS = [
  { id: "products", label: { en: "Products", zh: "产品" }, href: "/products", menu: "products", visible: true, order: 0 },
  { id: "solutions", label: { en: "Solutions", zh: "解决方案" }, href: "/projects", menu: "solutions", visible: true, order: 1 },
  { id: "cases", label: { en: "Cases", zh: "案例" }, href: "/projects", menu: "cases", visible: true, order: 2 },
  { id: "news", label: { en: "News", zh: "新闻" }, href: "/news", menu: "news", visible: true, order: 3 },
  { id: "documents", label: { en: "Documents", zh: "文档" }, href: "/downloads", menu: "documents", visible: true, order: 4 },
  { id: "services", label: { en: "Services", zh: "服务" }, href: "/contact", menu: "services", visible: true, order: 5 },
  { id: "about", label: { en: "About", zh: "关于我们" }, href: "/about", visible: true, order: 6 },
  { id: "contact", label: { en: "Contact", zh: "联系我们" }, href: "/contact", visible: true, order: 7 },
] as const;

export const navigationImageSchema = z.object({
  src: z.string().trim().min(1).max(2_048),
  alt: navigationTextSchema,
  width: z.number().int().positive().max(4_000).optional(),
  height: z.number().int().positive().max(4_000).optional(),
  mediaId: objectIdStringSchema.optional(),
}).strict();

export const navigationLinkSchema = z.object({
  id: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
  label: navigationTextSchema,
  description: navigationTextSchema.optional(),
  href: z.string().trim().startsWith("/").max(320),
  meta: navigationTextSchema.optional(),
  visible: z.boolean().default(true),
  order: z.number().int().min(0).max(10_000).default(0),
}).strict();

export const navigationProductSchema = navigationLinkSchema.extend({
  tag: navigationTextSchema.optional(),
  image: navigationImageSchema.optional(),
}).strict();

export const navigationProductCategorySchema = navigationLinkSchema.extend({
  accent: z.string().trim().min(1).max(8),
  products: z.array(navigationProductSchema).max(12).default([]),
}).strict();

export const navigationSolutionCategorySchema = navigationLinkSchema.extend({
  feature: navigationProductSchema.optional(),
}).strict();

export const navigationCaseSchema = navigationProductSchema.extend({
  location: navigationTextSchema,
  capacity: navigationTextSchema,
}).strict();

export const navigationNewsSchema = navigationProductSchema.extend({
  date: navigationTextSchema,
  category: navigationTextSchema,
}).strict();

export const navigationDataSchema = z.object({
  primaryItems: z.array(navigationPrimaryItemSchema).max(24).default(() =>
    DEFAULT_NAVIGATION_PRIMARY_ITEMS.map((item) => ({
      ...item,
      label: { ...item.label },
    })),
  ),
  productCategories: z.array(navigationProductCategorySchema).max(24),
  featuredProducts: z.array(navigationProductSchema).max(24),
  solutionCategories: z.array(navigationSolutionCategorySchema).max(24),
  featuredSolution: navigationProductSchema,
  cases: z.array(navigationCaseSchema).max(24),
  news: z.array(navigationNewsSchema).max(24),
  documents: z.array(navigationLinkSchema).max(24),
  services: z.array(navigationLinkSchema).max(24),
}).strict();

export const navigationAdminDtoSchema = navigationDataSchema.extend({
  version: z.number().int().min(0),
  updatedAt: z.iso.datetime().optional(),
}).strict();

export const updateNavigationRequestSchema = navigationDataSchema.extend({
  version: z.number().int().min(0),
}).strict();

export type NavigationImage = z.infer<typeof navigationImageSchema>;
export type NavigationMenuKey = z.infer<typeof navigationMenuKeySchema>;
export type NavigationPrimaryItem = z.infer<typeof navigationPrimaryItemSchema>;
export type NavigationLink = z.infer<typeof navigationLinkSchema>;
export type NavigationProduct = z.infer<typeof navigationProductSchema>;
export type NavigationProductCategory = z.infer<typeof navigationProductCategorySchema>;
export type NavigationSolutionCategory = z.infer<typeof navigationSolutionCategorySchema>;
export type NavigationCase = z.infer<typeof navigationCaseSchema>;
export type NavigationNews = z.infer<typeof navigationNewsSchema>;
export type NavigationData = z.infer<typeof navigationDataSchema>;
export type NavigationAdminDto = z.infer<typeof navigationAdminDtoSchema>;
export type UpdateNavigationRequest = z.infer<typeof updateNavigationRequestSchema>;
