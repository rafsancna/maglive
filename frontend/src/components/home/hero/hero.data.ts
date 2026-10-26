export type HeroSlideTone = "solar" | "grid" | "mobility" | "integrated";

export type HeroSlideMedia = Readonly<{
  id: string;
  tone: HeroSlideTone;
  image: string;
  primaryHref: string;
  secondaryHref: string;
  video?: string;
}>;

export type HeroSlideCopy = Readonly<{
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  primary: string;
  secondary: string;
}>;

export type HeroSlide = HeroSlideMedia & HeroSlideCopy;

/**
 * Art direction for the homepage hero. Copy lives in the locale dictionaries so
 * the imagery stays fixed while every language describes it in its own voice.
 */
export const heroMedia: readonly HeroSlideMedia[] = [
  {
    id: "solar",
    tone: "solar",
    image: "/nav/solar.jpg",
    primaryHref: "/products",
    secondaryHref: "/projects",
  },
  {
    id: "grid",
    tone: "grid",
    image: "/nav/sunset.jpg",
    primaryHref: "/projects",
    secondaryHref: "/about",
  },
  {
    id: "mobility",
    tone: "mobility",
    image: "/nav/rooftop.jpg",
    primaryHref: "/products",
    secondaryHref: "/contact",
  },
  {
    id: "integrated",
    tone: "integrated",
    image: "/nav/wind.jpg",
    primaryHref: "/products",
    secondaryHref: "/contact",
  },
];

export function composeHeroSlides(copy: readonly HeroSlideCopy[]): readonly HeroSlide[] {
  return heroMedia.flatMap((media) => {
    const text = copy.find((item) => item.id === media.id);
    return text === undefined ? [] : [{ ...media, ...text }];
  });
}
