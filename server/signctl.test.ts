import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const signctl = path.join(root, "scripts", "signctl.mjs");

async function runSignctl(args: string[]) {
  return execFileAsync(process.execPath, [signctl, ...args], {
    cwd: root,
    env: {
      ...process.env,
      SIGN_BASE_URL: "https://example.invalid",
      SIGN_API_KEY: "hsign_sk_test",
      SIGN_OUTPUT: "json",
    },
  });
}

async function runSignctlFailure(args: string[]) {
  try {
    await runSignctl(args);
    throw new Error("Expected signctl to fail");
  } catch (error) {
    return error as Error & {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
  }
}

function parseJson(stdout = "") {
  return JSON.parse(stdout);
}

describe("signctl CLI smoke tests", () => {
  it("prints machine-readable help", async () => {
    const { stdout } = await runSignctl(["--help", "--json"]);
    const result = parseJson(stdout);

    expect(result.ok).toBe(true);
    expect(result.usage).toContain(
      "signctl documents create --title <title> [--external-system crm --external-entity-type deal --external-entity-id 123] --json"
    );
    expect(result.usage).toContain(
      "signctl documents download-signed <document-id> --output ./signed.pdf --json"
    );
  });

  it("dry-runs document creation without calling the server", async () => {
    const { stdout } = await runSignctl([
      "documents",
      "create",
      "--title",
      "NDA",
      "--external-system",
      "crm",
      "--external-entity-type",
      "deal",
      "--external-entity-id",
      "123",
      "--dry-run",
      "--json",
    ]);
    const result = parseJson(stdout);

    expect(result).toEqual({
      ok: true,
      dryRun: true,
      request: {
        title: "NDA",
        external: {
          system: "crm",
          entityType: "deal",
          entityId: "123",
        },
      },
    });
  });

  it("dry-runs PDF upload and reports file metadata", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "signctl-"));
    const file = path.join(dir, "contract.pdf");
    await writeFile(file, "%PDF-1.7\n");

    try {
      const { stdout } = await runSignctl([
        "documents",
        "upload-pdf",
        "42",
        "--file",
        file,
        "--dry-run",
        "--json",
      ]);
      const result = parseJson(stdout);

      expect(result).toEqual({
        ok: true,
        dryRun: true,
        documentId: "42",
        fileName: "contract.pdf",
        bytes: 9,
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("dry-runs signer and CC send payloads with delivery options", async () => {
    const { stdout } = await runSignctl([
      "documents",
      "send",
      "42",
      "--signer",
      "Taro Yamada <taro@example.com>",
      "--cc",
      "Contract Archive <archive@example.com>",
      "--locale",
      "ja",
      "--locale",
      "en",
      "--order",
      "1",
      "--order",
      "2",
      "--access-code",
      "123456",
      "--message",
      "Please sign",
      "--expiration-days",
      "30",
      "--reminder-days",
      "3",
      "--sequential-routing",
      "--dry-run",
      "--json",
    ]);
    const result = parseJson(stdout);

    expect(result).toEqual({
      ok: true,
      dryRun: true,
      documentId: "42",
      request: {
        signers: [
          {
            name: "Taro Yamada",
            email: "taro@example.com",
            role: "signer",
            order: 1,
            locale: "ja",
            accessCode: "123456",
            message: "Please sign",
          },
          {
            name: "Contract Archive",
            email: "archive@example.com",
            role: "cc",
            order: 2,
            locale: "en",
            accessCode: "123456",
            message: "Please sign",
          },
        ],
        sequentialRouting: true,
        expirationDays: 30,
        reminderDays: 3,
      },
    });
  });

  it("requires at least one signer for send", async () => {
    const error = await runSignctlFailure([
      "documents",
      "send",
      "42",
      "--cc",
      "Archive <archive@example.com>",
      "--json",
    ]);
    const result = parseJson(error.stdout);

    expect(error.code).toBe(1);
    expect(result).toEqual({
      ok: false,
      code: "SIGNER_REQUIRED",
      message: "documents send requires at least one --signer",
    });
  });

  it("requires explicit confirmation for destructive commands", async () => {
    const error = await runSignctlFailure([
      "documents",
      "void",
      "42",
      "--json",
    ]);
    const result = parseJson(error.stdout);

    expect(error.code).toBe(1);
    expect(result).toEqual({
      ok: false,
      code: "CONFIRM_REQUIRED",
      message: "documents void requires --confirm",
    });
  });
});
