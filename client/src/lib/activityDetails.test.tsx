import { describe, expect, it } from "vitest";
import { parseActivityDetails } from "./activityDetails";

const messages: Record<string, string> = {
  "activity.documentCreated": "Created {{title}}",
  "activity.event": "Activity recorded",
  "activity.eventWithAction": "Activity recorded: {{action}}",
  "activity.fallbackCreated": "Document was created",
  "activity.fallbackSent": "Document was sent",
  "activity.fallbackSigned": "Document was signed",
  "activity.fallbackDeclined": "Signature was declined",
  "activity.fallbackReminder": "Reminder was sent",
  "activity.fallbackCompleted": "Document was completed",
  "activity.fallbackVoided": "Document was voided or expired",
};

function t(key: string, options?: Record<string, unknown>): string {
  let value = messages[key] ?? key;
  for (const [name, replacement] of Object.entries(options ?? {})) {
    value = value.replaceAll(`{{${name}}}`, String(replacement));
  }
  return value;
}

describe("parseActivityDetails", () => {
  it("translates keyed activity details", () => {
    expect(
      parseActivityDetails(JSON.stringify({ key: "activity.documentCreated", title: "NDA" }), t, "created"),
    ).toBe("Created NDA");
  });

  it("does not render legacy JSON payloads directly", () => {
    expect(parseActivityDetails(JSON.stringify({ title: "NDA" }), t, "created")).toBe("NDA");
  });

  it("falls back to an action label when details are empty", () => {
    expect(parseActivityDetails(null, t, "sent")).toBe("Document was sent");
  });
});
