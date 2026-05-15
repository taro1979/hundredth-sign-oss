// Storage helpers for self-hosted deployments
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)
// Falls back to local filesystem storage when credentials are not configured.

import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { ENV } from './_core/env';

type StorageConfig = { baseUrl: string; apiKey: string };

/** Local uploads directory for dev/test when forge credentials are absent */
const LOCAL_UPLOADS_DIR = join(process.cwd(), "tmp", "local-uploads");
const DEFAULT_LOCAL_PORT = "4817";

/**
 * Returns true when BOTH forge credentials are absent — use local filesystem fallback.
 * If only one credential is set, it's a partial misconfiguration: getStorageConfig() will throw.
 */
function isLocalMode(): boolean {
  return !ENV.forgeApiUrl && !ENV.forgeApiKey;
}

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

/** Local-storage put: writes file to tmp/local-uploads and returns a localhost URL */
function localStoragePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
): { key: string; url: string } {
  const key = normalizeKey(relKey);
  const filePath = join(LOCAL_UPLOADS_DIR, key);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, typeof data === "string" ? Buffer.from(data) : data);
  const port = process.env.PORT ?? DEFAULT_LOCAL_PORT;
  const url = `http://localhost:${port}/local-uploads/${key}`;
  return { key, url };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  if (isLocalMode()) {
    return localStoragePut(relKey, data);
  }
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  if (isLocalMode()) {
    const key = normalizeKey(relKey);
    const port = process.env.PORT ?? DEFAULT_LOCAL_PORT;
    return { key, url: `http://localhost:${port}/local-uploads/${key}` };
  }
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}

/**
 * Fetch the raw binary content of a stored file.
 * Used by the PDF proxy endpoint to download encrypted data for decryption.
 */
export async function storageFetch(relKey: string): Promise<Buffer> {
  if (isLocalMode()) {
    const key = normalizeKey(relKey);
    const filePath = join(LOCAL_UPLOADS_DIR, key);
    return readFileSync(filePath);
  }
  const { url } = await storageGet(relKey);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Storage fetch failed (${response.status}): ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
