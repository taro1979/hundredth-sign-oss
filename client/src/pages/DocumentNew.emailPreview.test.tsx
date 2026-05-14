import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DocumentNew from "@/pages/DocumentNew";
import { trpc } from "@/lib/trpc";
import * as wouter from "wouter";

vi.mock("@/components/PdfViewer", () => ({
  default: ({ overlayContent }: { overlayContent?: (pageIndex: number) => React.ReactNode }) => (
    <div data-testid="mock-pdf-viewer">
      {overlayContent?.(0)}
    </div>
  ),
}));

vi.mock("@/components/SignatureFieldEditor", () => ({
  SignatureFieldToolbar: () => <div data-testid="mock-toolbar" />,
  SignatureFieldPageOverlay: ({
    fields,
    onFieldsChange,
  }: {
    fields: Array<{ id: string }>;
    onFieldsChange: (next: any[]) => void;
  }) => (
    <button
      type="button"
      data-testid="mock-add-field"
      onClick={() =>
        onFieldsChange([
          ...fields,
          { id: "f1", page: 0, x: 10, y: 10, width: 10, height: 4, signerIndex: 0, type: "signature" },
        ])
      }
    >
      Add Field
    </button>
  ),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DocumentNew email preview dialog", () => {
  it("opens preview dialog from the button in step 4", async () => {
    vi.spyOn(wouter, "useSearch").mockReturnValue("?templateId=1");

    const mockMutation = (result: unknown = undefined) => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue(result),
      isPending: false,
      isError: false,
      error: null,
      reset: vi.fn(),
    });

    const createFromTemplateMutation = mockMutation({ id: 1 });
    (trpc as any).documents.create.useMutation = () => mockMutation({ id: 1 });
    (trpc as any).documents.createFromTemplate.useMutation = () => createFromTemplateMutation;
    (trpc as any).documents.uploadPdf.useMutation = () => mockMutation({});
    (trpc as any).documents.saveFields.useMutation = () => mockMutation({});
    (trpc as any).documents.sendForSignature.useMutation = () => mockMutation({ success: true });
    (trpc as any).documents.getById.useQuery = () => ({
      data: { id: 1, fileUrl: "https://example.com/sample.pdf" },
      isLoading: false,
      error: null,
    });
    (trpc as any).templates.getById.useQuery = () => ({
      data: { id: 1, title: "Template Title", description: "", fileUrl: "https://example.com/template.pdf", pageCount: 1 },
      isLoading: false,
      error: null,
    });

    render(<DocumentNew />);

    const user = userEvent.setup();
    const clickNext = async () => {
      const nextButtons = screen.getAllByRole("button", { name: /common\.next|documents\.create\.next|次へ|Next/i });
      await user.click(nextButtons[nextButtons.length - 1]);
    };

    await screen.findByDisplayValue("Template Title", {}, { timeout: 1000 });

    await clickNext();
    await waitFor(() => {
      expect(createFromTemplateMutation.mutateAsync).toHaveBeenCalled();
    });

    await user.type(
      await screen.findByPlaceholderText(/example@company\.com|recipient@company\.com/i),
      "signer@test.local",
    );
    await user.type(
      await screen.findByPlaceholderText(
        /documents\.create\.recipientNamePlaceholder|山田太郎|john doe|recipient name/i,
      ),
      "テスト太郎",
    );
    await clickNext();

    await user.click(await screen.findByTestId("mock-add-field"));
    await clickNext();

    await user.click(screen.getByRole("button", { name: /documents\.create\.previewEmail|メールプレビュー|Preview Email/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveClass("w-[90vw]");
    expect(dialog).toHaveClass("max-w-5xl");
    expect(dialog).toHaveClass("max-h-[90vh]");
  }, 60_000);
});
