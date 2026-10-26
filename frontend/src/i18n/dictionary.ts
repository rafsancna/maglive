export type NavigationCopy = Readonly<{
  home: string;
  about: string;
  products: string;
  projects: string;
  solutions: string;
  cases: string;
  news: string;
  downloads: string;
  documents: string;
  services: string;
  contact: string;
}>;

export type MenuCopy = Readonly<{
  featured: string;
  viewAll: string;
  explore: string;
  readMore: string;
  latest: string;
  allCases: string;
  allNews: string;
  viewDocuments: string;
  viewServices: string;
  openMenu: string;
  closeMenu: string;
}>;

/** A numbered editorial block: capability cards, process steps, document groups. */
export type PageHighlight = Readonly<{
  index: string;
  title: string;
  text: string;
}>;

export type PageCta = Readonly<{
  eyebrow: string;
  title: string;
  text: string;
  action: string;
}>;

export type PageCopy = Readonly<{
  eyebrow: string;
  title: string;
  intro: string;
  paragraphs: readonly string[];
  note?: string;
  highlights?: Readonly<{
    eyebrow: string;
    title: string;
    items: readonly PageHighlight[];
  }>;
  cta?: PageCta;
}>;

export type HomeSectionCopy = Readonly<{
  eyebrow: string;
  title: string;
  intro: string;
  action: string;
}>;

export type CatalogCopy = Readonly<{
  categories: string;
  allProducts: string;
  emptyTitle: string;
  emptyText: string;
  categoryEmptyTitle: string;
  categoryEmptyText: string;
  unavailableTitle: string;
  unavailableText: string;
  viewProduct: string;
  breadcrumbProducts: string;
  breadcrumbCategory: string;
  previous: string;
  next: string;
  pageInfo: string;
}>;

export type ProductCopy = Readonly<{
  overview: string;
  technology: string;
  features: string;
  advantages: string;
  applications: string;
  specifications: string;
  media: string;
  videos: string;
  downloads: string;
  related: string;
  model: string;
  series: string;
  category: string;
  premiumSeries: string;
  languages: string;
  enquiryEyebrow: string;
  enquiryTitle: string;
  enquiryText: string;
  enquiryAction: string;
}>;

export type Dictionary = Readonly<{
  brand: {
    name: string;
    descriptor: string;
  };
  accessibility: {
    skipToContent: string;
    primaryNavigation: string;
    languageSwitcher: string;
    breadcrumb: string;
  };
  navigation: NavigationCopy;
  menu: MenuCopy;
  states: {
    loading: string;
    notFoundTitle: string;
    notFoundText: string;
    errorTitle: string;
    errorText: string;
    retry: string;
  };
  home: {
    eyebrow: string;
    title: string;
    intro: string;
    primaryAction: string;
    secondaryAction: string;
    systems: HomeSectionCopy;
    solutions: HomeSectionCopy;
    featuredProduct: HomeSectionCopy;
    news: HomeSectionCopy;
    hero: {
      slides: readonly {
        id: string;
        eyebrow: string;
        title: string;
        description: string;
        primary: string;
        secondary: string;
      }[];
      controls: {
        previous: string;
        next: string;
        pause: string;
        play: string;
        slides: string;
      };
    };
    principlesEyebrow: string;
    principlesTitle: string;
    principles: readonly {
      number: string;
      title: string;
      text: string;
    }[];
    closing: PageCta;
  };
  pages: {
    about: PageCopy;
    products: PageCopy;
    projects: PageCopy;
    news: PageCopy;
    downloads: PageCopy;
    contact: PageCopy;
  };
  product: ProductCopy;
  catalog: CatalogCopy;
  footer: {
    statement: string;
    phaseStatus: string;
    rights: string;
    navigation: string;
  };
}>;
