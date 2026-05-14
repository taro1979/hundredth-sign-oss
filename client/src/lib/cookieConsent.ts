export type ConsentState = {
  essential: true;
  analytics: boolean;
};

const CONSENT_KEY = "hundredth-sign-cookie-consent";
const CONSENT_COOKIE = "hs_cookie_consent";

export function getConsent(): ConsentState | null {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as ConsentState;
  } catch {
    return null;
  }
}

export function setConsent(analytics: boolean): void {
  const consent: ConsentState = { essential: true, analytics };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {
    // localStorage unavailable — fail silently
  }
  const maxAge = 365 * 24 * 3600;
  document.cookie = `${CONSENT_COOKIE}=${analytics ? "all" : "essential"};path=/;max-age=${maxAge};SameSite=Lax`;
}

export function hasConsented(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) !== null;
  } catch {
    return false;
  }
}
