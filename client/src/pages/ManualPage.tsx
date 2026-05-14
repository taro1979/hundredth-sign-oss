import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  Database,
  FileText,
  Gauge,
  HelpCircle,
  Inbox,
  Languages,
  LucideIcon,
  Network,
  Route,
  Search,
  Send,
  ServerCog,
  ShieldCheck,
  Stamp,
  TerminalSquare,
  UserCog,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ManualLayout } from "./ManualLayout";

type ManualTableRow = {
  labelKey: string;
  detailKey: string;
};

type ManualCodeBlock = {
  titleKey: string;
  codeKey: string;
};

type ManualDiagram = {
  titleKey: string;
  nodeKeys: string[];
};

type ManualScreenshot = {
  id: string;
  imagePath: string;
  altKey: string;
  captionKey: string;
};

type ManualSection = {
  id: string;
  titleKey: string;
  bodyKeys?: string[];
  bulletKeys?: string[];
  stepKeys?: string[];
  tableRows?: ManualTableRow[];
  codeBlocks?: ManualCodeBlock[];
  calloutKeys?: string[];
  diagram?: ManualDiagram;
  screenshots?: string[];
};

type ManualChapter = {
  id: string;
  key: string;
  path: string;
  icon: LucideIcon;
  navKey: string;
  titleKey: string;
  summaryKey: string;
  sections: ManualSection[];
};

const screenshotCatalog: Record<string, ManualScreenshot> = {
  login: {
    id: "login",
    imagePath: "/manual/screenshots/login.png",
    altKey: "manual.usage.screenshots.login.alt",
    captionKey: "manual.usage.screenshots.login.caption",
  },
  setup: {
    id: "setup",
    imagePath: "/manual/screenshots/setup.png",
    altKey: "manual.usage.screenshots.setup.alt",
    captionKey: "manual.usage.screenshots.setup.caption",
  },
  dashboard: {
    id: "dashboard",
    imagePath: "/manual/screenshots/dashboard.png",
    altKey: "manual.usage.screenshots.dashboard.alt",
    captionKey: "manual.usage.screenshots.dashboard.caption",
  },
  documents: {
    id: "documents",
    imagePath: "/manual/screenshots/documents.png",
    altKey: "manual.usage.screenshots.documents.alt",
    captionKey: "manual.usage.screenshots.documents.caption",
  },
  documentNew: {
    id: "documentNew",
    imagePath: "/manual/screenshots/document-new.png",
    altKey: "manual.usage.screenshots.documentNew.alt",
    captionKey: "manual.usage.screenshots.documentNew.caption",
  },
  signing: {
    id: "signing",
    imagePath: "/manual/screenshots/signing.png",
    altKey: "manual.usage.screenshots.signing.alt",
    captionKey: "manual.usage.screenshots.signing.caption",
  },
  inbox: {
    id: "inbox",
    imagePath: "/manual/screenshots/inbox.png",
    altKey: "manual.usage.screenshots.inbox.alt",
    captionKey: "manual.usage.screenshots.inbox.caption",
  },
  templates: {
    id: "templates",
    imagePath: "/manual/screenshots/templates.png",
    altKey: "manual.usage.screenshots.templates.alt",
    captionKey: "manual.usage.screenshots.templates.caption",
  },
  contacts: {
    id: "contacts",
    imagePath: "/manual/screenshots/contacts.png",
    altKey: "manual.usage.screenshots.contacts.alt",
    captionKey: "manual.usage.screenshots.contacts.caption",
  },
  audit: {
    id: "audit",
    imagePath: "/manual/screenshots/audit-log.png",
    altKey: "manual.usage.screenshots.audit.alt",
    captionKey: "manual.usage.screenshots.audit.caption",
  },
  settings: {
    id: "settings",
    imagePath: "/manual/screenshots/settings.png",
    altKey: "manual.usage.screenshots.settings.alt",
    captionKey: "manual.usage.screenshots.settings.caption",
  },
};

