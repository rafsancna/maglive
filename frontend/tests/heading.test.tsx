import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Heading } from "@/components/ui/Heading";

describe("Heading", () => {
  it("renders Chinese copy with the requested semantic level", () => {
    render(
      <Heading as="h1" size="display">
        让电力基础设施清晰呈现。
      </Heading>
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "让电力基础设施清晰呈现。" })
    ).toHaveClass("heading--display");
  });
});
