import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { NewsTagInput } from "@/admin/news/NewsTagInput";

function TagHarness() {
  const [tags, setTags] = useState<string[]>([]);
  return <NewsTagInput onChange={setTags} tags={tags} />;
}

describe("news tag input", () => {
  it("creates visible tag chips with comma or Enter", async () => {
    const user = userEvent.setup();
    render(<TagHarness />);
    const input = screen.getByRole("textbox", { name: "Add news tag" });

    await user.type(input, "Solar,");
    expect(screen.getByText("Solar")).toBeInTheDocument();
    expect(input).toHaveValue("");

    await user.type(input, "Project{Enter}");
    expect(screen.getByText("Project")).toBeInTheDocument();
    expect(screen.getByText("2/20")).toBeInTheDocument();
  });

  it("deduplicates tags and supports removal and Backspace", async () => {
    const user = userEvent.setup();
    render(<TagHarness />);
    const input = screen.getByRole("textbox", { name: "Add news tag" });

    await user.type(input, "Solar,{Enter}solar,{Enter}Project{Enter}");
    expect(screen.getAllByText("Solar")).toHaveLength(1);
    expect(screen.getByText("Project")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove tag Solar" }));
    expect(screen.queryByText("Solar")).not.toBeInTheDocument();

    await user.click(input);
    await user.keyboard("{Backspace}");
    expect(screen.queryByText("Project")).not.toBeInTheDocument();
    expect(screen.getByText("0/20")).toBeInTheDocument();
  });
});