const chapterKey = (chapter: string, suffix: string) =>
  `manual.usage.chapters.${chapter}.${suffix}`;
const sectionKey = (chapter: string, section: string, suffix: string) =>
  chapterKey(chapter, `sections.${section}.${suffix}`);
const bodyKeys = (chapter: string, section: string, count: number) =>
  Array.from({ length: count }, (_, index) => sectionKey(chapter, section, `body.${index}`));
const bulletKeys = (chapter: string, section: string, count: number) =>
  Array.from({ length: count }, (_, index) => sectionKey(chapter, section, `bullets.${index}`));
const stepKeys = (chapter: string, section: string, count: number) =>
  Array.from({ length: count }, (_, index) => sectionKey(chapter, section, `steps.${index}`));
const calloutKeys = (chapter: string, section: string, count: number) =>
  Array.from({ length: count }, (_, index) => sectionKey(chapter, section, `callouts.${index}`));
const row = (chapter: string, section: string, id: string): ManualTableRow => ({
  labelKey: sectionKey(chapter, section, `rows.${id}.label`),
  detailKey: sectionKey(chapter, section, `rows.${id}.detail`),
});
const code = (chapter: string, section: string, id: string): ManualCodeBlock => ({
  titleKey: sectionKey(chapter, section, `code.${id}.title`),
  codeKey: sectionKey(chapter, section, `code.${id}.code`),
});
const diagram = (chapter: string, section: string, count: number): ManualDiagram => ({
  titleKey: sectionKey(chapter, section, "diagramTitle"),
  nodeKeys: Array.from({ length: count }, (_, index) =>
    sectionKey(chapter, section, `diagram.${index}`),
  ),
});

const makeChapter = (
  id: string,
  key: string,
  path: string,
  icon: LucideIcon,
  sections: ManualSection[],
): ManualChapter => ({
  id,
  key,
  path,
  icon,
  navKey: `manual.nav.${key}`,
  titleKey: chapterKey(key, "title"),
  summaryKey: chapterKey(key, "summary"),
  sections,
});

