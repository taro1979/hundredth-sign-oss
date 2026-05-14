const ANALYTICS_SCRIPT_ID = "hundredth-sign-analytics-script";

const buildAnalyticsSrc = (endpoint: string) => {
  const url = new URL("/umami", endpoint);
  return url.toString();
};

export const attachAnalyticsScript = () => {
  if (typeof document === "undefined") return;

  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT?.trim();
  const websiteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID?.trim();
  if (!endpoint || !websiteId) return;

  if (document.getElementById(ANALYTICS_SCRIPT_ID)) return;

  let src: string;
  try {
    src = buildAnalyticsSrc(endpoint);
  } catch {
    return;
  }

  const script = document.createElement("script");
  script.id = ANALYTICS_SCRIPT_ID;
  script.defer = true;
  script.src = src;
  script.setAttribute("data-website-id", websiteId);
  document.body.appendChild(script);
};
