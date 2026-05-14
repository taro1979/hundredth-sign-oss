import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const TARGET_DIRS = [
  path.resolve(ROOT, "client/src/pages"),
  path.resolve(ROOT, "client/src/components"),
];

const EXCLUDED_PATH_PARTS = [
  `${path.sep}components${path.sep}ui${path.sep}`,
  `${path.sep}pages${path.sep}ComponentShowcase.tsx`,
  `${path.sep}pages${path.sep}ForgotPassword.tsx`,
  `${path.sep}pages${path.sep}Login.tsx`,
  `${path.sep}pages${path.sep}OrganizationSettings.tsx`,
  `${path.sep}pages${path.sep}ResetPassword.tsx`,
  `${path.sep}pages${path.sep}Setup.tsx`,
  ".test.tsx",
  ".test.ts",
  ".spec.tsx",
  ".spec.ts",
];

const ALLOWED_LITERAL_PATTERNS = [
  /^Hundredth Sign$/i,
  /^PDF$/i,
  /^IP$/i,
  /^SHA-?256(?: Chain)?$/i,
  /^TLS 1\.3$/i,
  /^AES-?256$/i,
  /^WORM$/i,
  /^CC$/i,
  /^OSS$/i,
  /^Free$/i,
  /^Self-hosted(?: OSS)?$/i,
  /^Powered by Hundredth Sign OSS$/i,
  /^Free to self-host, no customer accounts, no vendor lock-in$/i,
  /^この文書の閲覧.*アカウント登録は不要です。$/,
  /^NDA$/i,
  /^X\.509$/i,
  /^or$/i,
  /^[0-9]+$/,
  /^[0-9]+\/[0-9]+$/,
  /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/i,
];

const VISIBLE_ATTRS = new Set(["placeholder", "title", "aria-label", "alt"]);

type Violation = {
  file: string;
  line: number;
  kind: "jsx-text" | "jsx-attr" | "toast-literal" | "label-literal";
  value: string;
};

function listTsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTsxFiles(full));
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
    if (EXCLUDED_PATH_PARTS.some((part) => full.includes(part))) continue;
    out.push(full);
  }
  return out;
}

function hasVisibleChars(text: string): boolean {
  return /[A-Za-z\u3040-\u30ff\u3400-\u9fff]/.test(text);
}

function isAllowedLiteral(raw: string): boolean {
  const value = raw.trim();
  if (!value) return true;
  if (!hasVisibleChars(value)) return true;
  return ALLOWED_LITERAL_PATTERNS.some((pattern) => pattern.test(value));
}

function unquote(text: string): string {
  return text.replace(/^['\"`]/, "").replace(/['\"`]$/, "");
}

function addViolation(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  kind: Violation["kind"],
  value: string,
  violations: Violation[],
) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  violations.push({
    file: sourceFile.fileName,
    line: line + 1,
    kind,
    value: value.trim().slice(0, 120),
  });
}

function collectViolations(file: string): Violation[] {
  const source = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations: Violation[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const value = node.getText(sourceFile).trim();
      if (value && hasVisibleChars(value) && !isAllowedLiteral(value)) {
        addViolation(sourceFile, node, "jsx-text", value, violations);
      }
    }

    if (ts.isJsxAttribute(node) && VISIBLE_ATTRS.has(node.name.text)) {
      const init = node.initializer;
      if (init && ts.isStringLiteral(init)) {
        const value = init.text.trim();
        if (value && hasVisibleChars(value) && !isAllowedLiteral(value)) {
          addViolation(sourceFile, init, "jsx-attr", value, violations);
        }
      }
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const objectName = node.expression.expression.getText(sourceFile);
      const method = node.expression.name.text;
      if (objectName === "toast" && ["success", "error", "info", "warning"].includes(method)) {
        const firstArg = node.arguments[0];
        if (firstArg && (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg))) {
          const value = unquote(firstArg.getText(sourceFile));
          if (value && hasVisibleChars(value) && !isAllowedLiteral(value)) {
            addViolation(sourceFile, firstArg, "toast-literal", value, violations);
          }
        }
      }
    }

    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === "label") {
      if (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer)) {
        const value = unquote(node.initializer.getText(sourceFile));
        if (value && hasVisibleChars(value) && !isAllowedLiteral(value)) {
          addViolation(sourceFile, node.initializer, "label-literal", value, violations);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
}

describe("UI hardcoded copy guard", () => {
  it("rejects hardcoded JSX/toast/status literals outside i18n", () => {
    const files = TARGET_DIRS.flatMap(listTsxFiles);
    const allViolations = files.flatMap(collectViolations);

    expect(
      allViolations,
      `Hardcoded UI literals found:\\n${allViolations
        .map((v) => `${path.relative(ROOT, v.file)}:${v.line} [${v.kind}] ${v.value}`)
        .join("\\n")}`,
    ).toEqual([]);
  });
});
