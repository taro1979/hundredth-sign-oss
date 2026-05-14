/**
 * Parse activity log details.
 *
 * Current format: JSON with { key: "activity.xxx", ...params }.
 * Legacy format: raw string or older JSON payloads without a translation key.
 */
type Translate = (key: string, options?: Record<string, unknown>) => string;

type ActivityDetailsPayload = {
  key?: unknown;
  title?: unknown;
  signer?: unknown;
  approver?: unknown;
  name?: unknown;
  reason?: unknown;
  delegateName?: unknown;
  delegateEmail?: unknown;
};

function getActivityActionFallback(action: string | null | undefined, t: Translate): string {
  if (!action) return t("activity.event");

  const normalized = action.toLowerCase();
  if (normalized.includes("created")) return t("activity.fallbackCreated");
  if (normalized.includes("signed")) return t("activity.fallbackSigned");
  if (normalized.includes("declined")) return t("activity.fallbackDeclined");
  if (normalized.includes("sent") || normalized.includes("requested")) {
    return t("activity.fallbackSent");
  }
  if (normalized.includes("reminder")) return t("activity.fallbackReminder");
  if (normalized.includes("completed")) return t("activity.fallbackCompleted");
  if (normalized.includes("voided") || normalized.includes("expired")) {
    return t("activity.fallbackVoided");
  }

  return t("activity.eventWithAction", { action });
}

function getJsonDetailsFallback(parsed: ActivityDetailsPayload): string {
  const values = [
    parsed.title,
    parsed.signer,
    parsed.approver,
    parsed.name,
    parsed.reason,
    parsed.delegateName,
    parsed.delegateEmail,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  return values.join(" / ");
}

export function parseActivityDetails(
  details: string | null | undefined,
  t: Translate,
  action?: string | null,
): string {
  const fallback = getActivityActionFallback(action, t);
  if (!details) return fallback;

  try {
    const parsed = JSON.parse(details) as ActivityDetailsPayload;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      if (typeof parsed.key !== "string") {
        return getJsonDetailsFallback(parsed) || fallback;
      }

      const { key, ...params } = parsed;
      const translated = t(key, params);
      return translated === key ? getJsonDetailsFallback(parsed) || fallback : translated;
    }
  } catch {
    // Not JSON; keep legacy details readable.
  }

  return details;
}