export const chapters: ManualChapter[] = [
  makeChapter("intro", "intro", "/manual", BookOpen, [
    {
      id: "boundary",
      titleKey: sectionKey("intro", "boundary", "title"),
      bodyKeys: bodyKeys("intro", "boundary", 3),
      bulletKeys: bulletKeys("intro", "boundary", 6),
      calloutKeys: calloutKeys("intro", "boundary", 1),
    },
    {
      id: "publicPrivate",
      titleKey: sectionKey("intro", "publicPrivate", "title"),
      bodyKeys: bodyKeys("intro", "publicPrivate", 1),
      tableRows: [
        row("intro", "publicPrivate", "public"),
        row("intro", "publicPrivate", "authenticated"),
        row("intro", "publicPrivate", "operator"),
        row("intro", "publicPrivate", "integration"),
      ],
    },
  ]),
  makeChapter("users-routes", "usersRoutes", "/manual/users-routes", Route, [
    {
      id: "roles",
      titleKey: sectionKey("usersRoutes", "roles", "title"),
      bodyKeys: bodyKeys("usersRoutes", "roles", 1),
      tableRows: [
        row("usersRoutes", "roles", "admin"),
        row("usersRoutes", "roles", "member"),
        row("usersRoutes", "roles", "signer"),
        row("usersRoutes", "roles", "cc"),
        row("usersRoutes", "roles", "approver"),
        row("usersRoutes", "roles", "apiClient"),
      ],
    },
    {
      id: "routes",
      titleKey: sectionKey("usersRoutes", "routes", "title"),
      bodyKeys: bodyKeys("usersRoutes", "routes", 1),
      tableRows: [
        row("usersRoutes", "routes", "public"),
        row("usersRoutes", "routes", "app"),
        row("usersRoutes", "routes", "settings"),
        row("usersRoutes", "routes", "api"),
        row("usersRoutes", "routes", "sign"),
      ],
    },
  ]),
  makeChapter("setup", "setup", "/manual/setup", ServerCog, [
    {
      id: "environment",
      titleKey: sectionKey("setup", "environment", "title"),
      bodyKeys: bodyKeys("setup", "environment", 2),
      tableRows: [
        row("setup", "environment", "databaseUrl"),
        row("setup", "environment", "sessionSecret"),
        row("setup", "environment", "appUrl"),
        row("setup", "environment", "smtp"),
        row("setup", "environment", "storage"),
        row("setup", "environment", "openai"),
      ],
      codeBlocks: [code("setup", "environment", "env")],
      calloutKeys: calloutKeys("setup", "environment", 1),
    },
    {
      id: "startup",
      titleKey: sectionKey("setup", "startup", "title"),
      bodyKeys: bodyKeys("setup", "startup", 1),
      stepKeys: stepKeys("setup", "startup", 5),
      codeBlocks: [code("setup", "startup", "commands")],
      screenshots: ["setup"],
    },
  ]),
  makeChapter("auth-staff", "authStaff", "/manual/auth-staff", UserCog, [
    {
      id: "login",
      titleKey: sectionKey("authStaff", "login", "title"),
      bodyKeys: bodyKeys("authStaff", "login", 2),
      bulletKeys: bulletKeys("authStaff", "login", 5),
      screenshots: ["login"],
    },
    {
      id: "staff",
      titleKey: sectionKey("authStaff", "staff", "title"),
      bodyKeys: bodyKeys("authStaff", "staff", 1),
      tableRows: [
        row("authStaff", "staff", "invite"),
        row("authStaff", "staff", "role"),
        row("authStaff", "staff", "deactivate"),
        row("authStaff", "staff", "locale"),
      ],
      screenshots: ["settings"],
    },
  ]),
  makeChapter("dashboard", "dashboard", "/manual/dashboard", Gauge, [
    {
      id: "daily",
      titleKey: sectionKey("dashboard", "daily", "title"),
      bodyKeys: bodyKeys("dashboard", "daily", 2),
      bulletKeys: bulletKeys("dashboard", "daily", 7),
      screenshots: ["dashboard"],
    },
    {
      id: "status",
      titleKey: sectionKey("dashboard", "status", "title"),
      bodyKeys: bodyKeys("dashboard", "status", 1),
      tableRows: [
        row("dashboard", "status", "draft"),
        row("dashboard", "status", "sent"),
        row("dashboard", "status", "viewed"),
        row("dashboard", "status", "signed"),
        row("dashboard", "status", "declined"),
        row("dashboard", "status", "completed"),
        row("dashboard", "status", "expired"),
      ],
    },
  ]),
  makeChapter("documents", "documents", "/manual/documents", FileText, [
    {
      id: "pdf",
      titleKey: sectionKey("documents", "pdf", "title"),
      bodyKeys: bodyKeys("documents", "pdf", 2),
      bulletKeys: bulletKeys("documents", "pdf", 7),
      calloutKeys: calloutKeys("documents", "pdf", 1),
      screenshots: ["documents", "documentNew"],
    },
    {
      id: "fields",
      titleKey: sectionKey("documents", "fields", "title"),
      bodyKeys: bodyKeys("documents", "fields", 1),
      tableRows: [
        row("documents", "fields", "signature"),
        row("documents", "fields", "initial"),
        row("documents", "fields", "stamp"),
        row("documents", "fields", "text"),
        row("documents", "fields", "date"),
        row("documents", "fields", "checkbox"),
      ],
    },
  ]),
  makeChapter("signing", "signing", "/manual/signing", Send, [
    {
      id: "request",
      titleKey: sectionKey("signing", "request", "title"),
      bodyKeys: bodyKeys("signing", "request", 2),
      bulletKeys: bulletKeys("signing", "request", 8),
      diagram: diagram("signing", "request", 6),
      screenshots: ["signing"],
    },
    {
      id: "outcomes",
      titleKey: sectionKey("signing", "outcomes", "title"),
      bodyKeys: bodyKeys("signing", "outcomes", 1),
      tableRows: [
        row("signing", "outcomes", "signed"),
        row("signing", "outcomes", "declined"),
        row("signing", "outcomes", "delegated"),
        row("signing", "outcomes", "completedPdf"),
        row("signing", "outcomes", "certificate"),
      ],
    },
  ]),
  makeChapter("internal-approval", "internalApproval", "/manual/internal-approval", ClipboardCheck, [
    {
      id: "flow",
      titleKey: sectionKey("internalApproval", "flow", "title"),
      bodyKeys: bodyKeys("internalApproval", "flow", 2),
      tableRows: [
        row("internalApproval", "flow", "draft"),
        row("internalApproval", "flow", "pending"),
        row("internalApproval", "flow", "approved"),
        row("internalApproval", "flow", "rejected"),
        row("internalApproval", "flow", "cancelled"),
      ],
      calloutKeys: calloutKeys("internalApproval", "flow", 1),
    },
    {
      id: "actions",
      titleKey: sectionKey("internalApproval", "actions", "title"),
      bulletKeys: bulletKeys("internalApproval", "actions", 6),
    },
  ]),
  makeChapter("inbox", "inbox", "/manual/inbox", Inbox, [
    {
      id: "concept",
      titleKey: sectionKey("inbox", "concept", "title"),
      bodyKeys: bodyKeys("inbox", "concept", 3),
      calloutKeys: calloutKeys("inbox", "concept", 1),
      screenshots: ["inbox"],
    },
    {
      id: "items",
      titleKey: sectionKey("inbox", "items", "title"),
      tableRows: [
        row("inbox", "items", "signature"),
        row("inbox", "items", "approval"),
        row("inbox", "items", "delegation"),
        row("inbox", "items", "cc"),
      ],
    },
  ]),
  makeChapter("templates", "templates", "/manual/templates", Stamp, [
    {
      id: "usage",
      titleKey: sectionKey("templates", "usage", "title"),
      bodyKeys: bodyKeys("templates", "usage", 2),
      bulletKeys: bulletKeys("templates", "usage", 6),
      screenshots: ["templates"],
    },
    {
      id: "variables",
      titleKey: sectionKey("templates", "variables", "title"),
      tableRows: [
        row("templates", "variables", "document"),
        row("templates", "variables", "recipient"),
        row("templates", "variables", "sender"),
        row("templates", "variables", "workflow"),
      ],
    },
  ]),
  makeChapter("contacts", "contacts", "/manual/contacts", Users, [
    {
      id: "directory",
      titleKey: sectionKey("contacts", "directory", "title"),
      bodyKeys: bodyKeys("contacts", "directory", 2),
      bulletKeys: bulletKeys("contacts", "directory", 6),
      screenshots: ["contacts"],
    },
    {
      id: "classification",
      titleKey: sectionKey("contacts", "classification", "title"),
      tableRows: [
        row("contacts", "classification", "contact"),
        row("contacts", "classification", "category"),
        row("contacts", "classification", "group"),
        row("contacts", "classification", "recipient"),
      ],
    },
  ]),
  makeChapter("compliance", "compliance", "/manual/compliance", ShieldCheck, [
    {
      id: "audit",
      titleKey: sectionKey("compliance", "audit", "title"),
      bodyKeys: bodyKeys("compliance", "audit", 2),
      bulletKeys: bulletKeys("compliance", "audit", 8),
      screenshots: ["audit"],
    },
    {
      id: "worm",
      titleKey: sectionKey("compliance", "worm", "title"),
      bodyKeys: bodyKeys("compliance", "worm", 1),
      tableRows: [
        row("compliance", "worm", "activityLogs"),
        row("compliance", "worm", "systemAuditLogs"),
        row("compliance", "worm", "pdfProxy"),
        row("compliance", "worm", "hashChain"),
        row("compliance", "worm", "deletePolicy"),
      ],
    },
  ]),
  makeChapter("email-locales", "emailLocales", "/manual/email-locales", Languages, [
    {
      id: "mail",
      titleKey: sectionKey("emailLocales", "mail", "title"),
      bodyKeys: bodyKeys("emailLocales", "mail", 1),
      tableRows: [
        row("emailLocales", "mail", "invitation"),
        row("emailLocales", "mail", "signatureRequest"),
        row("emailLocales", "mail", "reminder"),
        row("emailLocales", "mail", "completion"),
        row("emailLocales", "mail", "approval"),
      ],
    },
    {
      id: "locale",
      titleKey: sectionKey("emailLocales", "locale", "title"),
      bodyKeys: bodyKeys("emailLocales", "locale", 2),
      bulletKeys: bulletKeys("emailLocales", "locale", 5),
      calloutKeys: calloutKeys("emailLocales", "locale", 1),
    },
  ]),
  makeChapter("api", "api", "/manual/api", Network, [
    {
      id: "auth",
      titleKey: sectionKey("api", "auth", "title"),
      bodyKeys: bodyKeys("api", "auth", 2),
      tableRows: [
        row("api", "auth", "token"),
        row("api", "auth", "scope"),
        row("api", "auth", "idempotency"),
        row("api", "auth", "audit"),
      ],
      codeBlocks: [code("api", "auth", "curl")],
    },
    {
      id: "endpoints",
      titleKey: sectionKey("api", "endpoints", "title"),
      tableRows: [
        row("api", "endpoints", "createDocument"),
        row("api", "endpoints", "createRequest"),
        row("api", "endpoints", "getStatus"),
        row("api", "endpoints", "downloadPdf"),
        row("api", "endpoints", "webhooks"),
      ],
    },
  ]),
  makeChapter("cli", "cli", "/manual/cli", TerminalSquare, [
    {
      id: "environment",
      titleKey: sectionKey("cli", "environment", "title"),
      bodyKeys: bodyKeys("cli", "environment", 1),
      tableRows: [
        row("cli", "environment", "baseUrl"),
        row("cli", "environment", "apiKey"),
        row("cli", "environment", "idempotency"),
        row("cli", "environment", "output"),
      ],
      codeBlocks: [code("cli", "environment", "env")],
    },
    {
      id: "commands",
      titleKey: sectionKey("cli", "commands", "title"),
      bodyKeys: bodyKeys("cli", "commands", 1),
      codeBlocks: [code("cli", "commands", "examples")],
      calloutKeys: calloutKeys("cli", "commands", 1),
    },
  ]),
  makeChapter("data-model", "dataModel", "/manual/data-model", Database, [
    {
      id: "tables",
      titleKey: sectionKey("dataModel", "tables", "title"),
      bodyKeys: bodyKeys("dataModel", "tables", 1),
      tableRows: [
        row("dataModel", "tables", "users"),
        row("dataModel", "tables", "documents"),
        row("dataModel", "tables", "signatureRequests"),
        row("dataModel", "tables", "signers"),
        row("dataModel", "tables", "signatureFields"),
        row("dataModel", "tables", "templates"),
        row("dataModel", "tables", "contacts"),
        row("dataModel", "tables", "approvals"),
        row("dataModel", "tables", "audit"),
        row("dataModel", "tables", "integrations"),
      ],
    },
    {
      id: "constraints",
      titleKey: sectionKey("dataModel", "constraints", "title"),
      bulletKeys: bulletKeys("dataModel", "constraints", 7),
    },
  ]),
  makeChapter("operations", "operations", "/manual/operations", HelpCircle, [
    {
      id: "faq",
      titleKey: sectionKey("operations", "faq", "title"),
      bodyKeys: bodyKeys("operations", "faq", 1),
      tableRows: [
        row("operations", "faq", "login"),
        row("operations", "faq", "mail"),
        row("operations", "faq", "pdf"),
        row("operations", "faq", "signingLink"),
        row("operations", "faq", "apiKey"),
        row("operations", "faq", "auditLog"),
        row("operations", "faq", "migration"),
        row("operations", "faq", "locale"),
      ],
    },
    {
      id: "runbook",
      titleKey: sectionKey("operations", "runbook", "title"),
      stepKeys: stepKeys("operations", "runbook", 6),
      codeBlocks: [code("operations", "runbook", "verify")],
    },
  ]),
  makeChapter("developer", "developer", "/manual/developer", Code2, [
    {
      id: "rules",
      titleKey: sectionKey("developer", "rules", "title"),
      bodyKeys: bodyKeys("developer", "rules", 1),
      bulletKeys: bulletKeys("developer", "rules", 8),
      codeBlocks: [code("developer", "rules", "commands")],
    },
    {
      id: "checklist",
      titleKey: sectionKey("developer", "checklist", "title"),
      tableRows: [
        row("developer", "checklist", "schema"),
        row("developer", "checklist", "audit"),
        row("developer", "checklist", "locale"),
        row("developer", "checklist", "manual"),
        row("developer", "checklist", "test"),
      ],
    },
  ]),
];

