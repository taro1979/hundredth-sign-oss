import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Templates from "./Templates";

afterEach(() => cleanup());

describe("Templates page", () => {
  it("does not show the category field in the new template dialog", async () => {
    const user = userEvent.setup();
    render(<Templates />);

    await user.click(screen.getByRole("button", { name: "templates.new" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("templates.signerCount")).toBeInTheDocument();
    expect(screen.queryByText("templates.category")).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("templates.categoryPlaceholder"),
    ).not.toBeInTheDocument();
  });
});
