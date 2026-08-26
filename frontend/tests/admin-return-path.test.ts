import { describe, expect, it } from "vitest";
import {
  buildAdminLoginPath,
  getSafeAdminReturnPath
} from "@/admin/auth/return-path";

describe("administrator return paths", () => {
  it("accepts only local administration destinations", () => {
    expect(getSafeAdminReturnPath("/admin/categories?view=tree")).toBe(
      "/admin/categories?view=tree"
    );
    expect(getSafeAdminReturnPath("/admin/login")).toBe("/admin");
    expect(getSafeAdminReturnPath("//foreign.example/admin")).toBe("/admin");
    expect(getSafeAdminReturnPath("https://foreign.example/admin")).toBe("/admin");
    expect(getSafeAdminReturnPath("/admin\\@foreign.example")).toBe("/admin");
    expect(getSafeAdminReturnPath("/products")).toBe("/admin");
  });

  it("encodes a validated destination in the login URL", () => {
    expect(buildAdminLoginPath("/admin/media?kind=image")).toBe(
      "/admin/login?returnTo=%2Fadmin%2Fmedia%3Fkind%3Dimage"
    );
  });
});
