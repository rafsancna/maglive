import type { NavigationAdminDto } from "@maglive/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateNavigation } from "@/admin/navigation/api";
import { requestAdminMutation } from "@/admin/auth/api";

vi.mock("@/admin/auth/api", () => ({
  requestAdminData: vi.fn(),
  requestAdminMutation: vi.fn(),
}));

const navigation: NavigationAdminDto = {
  primaryItems: [],
  productCategories: [],
  featuredProducts: [],
  solutionCategories: [],
  featuredSolution: {
    id: "solution-fallback",
    label: { en: "Energy solutions" },
    href: "/projects",
    visible: true,
    order: 0,
  },
  cases: [],
  news: [],
  documents: [],
  services: [],
  version: 4,
  updatedAt: "2026-08-30T10:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requestAdminMutation).mockResolvedValue(navigation);
});

describe("navigation API", () => {
  it("does not send the read-only updatedAt field in an update request", async () => {
    await updateNavigation(navigation);

    expect(requestAdminMutation).toHaveBeenCalledWith(
      "/admin/navigation",
      expect.anything(),
      "PUT",
      expect.not.objectContaining({ updatedAt: expect.anything() }),
    );
    expect(vi.mocked(requestAdminMutation).mock.calls[0]?.[3]).toMatchObject({
      version: 4,
      documents: [],
    });
  });
});
