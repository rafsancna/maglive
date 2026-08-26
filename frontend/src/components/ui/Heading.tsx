import type { HTMLAttributes } from "react";

type HeadingLevel = "h1" | "h2" | "h3";

type HeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  as?: HeadingLevel;
  size?: "display" | "section" | "card";
};

export function Heading({
  as: Tag = "h2",
  className = "",
  size = "section",
  ...props
}: HeadingProps) {
  return <Tag className={`heading heading--${size} ${className}`.trim()} {...props} />;
}
