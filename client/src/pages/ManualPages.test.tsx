import React from "react";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ManualPage, { ManualChapterPage } from "./ManualPage";
import ManualTermsPage from "./ManualTermsPage";
import ManualDisclaimerPage from "./ManualDisclaimerPage";
import OssCustomizationContactPage from "./OssCustomizationContactPage";

afterEach(() => cleanup());

describe("OSS manual and contact pages", () => {
  it("renders the manual page and links to customization contact", () => {
    render(<ManualPage />);

    expect(
      screen.getByRole("heading", { name: "manual.usage.title" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /manual\.usage\.chapters\.developer\.title/,
      })
    ).toHaveAttribute("href", "/manual/developer");
    expect(
      screen.getByRole("link", {
        name: /manual\.usage\.chapters\.api\.title/,
      })
    ).toHaveAttribute("href", "/manual/api");
    expect(
      screen.getByRole("link", {
        name: /manual\.usage\.chapters\.cli\.title/,
      })
    ).toHaveAttribute("href", "/manual/cli");
    expect(
      screen.getByRole("link", {
        name: /manual\.usage\.chapters\.dataModel\.title/,
      })
    ).toHaveAttribute("href", "/manual/data-model");
    expect(
      screen.getByRole("link", { name: "manual.nav.terms" })
    ).toHaveAttribute("href", "/manual/terms");
    expect(
      screen.getByRole("link", { name: "manual.nav.disclaimer" })
    ).toHaveAttribute("href", "/manual/disclaimer");
    expect(
      screen.getByRole("link", { name: "manual.usage.contactCta.action" })
    ).toHaveAttribute("href", "/contact");
  });

  it("searches manual chapters and links to matching content", async () => {
    const user = userEvent.setup();
    render(<ManualPage />);

    await user.type(
      screen.getByLabelText("manual.usage.search.label"),
      "manual.usage.chapters.cli.title"
    );

    expect(
      screen.getByRole("link", {
        name: /manual\.usage\.chapters\.cli\.title/,
      })
    ).toHaveAttribute("href", "/manual/cli");
  });

  it("renders a separate manual chapter page with expandable screenshots", async () => {
    const user = userEvent.setup();
    render(<ManualChapterPage chapterId="dashboard" />);

    expect(
      screen.getByRole("heading", {
        name: "manual.usage.chapters.dashboard.title",
        level: 1,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "manual.usage.screenshots.dashboard.alt",
      })
    ).toHaveAttribute("src", "/manual/screenshots/dashboard.png");
    expect(
      screen.queryByRole("link", {
        name: "manual.usage.screenshots.openFullSize",
      })
    ).not.toBeInTheDocument();

    await user.click(
      screen.getAllByRole("button", {
        name: /manual\.usage\.screenshots\.openFullSize/,
      })[0]
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "manual.usage.screenshots.dashboard.caption",
      })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps manual locale key sets aligned across UI locales", () => {
    const localeRoot = path.resolve(process.cwd(), "client/public/locales");
    const locales = ["ja", "en", "th", "zh-CN"];
    const flatten = (value: unknown, prefix = ""): string[] => {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return [prefix];
      }
      return Object.entries(value).flatMap(([key, child]) =>
        flatten(child, prefix ? `${prefix}.${key}` : key)
      );
    };
    const keySets = locales.map((locale) => {
      const json = JSON.parse(
        fs.readFileSync(
          path.join(localeRoot, locale, "common.json"),
          "utf8"
        )
      );
      return flatten(json.manual).sort();
    });

    expect(keySets[1]).toEqual(keySets[0]);
    expect(keySets[2]).toEqual(keySets[0]);
    expect(keySets[3]).toEqual(keySets[0]);
  });

  it("renders the source-available terms page", () => {
    render(<ManualTermsPage />);

    expect(
      screen.getByRole("heading", { name: "manual.terms.title" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "manual.terms.sections.noSupport.title",
      })
    ).toBeInTheDocument();
  });

  it("renders the OSS disclaimer page", () => {
    render(<ManualDisclaimerPage />);

    expect(
      screen.getByRole("heading", { name: "manual.disclaimer.title" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "manual.disclaimer.sections.ai.title",
      })
    ).toBeInTheDocument();
  });

  it("renders the customization contact email link", () => {
    render(<OssCustomizationContactPage />);

    expect(
      screen.getByRole("heading", { name: "ossContact.title" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /infibilitis\.th@gmail\.com/ })
    ).toHaveAttribute("href", "mailto:infibilitis.th@gmail.com");
  });
});
