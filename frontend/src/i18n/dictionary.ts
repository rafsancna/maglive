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

export type PageCopy = Readonly<{
  eyebrow: string;
  title: string;
  intro: string;
  paragraphs: readonly string[];
  note?: string;
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
    principlesTitle: string;
    principles: readonly {
      number: string;
      title: string;
      text: string;
    }[];
    closingEyebrow: string;
    closingTitle: string;
    closingText: string;
    closingAction: string;
  };
  pages: {
    about: PageCopy;
    products: PageCopy;
    projects: PageCopy;
    news: PageCopy;
    downloads: PageCopy;
    contact: PageCopy;
  };
  footer: {
    statement: string;
    phaseStatus: string;
    rights: string;
  };
}>;
