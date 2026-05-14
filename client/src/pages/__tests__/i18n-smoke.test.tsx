/**
 * i18n Smoke Tests (I18-CT-01 to I18-CT-04)
 *
 * Verify that page components render without throwing when:
 *  - useTranslation() is mocked to return translation keys as-is
 *  - tRPC queries are mocked to return empty/null data
 *  - wouter hooks are mocked
 *  - useAuth is mocked
 *
 * These tests catch broken i18n key references or import errors that would
 * surface immediately on page load.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Dashboard from "../Dashboard";
import Documents from "../Documents";
import Templates from "../Templates";
import Contacts from "../Contacts";
import InboxPage from "../InboxPage";
import InboxDetailPage from "../InboxDetailPage";

describe("i18n Smoke Tests - pages render without crashing", () => {
  it("I18-CT-01: Dashboard renders without throwing", () => {
    expect(() => render(<Dashboard />)).not.toThrow();
  });

  it("I18-CT-02: Documents renders without throwing", () => {
    expect(() => render(<Documents />)).not.toThrow();
  });

  it("I18-CT-03: Templates renders without throwing", () => {
    expect(() => render(<Templates />)).not.toThrow();
  });

  it("I18-CT-04: Contacts renders without throwing", () => {
    expect(() => render(<Contacts />)).not.toThrow();
  });

  it("I18-CT-05: Inbox list renders without throwing", () => {
    expect(() => render(<InboxPage />)).not.toThrow();
  });

  it("I18-CT-06: Inbox detail renders without throwing", () => {
    expect(() => render(<InboxDetailPage />)).not.toThrow();
  });
});
