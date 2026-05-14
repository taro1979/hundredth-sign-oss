import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Header from "./Header";

let mockLocation = "/";

vi.mock("wouter", () => ({
  useLocation: () => [mockLocation, vi.fn()],
}));

afterEach(() => {
  cleanup();
  mockLocation = "/";
});

describe("Header home navigation", () => {
  it("shows homepage anchor links on the landing page", () => {
    mockLocation = "/";
    render(<Header />);

    expect(screen.getByRole("link", { name: "landing.navFeatures" })).toHaveAttribute(
      "href",
      "#features",
    );
    expect(screen.getByRole("link", { name: "landing.navFaq" })).toHaveAttribute(
      "href",
      "#faq",
    );
  });

  it("hides homepage anchor links on the manual page", () => {
    mockLocation = "/manual";
    render(<Header />);

    expect(
      screen.queryByRole("link", { name: "landing.navFeatures" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "landing.navFaq" }),
    ).not.toBeInTheDocument();
  });
});
