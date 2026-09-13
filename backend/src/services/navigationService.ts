import {
  DEFAULT_NAVIGATION_PRIMARY_ITEMS,
  navigationDataSchema,
  type NavigationAdminDto,
  type NavigationData,
  type UpdateNavigationRequest,
  type SafeAdminDto,
} from "@maglive/contracts";
import { AppError } from "../errors/AppError.js";
import { NavigationConfigModel } from "../models/NavigationConfig.js";
import { MediaModel } from "../models/Media.js";
import { NewsModel, type NewsDocument, type PublishedNewsLocale } from "../models/News.js";
import type { StorageProvider } from "../storage/StorageProvider.js";
import { Types } from "mongoose";

const text = (en: string, zh: string) => ({ en, zh });
const image = (src: string, en: string, zh: string) => ({
  src,
  alt: text(en, zh),
  width: 1_200,
  height: 800,
});

export const defaultNavigationData: NavigationData = navigationDataSchema.parse({
  primaryItems: DEFAULT_NAVIGATION_PRIMARY_ITEMS,
  productCategories: [
    { id: "solar-modules", accent: "01", label: text("Solar modules", "太阳能组件"), description: text("High-output modules engineered for long-term yield", "为长期发电量而设计的高功率组件"), href: "/products", products: [{ id: "astra-630", label: text("Astra 630", "Astra 630"), description: text("630 W n-type module for utility-scale efficiency.", "面向大型电站效率的630 W n型组件。"), href: "/products", tag: text("New generation", "新一代产品"), image: image("https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80", "Solar modules in a field", "光伏电站组件") }] },
    { id: "inverters", accent: "02", label: text("Inverters", "逆变器"), description: text("Grid-ready conversion for every project scale", "适配各种项目规模的并网转换方案"), href: "/products", products: [{ id: "gridcore-x", label: text("GridCore X", "GridCore X"), description: text("High-density conversion for demanding sites.", "适用于高要求场景的高密度转换。"), href: "/products", tag: text("Flagship", "旗舰系列"), image: image("https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1200&q=80", "Wind turbines and energy infrastructure", "风机与能源基础设施") }] },
    { id: "energy-storage", accent: "03", label: text("Energy storage", "储能系统"), description: text("Flexible storage for resilient energy networks", "为韧性能源网络提供灵活储能"), href: "/products", products: [{ id: "vault-2", label: text("Vault 2", "Vault 2"), description: text("Modular storage for dependable peak shifting.", "用于可靠削峰的模块化储能。"), href: "/products", tag: text("Storage", "储能系列"), image: image("https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1200&q=80", "Energy storage at sunset", "日落中的储能系统") }] },
    { id: "ev-charging", accent: "04", label: text("EV charging", "电动汽车充电"), description: text("Fast, intelligent charging infrastructure", "快速、智能的充电基础设施"), href: "/products", products: [{ id: "pulse-240", label: text("Pulse 240", "Pulse 240"), description: text("High-power charging for commercial fleets.", "面向商业车队的高功率充电。"), href: "/products", tag: text("Fast charge", "快速充电"), image: image("https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1200&q=80", "Solar panels on a modern building", "现代建筑屋顶光伏板") }] },
  ],
  featuredProducts: [
    { id: "astra-630", label: text("Astra 630", "Astra 630"), description: text("630 W n-type module for utility-scale efficiency.", "面向大型电站效率的630 W n型组件。"), href: "/products", tag: text("New generation", "新一代产品"), image: image("https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80", "Solar modules in a field", "光伏电站组件") },
    { id: "gridcore-x", label: text("GridCore X", "GridCore X"), description: text("High-density conversion for demanding sites.", "适用于高要求场景的高密度转换。"), href: "/products", tag: text("Flagship", "旗舰系列"), image: image("https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1200&q=80", "Wind turbines and energy infrastructure", "风机与能源基础设施") },
  ],
  solutionCategories: [
    { id: "residential", label: text("Residential", "住宅能源"), description: text("Energy independence for the places people call home.", "为家庭打造能源自主。"), href: "/projects", feature: { id: "residential-feature", label: text("Energy that feels at home", "让能源融入家庭"), description: text("A balanced home system that keeps comfort and control close.", "让舒适与掌控始终近在身边的家庭能源系统。"), href: "/projects", tag: text("System thinking", "系统化思维"), image: image("https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1400&q=80", "Solar home", "家庭太阳能") } },
    { id: "commercial-industrial", label: text("Commercial & industrial", "工商业能源"), description: text("Predictable power for productive operations.", "为高效运营提供可预测电力。"), href: "/projects", feature: { id: "commercial-feature", label: text("Power for productive places", "为高效场所提供电力"), description: text("Make every roof, meter and operating hour work harder.", "让每一块屋顶、每一块电表与每一小时运营创造更多价值。"), href: "/projects", tag: text("System thinking", "系统化思维"), image: image("https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1400&q=80", "Commercial solar", "工商业光伏") } },
    { id: "utility-scale", label: text("Utility scale", "大型电站"), description: text("Bankable systems built for the grid.", "为电网打造可融资的系统。"), href: "/projects", feature: { id: "utility-feature", label: text("Built for the grid", "为电网而建"), description: text("Bankable generation designed for predictable long-term yield.", "为可预测的长期发电收益而设计的可融资电源。"), href: "/projects", tag: text("System thinking", "系统化思维"), image: image("https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=1400&q=80", "Utility energy infrastructure", "大型能源基础设施") } },
    { id: "microgrids", label: text("Microgrids", "微电网"), description: text("Resilient control across distributed assets.", "协调分布式资产，提升系统韧性。"), href: "/projects", feature: { id: "microgrid-feature", label: text("Control in every condition", "在各种条件下保持掌控"), description: text("Coordinate distributed assets when the wider grid cannot.", "当大电网无法提供支持时，依然协调分布式资产。"), href: "/projects", tag: text("System thinking", "系统化思维"), image: image("https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1400&q=80", "Microgrid at sunset", "日落中的微电网") } },
  ],
  featuredSolution: { id: "smarter-energy-balance", label: text("A smarter energy balance", "更智能的能源平衡"), description: text("Connect generation, storage and demand into one dependable operating picture.", "将发电、储能与负荷连接为可靠统一的运营视图。"), href: "/projects", tag: text("System thinking", "系统化思维"), image: image("https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=1400&q=80", "Solar panels at sunset", "日落中的太阳能电池板") },
  cases: [],
  news: [],
  newsArticleIds: [],
  newsItemCount: 4,
  documents: [],
  services: [],
});

