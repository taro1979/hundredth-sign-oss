function requireEnv(name: string, minLength = 1): string {
  const value = process.env[name];
  if (!value || value.length < minLength) {
    // Allow empty in test environment for CI
    if (process.env.NODE_ENV === "test") return value ?? "";
    const hints: Record<string, string> = {
      JWT_SECRET: "Generate with: openssl rand -base64 48",
      DATABASE_URL: "Format: mysql://user:pass@host:port/dbname",
    };
    throw new Error(
      `[STARTUP] Environment variable ${name} is required (min ${minLength} chars). ` +
      `Current: ${value ? `${value.length} chars` : "not set"}. ` +
      `Fix: Set ${name} in your deployment environment variables.` +
      (hints[name] ? ` ${hints[name]}` : "")
    );
  }
  return value;
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.NODE_ENV === "test" ? (process.env.JWT_SECRET ?? "test-secret-key-minimum-32-chars!!") : requireEnv("JWT_SECRET", 22),
  databaseUrl: process.env.NODE_ENV === "test" ? (process.env.DATABASE_URL ?? "") : requireEnv("DATABASE_URL", 20),
  /** Canonical app URL for email links (e.g. "https://app.example.com"). No trailing slash. */
  appUrl: (() => {
    const url = (process.env.APP_URL || process.env.VITE_APP_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:5000")).replace(/\/+$/, "");
    if (!url && process.env.NODE_ENV !== "test") {
      console.warn("[STARTUP] APP_URL is not set. Email links will be broken. Set APP_URL in your environment variables.");
    }
    return url;
  })(),
  isProduction: process.env.NODE_ENV === "production",
  /**
   * Trusted proxy configuration for safe IP extraction.
   * Values:
   *   - "true" / "1"  — trust all proxies (e.g. behind a single LB)
   *   - "false" / "0" / "" — never trust x-forwarded-for
   *   - Comma-separated CIDRs / IPs — trust only these sources
   * Defaults to "true" in production (assumes a managed LB in front).
   */
  trustProxy: process.env.TRUST_PROXY ?? (process.env.NODE_ENV === "production" ? "true" : "false"),
  forgeApiUrl: process.env.STORAGE_PROXY_URL ?? process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.STORAGE_PROXY_API_KEY ?? process.env.BUILT_IN_FORGE_API_KEY ?? "",
  /** Passphrase for PKCS#12 certificate bundle. Empty = auto-generate random passphrase. */
  platformSigningPassphrase: process.env.PLATFORM_SIGNING_PASSPHRASE ?? "",
  /** 32-byte hex key for PII field encryption (AES-256-GCM). Empty = encryption disabled (plaintext). */
  piiEncryptionKey: (() => {
    const key = process.env.PII_ENCRYPTION_KEY ?? "";
    if (key && key.length !== 64 && process.env.NODE_ENV !== "test") {
      // Warn instead of throw so a bad optional key does not prevent startup.
      // piiEncryption.ts will ignore the invalid key and skip encryption.
      console.warn(
        "[STARTUP] PII_ENCRYPTION_KEY must be exactly 64 hex chars (32 bytes). " +
        `Current: ${key.length} chars. Ignoring invalid value. ` +
        "Generate with: openssl rand -hex 32"
      );
      return "";
    }
    return key;
  })(),
  /** Enable TLS for DB connections. Default: false for local/self-hosted compatibility. */
  dbSsl: process.env.DB_SSL === "true",
  /** AES-256-GCM encryption key for PDF at-rest encryption. 64 hex chars (32 bytes). Empty = disabled. */
  storageEncryptionKey: (() => {
    const key = process.env.STORAGE_ENCRYPTION_KEY ?? "";
    if (key && key.length !== 64 && process.env.NODE_ENV !== "test") {
      throw new Error(
        "[STARTUP] STORAGE_ENCRYPTION_KEY must be exactly 64 hex chars (32 bytes). " +
        `Current: ${key.length} chars. Generate with: openssl rand -hex 32`
      );
    }
    if (!key && process.env.NODE_ENV === "production") {
      console.warn(
        "[STARTUP] STORAGE_ENCRYPTION_KEY is not set. PDFs will be stored unencrypted. " +
        "For production security, set STORAGE_ENCRYPTION_KEY=<64 hex chars>. " +
        "Generate with: openssl rand -hex 32"
      );
    }
    return key;
  })(),
  /** Previous PII encryption key for key rotation. Must be 64 hex chars if set. */
  piiEncryptionKeyPrev: (() => {
    const key = process.env.PII_ENCRYPTION_KEY_PREV ?? "";
    if (key && key.length !== 64 && process.env.NODE_ENV !== "test") {
      throw new Error(
        "[STARTUP] PII_ENCRYPTION_KEY_PREV must be exactly 64 hex chars (32 bytes). " +
        `Current: ${key.length} chars.`
      );
    }
    return key;
  })(),
  /** Previous storage encryption key for key rotation. Must be 64 hex chars if set. */
  storageEncryptionKeyPrev: (() => {
    const key = process.env.STORAGE_ENCRYPTION_KEY_PREV ?? "";
    if (key && key.length !== 64 && process.env.NODE_ENV !== "test") {
      throw new Error(
        "[STARTUP] STORAGE_ENCRYPTION_KEY_PREV must be exactly 64 hex chars (32 bytes). " +
        `Current: ${key.length} chars.`
      );
    }
    return key;
  })(),
  /** Redis connection URL for distributed rate limiting. Empty = in-memory fallback. */
  redisUrl: process.env.REDIS_URL ?? "",
  /** Maintenance mode. Set MAINTENANCE_MODE=true to return 503 for all requests. */
  maintenanceMode: process.env.MAINTENANCE_MODE === "true",
  /** Secret for X-Maintenance-Bypass header to skip maintenance mode. Empty = bypass disabled. */
  maintenanceBypassSecret: process.env.MAINTENANCE_BYPASS_SECRET ?? "",
  /** Comma-separated list of IPs that bypass maintenance mode. */
  maintenanceAllowedIps: process.env.MAINTENANCE_ALLOWED_IPS ?? "",
  /** Retry-After header value (seconds) when in maintenance mode. */
  maintenanceRetryAfter: process.env.MAINTENANCE_RETRY_AFTER ?? "3600",
};
