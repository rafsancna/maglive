export type HeroSlide = Readonly<{
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  primary: string;
  secondary: string;
  primaryHref: string;
  secondaryHref: string;
  image: string;
  video?: string;
  tone: "solar" | "grid" | "mobility" | "integrated";
}>;

export const heroSlides: readonly HeroSlide[] = [
  {
    id: "solar",
    eyebrow: "01 / SOLAR ENERGY",
    title: "The horizon\nis an energy asset.",
    description: "Utility-scale solar engineered for dependable output, from first light to last load.",
    primary: "Explore solar",
    secondary: "View capabilities",
    primaryHref: "/products",
    secondaryHref: "/projects",
    image: "/nav/solar.jpg",
    tone: "solar"
  },
  {
    id: "grid",
    eyebrow: "02 / SMART ENERGY",
    title: "Power that thinks\nin systems.",
    description: "Intelligent infrastructure that turns renewable generation into a more resilient everyday grid.",
    primary: "Explore smart energy",
    secondary: "Our approach",
    primaryHref: "/projects",
    secondaryHref: "/about",
    image: "/nav/sunset.jpg",
    tone: "grid"
  },
  {
    id: "mobility",
    eyebrow: "03 / E-MOBILITY",
    title: "Charge the\nnext horizon.",
    description: "A connected charging experience for the places people live, work, and move through.",
    primary: "Explore mobility",
    secondary: "Talk to our team",
    primaryHref: "/projects",
    secondaryHref: "/contact",
    image: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=2400&q=85",
    tone: "mobility"
  },
  {
    id: "integrated",
    eyebrow: "04 / INTEGRATED ENERGY",
    title: "One network.\nMany futures.",
    description: "Solar, storage, grid intelligence, and mobility working as one clean-energy ecosystem.",
    primary: "See the ecosystem",
    secondary: "Contact Maglive",
    primaryHref: "/projects",
    secondaryHref: "/contact",
    image: "/nav/wind.jpg",
    tone: "integrated"
  }
];