function adminDto(data: NavigationData, version: number, updatedAt?: Date): NavigationAdminDto {
  return {
    ...data,
    news: [],
    newsArticleIds: data.newsArticleIds ?? [],
    newsItemCount: data.newsItemCount ?? 4,
    version,
    ...(updatedAt === undefined ? {} : { updatedAt: updatedAt.toISOString() }),
  };
}

function localizedPublishedText(
  news: NewsDocument,
  select: (snapshot: PublishedNewsLocale) => string,
): Record<string, string> {
  return Object.fromEntries(
    [...news.publishedSnapshots.entries()].map(([locale, snapshot]) => [locale, select(snapshot)]),
  );
}

function displayCategory(category: string): string {
  return category
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function displayDate(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

async function resolveNavigationNews(
  data: NavigationData,
  storageProvider: StorageProvider,
  locale: string,
): Promise<NavigationData["news"]> {
  const selectedIds = [...new Set(data.newsArticleIds ?? [])];
  const itemCount = selectedIds.length > 0 ? selectedIds.length : (data.newsItemCount ?? 4);
  let articles: NewsDocument[] = [];

  if (selectedIds.length > 0) {
    const selected = await NewsModel.find({
      _id: { $in: selectedIds },
      status: "published",
      publishedGlobal: { $exists: true },
      [`publishedSnapshots.${locale}`]: { $exists: true },
    });
    const byId = new Map(selected.map((article) => [article._id.toString(), article]));
    articles = selectedIds.flatMap((id) => {
      const article = byId.get(id);
      return article === undefined ? [] : [article];
    });
  }

  if (articles.length < itemCount) {
    const excludedIds = articles.map((article) => article._id);
    const latest = await NewsModel.find({
      status: "published",
      publishedGlobal: { $exists: true },
      [`publishedSnapshots.${locale}`]: { $exists: true },
      ...(excludedIds.length === 0 ? {} : { _id: { $nin: excludedIds } }),
    })
      .sort({ "publishedGlobal.publishedAt": -1 })
      .limit(itemCount - articles.length);
    articles.push(...latest);
  }

  const mediaIds = articles.flatMap((article) => {
    const id = article.publishedGlobal?.heroMediaId;
    return id === undefined ? [] : [id];
  });
  const mediaById = new Map(
    (await MediaModel.find({ _id: { $in: mediaIds }, kind: "image", status: "ready" })).map((media) => [
      media._id.toString(),
      media,
    ]),
  );

  return articles.flatMap((article, order) => {
    const global = article.publishedGlobal;
    if (global === undefined || article.publishedSnapshots.size === 0) return [];
    const label = localizedPublishedText(article, (snapshot) => snapshot.data.title);
    const description = localizedPublishedText(article, (snapshot) => snapshot.data.excerpt);
    const category = Object.fromEntries(
      [...article.publishedSnapshots.keys()].map((locale) => [locale, displayCategory(global.category)]),
    );
    const publishedAt = article.firstPublishedAt ?? global.publishedAt;
    const date = Object.fromEntries(
      [...article.publishedSnapshots.keys()].map((locale) => [locale, displayDate(publishedAt, locale)]),
    );
    const media = global.heroMediaId === undefined
      ? undefined
      : mediaById.get(global.heroMediaId.toString());
    const image = media?.storage?.provider === storageProvider.id
      ? {
          src: storageProvider.getPublicUrl(media.storage.key),
          alt: label,
          width: media.width ?? 1_200,
          height: media.height ?? 800,
          mediaId: media._id.toString(),
        }
      : undefined;
    return [{
      id: article._id.toString(),
      label,
      description,
      href: `/news/${global.slug}`,
      visible: true,
      order,
      date,
      category,
      ...(image === undefined ? {} : { image }),
    }];
  });
}

function publicData(data: NavigationData): NavigationData {
  const visible = <T extends { visible?: boolean; order?: number }>(items: readonly T[]): T[] =>
    items.filter((item) => item.visible !== false).sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  return navigationDataSchema.parse({
    ...data,
    primaryItems: visible(data.primaryItems),
    productCategories: visible(data.productCategories).map((category) => ({ ...category, products: visible(category.products) })),
    featuredProducts: visible(data.featuredProducts),
    solutionCategories: visible(data.solutionCategories),
    cases: visible(data.cases),
    news: visible(data.news),
    documents: visible(data.documents),
    services: visible(data.services),
  });
}

function navigationMediaIds(data: NavigationData): string[] {
  const ids = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== "object" || value === null) return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "mediaId" && typeof child === "string") ids.add(child);
      else visit(child);
    }
  };
  visit(data);
  return [...ids];
}

