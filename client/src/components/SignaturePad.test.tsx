import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignaturePad from "./SignaturePad";

vi.mock("./HankoGenerator", () => ({
  default: () => <div data-testid="mock-hanko-generator" />,
}));

describe("SignaturePad", () => {
  const mockOnSignatureComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    const mockContext = {
      font: "",
      measureText: vi.fn(() => ({ width: 320 })),
      scale: vi.fn(),
      fillText: vi.fn(),
      textBaseline: "alphabetic",
      fillStyle: "",
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockContext);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,mock-font-signature");

    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { load: vi.fn().mockResolvedValue(undefined) },
    });

    mockOnSignatureComplete.mockReset();
    mockOnCancel.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns signatureFont and signatureDataUrl when completing typed font signature", { timeout: 30000 }, async () => {
    render(
      <SignaturePad
        signerName="bib"
        onSignatureComplete={mockOnSignatureComplete}
        onCancel={mockOnCancel}
      />
    );

    const user = userEvent.setup();

    const nameInput = screen.getByPlaceholderText(/signaturePad\.namePlaceholder|署名する名前を入力/);
    await user.clear(nameInput);
    await user.type(nameInput, "  bib  ");

    await user.click(screen.getByRole("button", { name: /Great Vibes/i }));
    await user.click(screen.getByRole("button", { name: /signaturePad\.confirm|署名を確定/ }));

    await waitFor(() => {
      expect(mockOnSignatureComplete).toHaveBeenCalledTimes(1);
    });

    expect(mockOnSignatureComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        signatureFont: "great-vibes",
        signatureDataUrl: "data:image/png;base64,mock-font-signature",
        signerName: "bib",
      })
    );
  });
});
