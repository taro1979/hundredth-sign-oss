import { afterEach, describe, expect, it, vi } from "vitest";
import { attachAnalyticsScript } from "./analytics";

describe("attachAnalyticsScript", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllEnvs();
  });

  it("does not inject script when analytics env vars are unset", () => {
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", "");
    vi.stubEnv("VITE_ANALYTICS_WEBSITE_ID", "");

    attachAnalyticsScript();

    expect(
      document.querySelector("#hundredth-sign-analytics-script")
    ).toBeNull();
  });

  it("injects analytics script once when env vars are set", () => {
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", "https://analytics.example.com");
    vi.stubEnv("VITE_ANALYTICS_WEBSITE_ID", "site-123");

    attachAnalyticsScript();
    attachAnalyticsScript();

    const scripts = document.querySelectorAll(
      "#hundredth-sign-analytics-script"
    );
    expect(scripts).toHaveLength(1);
    const script = scripts[0] as HTMLScriptElement;
    expect(script.src).toBe("https://analytics.example.com/umami");
    expect(script.getAttribute("data-website-id")).toBe("site-123");
    expect(script.defer).toBe(true);
  });

  it("does not inject script when endpoint is invalid", () => {
    vi.stubEnv("VITE_ANALYTICS_ENDPOINT", "%%%");
    vi.stubEnv("VITE_ANALYTICS_WEBSITE_ID", "site-123");

    attachAnalyticsScript();

    expect(
      document.querySelector("#hundredth-sign-analytics-script")
    ).toBeNull();
  });
});
