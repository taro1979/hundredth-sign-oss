import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Footer from "./Footer";

describe("Footer OSS resource links", () => {
  it("renders manual and customization contact links without a support portal link", () => {
    render(<Footer />);

    expect(
      screen.queryByRole("link", { name: "nav.support" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "footer.manual" })).toHaveAttribute(
      "href",
      "/manual"
    );
    expect(
      screen.getByRole("link", { name: "footer.customizationContact" })
    ).toHaveAttribute("href", "/contact");
  });
});
