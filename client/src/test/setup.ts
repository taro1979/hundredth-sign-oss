// Polyfill for Promise.withResolvers (ES2024 / Node.js v22)
// jsdom@26 does not provide this, but pdfjs-dist@4 requires it.
if (typeof (Promise as any).withResolvers === "undefined") {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// Extend vitest's expect with jest-dom matchers.
// Uses the vitest-specific entry point so expect comes from 'vitest', not a global.
import "@testing-library/jest-dom/vitest";

import React from "react";
import { vi } from "vitest";

// Utility for creating a mock mutation
const mockMutation = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
  reset: vi.fn(),
});

// Utility for creating a mock utils invalidate / setData
const makeInvalidate = () => vi.fn().mockResolvedValue(undefined);
const makeSetData = () => vi.fn();

// tRPC mock - mock all routers with sensible defaults
vi.mock("@/lib/trpc", () => ({
  trpc: {
    dashboard: {
      stats: { useQuery: () => ({ data: null, isLoading: false, error: null }) },
      recentActivity: { useQuery: () => ({ data: [], isLoading: false, error: null }) },
    },
    inbox: {
      list: { useQuery: () => ({ data: [], isLoading: false, isError: false, error: null }) },
      countActionRequired: { useQuery: () => ({ data: 0, isLoading: false, isError: false, error: null }) },
      get: {
        useQuery: () => ({
          data: {
            kind: "signature",
            id: 1,
            documentId: 1,
            documentTitle: "Test Document",
            fromName: "Owner",
            fromEmail: "owner@example.com",
            toName: "Test User",
            toEmail: "test@example.com",
            subject: "Signature request: Test Document",
            bodyPreview: null,
            body: null,
            status: "sent",
            actionRequired: true,
            ctaType: "sign",
            actionUrl: "/sign/test-token?lng=ja",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          isLoading: false,
          isError: false,
          error: null,
        }),
      },
    },
    documents: {
      list: { useQuery: () => ({ data: [], isLoading: false, error: null }) },
      getById: { useQuery: () => ({ data: null, isLoading: false, error: null }) },
      create: { useMutation: () => mockMutation() },
      createFromTemplate: { useMutation: () => mockMutation() },
      uploadPdf: { useMutation: () => mockMutation() },
      saveFields: { useMutation: () => mockMutation() },
      sendForSignature: { useMutation: () => mockMutation() },
      delete: { useMutation: () => mockMutation() },
      resendReminder: { useMutation: () => mockMutation() },
    },
    templates: {
      list: { useQuery: () => ({ data: [], isLoading: false, error: null }) },
      getById: { useQuery: () => ({ data: null, isLoading: false, error: null }) },
      create: { useMutation: () => mockMutation() },
      uploadPdf: { useMutation: () => mockMutation() },
      saveFields: { useMutation: () => mockMutation() },
      delete: { useMutation: () => mockMutation() },
    },
    contacts: {
      list: { useQuery: () => ({ data: [], isLoading: false, error: null }) },
      create: { useMutation: () => mockMutation() },
      update: { useMutation: () => mockMutation() },
      delete: { useMutation: () => mockMutation() },
    },
    contactCategories: {
      list: { useQuery: () => ({ data: [], isLoading: false, error: null }) },
      create: { useMutation: () => mockMutation() },
      update: { useMutation: () => mockMutation() },
      delete: { useMutation: () => mockMutation() },
    },
    contactGroups: {
      list: { useQuery: () => ({ data: [], isLoading: false, error: null }) },
      members: { useQuery: () => ({ data: [], isLoading: false, error: null }) },
      create: { useMutation: () => mockMutation() },
      update: { useMutation: () => mockMutation() },
      delete: { useMutation: () => mockMutation() },
      addMember: { useMutation: () => mockMutation() },
      removeMember: { useMutation: () => mockMutation() },
    },
    organization: {
      list: {
        useQuery: () => ({
          data: [{ org: { id: 1, name: "Test Org" }, membership: { role: "owner" } }],
          isLoading: false,
          error: null,
        }),
      },
      getCurrent: { useQuery: () => ({ data: null, isLoading: false, error: null }) },
      getAuditLogs: {
        useQuery: () => ({ data: { logs: [], total: 0 }, isLoading: false, error: null }),
      },
      getMemberUsage: { useQuery: () => ({ data: [], isLoading: false, error: null }) },
      create: { useMutation: () => mockMutation() },
      ensure: { useMutation: () => mockMutation() },
      update: { useMutation: () => mockMutation() },
    },
    auth: {
      me: {
        useQuery: () => ({
          data: { id: 1, name: "Test User", email: "test@example.com" },
          isLoading: false,
          error: null,
        }),
        setData: makeSetData(),
        invalidate: makeInvalidate(),
      },
      logout: { useMutation: () => mockMutation() },
    },
    user: {
      listStaff: {
        useQuery: () => ({ data: [], isLoading: false, error: null }),
      },
      createStaff: { useMutation: () => mockMutation() },
      updateStaff: { useMutation: () => mockMutation() },
      resetStaffPassword: { useMutation: () => mockMutation() },
    },
    useUtils: () => ({
      auth: {
        me: {
          setData: makeSetData(),
          invalidate: makeInvalidate(),
        },
      },
      documents: {
        list: { invalidate: makeInvalidate() },
        getById: { invalidate: makeInvalidate() },
      },
      inbox: {
        list: { invalidate: makeInvalidate() },
      },
      templates: {
        list: { invalidate: makeInvalidate() },
        getById: { invalidate: makeInvalidate() },
      },
      contacts: {
        list: { invalidate: makeInvalidate() },
      },
      contactCategories: {
        list: { invalidate: makeInvalidate() },
      },
      contactGroups: {
        list: { invalidate: makeInvalidate() },
      },
      user: {
        listStaff: { invalidate: makeInvalidate() },
      },
    }),
  },
}));

// wouter mock
vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
  useParams: () => ({ kind: "signature", id: "1" }),
  useSearch: () => "",
  useRoute: () => [false, {}],
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
    React.createElement("a", props, children),
  Route: ({ children }: { children: React.ReactNode }) => children,
  Switch: ({ children }: { children: React.ReactNode }) => children,
}));

// react-i18next mock
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: "ja",
      changeLanguage: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

vi.mock("@/lib/i18n", () => ({
  SUPPORTED_LOCALES: ["en", "ja", "th", "zh-CN"],
  LOCALE_LABELS: {
    en: "English",
    ja: "日本語",
    th: "ไทย",
    "zh-CN": "简体中文",
  },
}));

// useAuth mock - mock at the hook level so we don't need trpc internals
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: 1, name: "Test User", email: "test@example.com" },
    loading: false,
    error: null,
    isAuthenticated: true,
    refresh: vi.fn(),
    logout: vi.fn(),
  }),
}));

if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