async function assertNavigationMediaReady(data: NavigationData): Promise<void> {
  const ids = navigationMediaIds(data);
  if (ids.length === 0) return;
  const ready = await MediaModel.countDocuments({ _id: { $in: ids }, kind: "image", status: "ready" });
  if (ready !== ids.length) {
    throw new AppError(422, "MEDIA_NOT_READY", "Navigation images must reference ready image assets from the media library.");
  }
}

async function assertNewsSelection(data: NavigationData): Promise<void> {
  const ids = data.newsArticleIds ?? [];
  if (ids.length !== new Set(ids).size) {
    throw new AppError(422, "NEWS_SELECTION_DUPLICATE", "Each selected news article must be unique.");
  }
  if (ids.length !== 0 && ids.length !== (data.newsItemCount ?? 4)) {
    throw new AppError(422, "NEWS_SELECTION_COUNT", "Select exactly 3 or 4 news articles, or select none to use the latest news automatically.");
  }
  if (ids.length === 0) return;
  const published = await NewsModel.countDocuments({
    _id: { $in: ids },
    status: "published",
    publishedGlobal: { $exists: true },
  });
  if (published !== ids.length) {
    throw new AppError(422, "NEWS_SELECTION_UNAVAILABLE", "Every selected news article must still be published.");
  }
}

export async function getPublicNavigation(storageProvider: StorageProvider, locale: string): Promise<NavigationData> {
  const config = await NavigationConfigModel.findOne({ key: "primary" });
  const data = config === null ? defaultNavigationData : navigationDataSchema.parse(config.data);
  return publicData({ ...data, news: await resolveNavigationNews(data, storageProvider, locale) });
}

export async function getAdminNavigation(): Promise<NavigationAdminDto> {
  const config = await NavigationConfigModel.findOne({ key: "primary" });
  if (config === null) return adminDto(defaultNavigationData, 0);
  return adminDto(navigationDataSchema.parse(config.data), config.version, config.updatedAt);
}

export async function updateAdminNavigation(
  input: UpdateNavigationRequest,
  admin: SafeAdminDto,
): Promise<NavigationAdminDto> {
  const { version, ...dataInput } = input;
  const data = navigationDataSchema.parse(dataInput);
  await assertNavigationMediaReady(data);
  await assertNewsSelection(data);
  const current = await NavigationConfigModel.findOne({ key: "primary" });
  if (current === null) {
    if (version !== 0) throw new AppError(409, "VERSION_CONFLICT", "The navigation changed elsewhere. Refresh and retry.");
    const created = await NavigationConfigModel.create({ key: "primary", data, version: 1, updatedBy: new Types.ObjectId(admin.id) });
    return adminDto(data, created.version, created.updatedAt);
  }
  if (current.version !== version) {
    throw new AppError(409, "VERSION_CONFLICT", "The navigation changed elsewhere. Refresh and retry.");
  }
  const updated = await NavigationConfigModel.findOneAndUpdate(
    { key: "primary", version },
    { $set: { data, updatedBy: new Types.ObjectId(admin.id) }, $inc: { version: 1 } },
    { new: true, runValidators: true },
  );
  if (updated === null) {
    throw new AppError(409, "VERSION_CONFLICT", "The navigation changed elsewhere. Refresh and retry.");
  }
  return adminDto(data, updated.version, updated.updatedAt);
}
