import { describe, expect, it } from "vitest";
import { getLoginUrl } from "./const";

describe("getLoginUrl", () => {
  it("returns the local password login route", () => {
    expect(getLoginUrl()).toBe("/login?returnPath=%2Fdashboard");
    expect(getLoginUrl("/dashboard/settings")).toBe(
      "/login?returnPath=%2Fdashboard%2Fsettings"
    );
  });
});