const searchKeysForChapter = (chapter: ManualChapter): string[] => {
  const keys = [chapter.navKey, chapter.titleKey, chapter.summaryKey];
  for (const section of chapter.sections) {
    keys.push(section.titleKey);
    keys.push(...(section.bodyKeys ?? []));
    keys.push(...(section.bulletKeys ?? []));
    keys.push(...(section.stepKeys ?? []));
    keys.push(...(section.calloutKeys ?? []));
    for (const row of section.tableRows ?? []) {
      keys.push(row.labelKey, row.detailKey);
    }
    for (const block of section.codeBlocks ?? []) {
      keys.push(block.titleKey, block.codeKey);
    }
    if (section.diagram) {
      keys.push(section.diagram.titleKey, ...section.diagram.nodeKeys);
    }
  }
  return keys;
};

function FlowDiagram({ diagram }: { diagram: ManualDiagram }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 p-4">
      <p className="text-sm font-semibold text-primary">{t(diagram.titleKey)}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {diagram.nodeKeys.map((nodeKey, index) => (
          <div
            key={nodeKey}
            className="flex min-h-16 items-center gap-3 rounded-md border bg-background p-3 text-sm"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {index + 1}
            </span>
            <span>{t(nodeKey)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManualDataTable({ rows }: { rows: ManualTableRow[] }) {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-[640px] w-full divide-y text-sm">
        <thead className="bg-muted/70 text-left">
          <tr>
            <th className="w-56 px-4 py-3 font-semibold">{t("manual.usage.table.item")}</th>
            <th className="px-4 py-3 font-semibold">{t("manual.usage.table.description")}</th>
          </tr>
        </thead>
        <tbody className="divide-y bg-background">
          {rows.map((row) => (
            <tr key={row.labelKey}>
              <th className="align-top px-4 py-3 text-left font-medium text-foreground">
                {t(row.labelKey)}
              </th>
              <td className="px-4 py-3 text-muted-foreground">{t(row.detailKey)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManualCalloutList({ keys }: { keys: string[] }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {keys.map((key) => (
        <div key={key} className="flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{t(key)}</p>
        </div>
      ))}
    </div>
  );
}

function ManualCodeBlock({ block }: { block: ManualCodeBlock }) {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-md border bg-slate-950">
      <div className="border-b border-white/10 px-4 py-2 text-xs font-semibold text-slate-200">
        {t(block.titleKey)}
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-6 text-slate-100">
        <code>{t(block.codeKey)}</code>
      </pre>
    </div>
  );
}

function ScreenshotFigure({ screenshot }: { screenshot: ManualScreenshot }) {
  const { t } = useTranslation();

  return (
    <figure className="rounded-md border bg-background p-3">
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className="block w-full overflow-hidden rounded-md border bg-muted text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <img src={screenshot.imagePath} alt={t(screenshot.altKey)} className="h-auto w-full" />
            <span className="sr-only">{t("manual.usage.screenshots.openFullSize")}</span>
          </button>
        </DialogTrigger>
        <DialogContent className="w-[75vw] max-w-[75vw] sm:max-w-[75vw] max-h-[82vh] overflow-hidden p-0">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle>{t(screenshot.captionKey)}</DialogTitle>
            <DialogDescription>{t(screenshot.altKey)}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(82vh-7rem)] overflow-auto px-5 pb-5">
            <img
              src={screenshot.imagePath}
              alt={t(screenshot.altKey)}
              className="mx-auto h-auto max-h-[calc(82vh-8rem)] w-auto max-w-full object-contain"
            />
          </div>
          <DialogClose className="sr-only">{t("common.close")}</DialogClose>
        </DialogContent>
      </Dialog>
      <figcaption className="mt-3 text-sm text-muted-foreground">{t(screenshot.captionKey)}</figcaption>
    </figure>
  );
}

function ManualSectionBlock({ section }: { section: ManualSection }) {
  const { t } = useTranslation();
  const screenshots = section.screenshots
    ?.map((id) => screenshotCatalog[id])
    .filter((screenshot): screenshot is ManualScreenshot => Boolean(screenshot));

  return (
    <section className="border-t pt-8 first:border-t-0 first:pt-0">
      <h2 className="text-2xl font-semibold tracking-tight">{t(section.titleKey)}</h2>
      {section.bodyKeys?.length ? (
        <div className="mt-4 space-y-4 text-muted-foreground">
          {section.bodyKeys.map((key) => (
            <p key={key}>{t(key)}</p>
          ))}
        </div>
      ) : null}
      {section.bulletKeys?.length ? (
        <ul className="mt-4 space-y-3 text-muted-foreground">
          {section.bulletKeys.map((key) => (
            <li key={key} className="flex gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {section.stepKeys?.length ? (
        <ol className="mt-4 space-y-3 text-muted-foreground">
          {section.stepKeys.map((key, index) => (
            <li key={key} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {index + 1}
              </span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {section.tableRows?.length ? (
        <div className="mt-5">
          <ManualDataTable rows={section.tableRows} />
        </div>
      ) : null}
      {section.diagram ? (
        <div className="mt-5">
          <FlowDiagram diagram={section.diagram} />
        </div>
      ) : null}
      {section.codeBlocks?.length ? (
        <div className="mt-5 space-y-4">
          {section.codeBlocks.map((block) => (
            <ManualCodeBlock key={block.titleKey} block={block} />
          ))}
        </div>
      ) : null}
      {section.calloutKeys?.length ? (
        <div className="mt-5">
          <ManualCalloutList keys={section.calloutKeys} />
        </div>
      ) : null}
      {screenshots?.length ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {screenshots.map((screenshot) => (
            <ScreenshotFigure key={screenshot.id} screenshot={screenshot} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ManualChapterContent({ chapter }: { chapter: ManualChapter }) {
  const { t } = useTranslation();
  const Icon = chapter.icon;

  return (
    <div className="space-y-8">
      <div className="rounded-md border bg-muted/30 p-5">
        <div className="flex gap-4">
          <Icon className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-medium text-primary">{t(chapter.navKey)}</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">{t(chapter.titleKey)}</h2>
            <p className="mt-3 text-muted-foreground">{t(chapter.summaryKey)}</p>
          </div>
        </div>
      </div>
      <div className="space-y-8">
        {chapter.sections.map((section) => (
          <ManualSectionBlock key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}

function SearchResults({
  query,
  results,
}: {
  query: string;
  results: ManualChapter[];
}) {
  const { t } = useTranslation();

  if (!query.trim()) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Search className="h-4 w-4" aria-hidden />
        <span>{t("manual.usage.search.results", { count: results.length })}</span>
      </div>
      {results.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {results.map((chapter) => {
            const Icon = chapter.icon;
            return (
              <Link
                key={chapter.id}
                href={chapter.path}
                className="rounded-md border bg-background p-4 transition hover:border-primary hover:bg-primary/5"
              >
                <div className="flex gap-3">
                  <Icon className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="text-sm font-medium text-primary">{t(chapter.navKey)}</p>
                    <h3 className="mt-1 font-semibold">{t(chapter.titleKey)}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{t(chapter.summaryKey)}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          {t("manual.usage.search.empty")}
        </div>
      )}
    </section>
  );
}

export function ManualPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }
    return chapters.filter((chapter) =>
      searchKeysForChapter(chapter)
        .map((key) => t(key))
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [normalizedQuery, t]);
  const introChapter = chapters[0];

  return (
    <ManualLayout
      eyebrow={t("manual.usage.eyebrow")}
      title={t("manual.usage.title")}
      description={t("manual.usage.description")}
    >
      <div className="space-y-10">
        <section className="rounded-md border border-primary/20 bg-primary/5 p-5">
          <div className="flex gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="font-semibold">{t("manual.usage.ossNotice.title")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t("manual.usage.ossNotice.body")}</p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <label htmlFor="manual-search" className="text-sm font-medium">
            {t("manual.usage.search.label")}
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="manual-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("manual.usage.search.placeholder")}
              className="h-11 w-full rounded-md border bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </section>

        <SearchResults query={searchQuery} results={searchResults} />

        {!normalizedQuery ? (
          <>
            <ManualChapterContent chapter={introChapter} />

            <section className="space-y-4">
              <div>
                <p className="text-sm font-medium text-primary">{t("manual.usage.tocLabel")}</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                  {t("manual.usage.categoryIndex.title")}
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {chapters.slice(1).map((chapter) => {
                  const Icon = chapter.icon;
                  return (
                    <Link
                      key={chapter.id}
                      href={chapter.path}
                      className="rounded-md border bg-background p-4 transition hover:border-primary hover:bg-primary/5"
                    >
                      <Icon className="h-5 w-5 text-primary" aria-hidden />
                      <h3 className="mt-3 font-semibold">{t(chapter.titleKey)}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{t(chapter.summaryKey)}</p>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="rounded-md border p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold">{t("manual.usage.contactCta.title")}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{t("manual.usage.contactCta.body")}</p>
                </div>
                <Link
                  href="/contact"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
                >
                  {t("manual.usage.contactCta.action")}
                </Link>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </ManualLayout>
  );
}

export function ManualChapterPage({ chapterId }: { chapterId: string }) {
  const { t } = useTranslation();
  const chapter = chapters.find((item) => item.id === chapterId || item.key === chapterId);

  if (!chapter) {
    return (
      <ManualLayout
        eyebrow={t("manual.usage.eyebrow")}
        title={t("manual.usage.notFound.title")}
        description={t("manual.usage.notFound.description")}
      >
        <div className="rounded-md border border-dashed p-6 text-muted-foreground">
          {t("manual.usage.notFound.body")}
        </div>
      </ManualLayout>
    );
  }

  return (
    <ManualLayout
      eyebrow={t("manual.usage.eyebrow")}
      title={t(chapter.titleKey)}
      description={t(chapter.summaryKey)}
    >
      <ManualChapterContent chapter={chapter} />
    </ManualLayout>
  );
}

export default ManualPage;
