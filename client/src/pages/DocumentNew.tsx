import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation, useSearch } from "wouter";
import {
  ArrowLeft, Upload, FileText, AlertCircle, Layers, CheckCircle, Clock,
  Plus, Trash2, User, BookUser, Send, ChevronRight, PenLine, Search, Eye, MessageSquare, X, Check,
} from "lucide-react";
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { EMAIL_LOCALE_OPTIONS, resolveEmailLocaleCode } from "@shared/locales";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { validatePdfFile } from "@shared/validation";
import PdfViewer from "@/components/PdfViewer";
import {
  SignatureFieldToolbar,
  SignatureFieldPageOverlay,
  type SignatureField,
  type SignatureFieldType,
} from "@/components/SignatureFieldEditor";

// ==================== Types ====================

interface RecipientEntry {
  email: string;
  name: string;
  company: string;
  role: "signer" | "cc";
  accessCode: string;
  locale: string;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

// ==================== Component ====================

export default function DocumentNew() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(searchString), [searchString]);
  const templateIdParam = searchParams.get("templateId");
  const draftIdParam = searchParams.get("draftId");
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const defaultRecipientLocale = resolveEmailLocaleCode(user?.locale ?? i18n.language);

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Step 1: Document info
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Recipients
  const [recipients, setRecipients] = useState<RecipientEntry[]>([
    { email: "", name: "", company: "", role: "signer", accessCode: "", locale: defaultRecipientLocale },
  ]);
  const [contactSearch, setContactSearch] = useState("");
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactPickerIndex, setContactPickerIndex] = useState(0);
  const [pickerGroupFilter, setPickerGroupFilter] = useState("all");
  const [sequentialRouting, setSequentialRouting] = useState(false);
  const [expirationDays, setExpirationDays] = useState<string>("");
  const [reminderDays, setReminderDays] = useState<string>("");

  // Internal approval flow
  const [requireInternalApproval, setRequireInternalApproval] = useState(false);
  const [internalApprovers, setInternalApprovers] = useState<{ email: string; name: string }[]>([]);

  // Step 3: Signature fields
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
  const [selectedFieldType, setSelectedFieldType] = useState<SignatureFieldType>("signature");
  const [selectedSigner, setSelectedSigner] = useState(0);

  // Created document state
  const [createdDocId, setCreatedDocId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Task 2: Global comment & email preview
  const [globalComment, setGlobalComment] = useState("");
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const getStepLabel = useCallback((step: WizardStep) => t(`documents.create.step${step}`), [t]);

  // Template data
  const templateId = templateIdParam ? parseInt(templateIdParam) : null;
  const { data: template, isLoading: templateLoading } = trpc.templates.getById.useQuery(
    { id: templateId! },
    { enabled: !!templateId }
  );

  // Draft data (when editing existing draft)
  const draftId = draftIdParam ? parseInt(draftIdParam) : null;
  const { data: draftDoc } = trpc.documents.getById.useQuery(
    { id: draftId! },
    { enabled: !!draftId && !createdDocId }
  );

  // Contacts
  const { data: contactsList } = trpc.contacts.list.useQuery();
  const { data: contactGroupsList } = trpc.contactGroups.list.useQuery();

  // Get created document data for steps 2+
  const { data: createdDoc } = trpc.documents.getById.useQuery(
    { id: createdDocId! },
    { enabled: !!createdDocId }
  );

  // Pre-fill from draft document
  useEffect(() => {
    if (draftDoc && draftDoc.status === "draft" && !createdDocId) {
      setCreatedDocId(draftDoc.id);
      if (!title) setTitle(draftDoc.title);
      if (!description && draftDoc.description) setDescription(draftDoc.description);
      // Load existing fields
      const existingFields = (draftDoc as any)?.signatureFields || [];
      if (existingFields.length > 0 && signatureFields.length === 0) {
        setSignatureFields(existingFields.map((f: any, i: number) => ({
          id: `existing-${f.id || i}`,
          page: f.page,
          x: Number(f.xPercent),
          y: Number(f.yPercent),
          width: Number(f.widthPercent),
          height: Number(f.heightPercent),
          signerIndex: f.signerIndex,
          type: f.type as SignatureFieldType,
          required: f.required ?? true,
        })));
      }
      // If PDF is already uploaded, skip to step 2
      if (draftDoc.fileUrl) {
        setCurrentStep(2);
      }
    }
  }, [draftDoc]);

  // Pre-fill from template
  useEffect(() => {
    if (template) {
      if (!title && template.title) setTitle(template.title);
      if (!description && template.description) setDescription(template.description ?? "");
      // Load template fields
      const tplFields = (template as any)?.templateFields || [];
      if (tplFields.length > 0 && signatureFields.length === 0) {
        setSignatureFields(tplFields.map((f: any) => ({
          id: f.clientId || `tf-${f.id}`,
          page: f.page,
          x: Number(f.xPercent),
          y: Number(f.yPercent),
          width: Number(f.widthPercent),
          height: Number(f.heightPercent),
          signerIndex: f.signerIndex,
          type: f.type as SignatureFieldType,
          required: f.required ?? true,
        })));
      }
    }
  }, [template]);

  const utils = trpc.useUtils();
  const createMutation = trpc.documents.create.useMutation();
  const createFromTemplateMutation = trpc.documents.createFromTemplate.useMutation();
  const uploadMutation = trpc.documents.uploadPdf.useMutation();
  const saveFieldsMutation = trpc.documents.saveFields.useMutation();
  const sendMutation = trpc.documents.sendForSignature.useMutation();

  const isFromTemplate = !!templateId && !!template;
  const templateFields = (template as any)?.templateFields || [];

  // Filtered contacts for picker
  const filteredContacts = useMemo(() => {
    if (!contactsList) return [];
    let result = contactsList;
    // Group filter
    if (pickerGroupFilter !== "all") {
      const gId = parseInt(pickerGroupFilter);
      result = result.filter((c: any) => c.groups?.some((g: any) => g.id === gId));
    }
    // Text search
    if (contactSearch.trim()) {
      const q = contactSearch.toLowerCase();
      result = result.filter((c: any) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.company && c.company.toLowerCase().includes(q))
      );
    }
    return result;
  }, [contactsList, contactSearch, pickerGroupFilter]);

  // Signer-only recipients (for field assignment)
  const signerRecipients = useMemo(() => recipients.filter(r => r.role === "signer"), [recipients]);

  // ==================== Handlers ====================

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    const validation = validatePdfFile(selectedFile);
    if (!validation.valid) {
      setFileError(validation.error || t("documents.create.invalidFile"));
      setFile(null);
      return;
    }
    setFileError(null);
    setFile(selectedFile);
    // Auto-fill title from filename if empty
    if (!title.trim()) {
      const nameWithoutExt = selectedFile.name.replace(/\.pdf$/i, "");
      setTitle(nameWithoutExt);
    }
  };

  const addRecipient = () => {
    setRecipients([...recipients, { email: "", name: "", company: "", role: "signer", accessCode: "", locale: defaultRecipientLocale }]);
  };

  const removeRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const updateRecipient = (index: number, field: keyof RecipientEntry, value: string) => {
    const updated = [...recipients];
    updated[index] = { ...updated[index], [field]: value };
    setRecipients(updated);
  };

  const openContactPicker = (index: number) => {
    setContactPickerIndex(index);
    setShowContactPicker(true);
    setContactSearch("");
    setPickerGroupFilter("all");
  };

  const selectContact = (contact: { name: string; email: string; company?: string | null }) => {
    const updated = [...recipients];
    updated[contactPickerIndex] = {
      ...updated[contactPickerIndex],
      name: contact.name,
      email: contact.email,
      company: contact.company || "",
    };
    setRecipients(updated);
    setShowContactPicker(false);
  };

  // ==================== Step Navigation ====================

  const validateStep1 = (): boolean => {
    if (!isFromTemplate && !file) {
      toast.error(t("documents.create.validation.uploadPdf"));
      return false;
    }
    if (!title.trim()) {
      toast.error(t("documents.create.validation.titleRequired"));
      return false;
    }
    if (title.trim().length > 500) {
      toast.error(t("documents.create.validation.titleTooLong"));
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    const validRecipients = recipients.filter(r => r.email.trim());
    if (validRecipients.length === 0) {
      toast.error(t("documents.create.validation.recipientRequired"));
      return false;
    }
    const signers = validRecipients.filter(r => r.role === "signer");
    if (signers.length === 0) {
      toast.error(t("documents.create.validation.signerRequired"));
      return false;
    }
    for (const r of validRecipients) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())) {
        toast.error(t("documents.create.validation.invalidEmail", { email: r.email }));
        return false;
      }
      if (!r.name.trim()) {
        toast.error(t("documents.create.validation.recipientNameRequired"));
        return false;
      }
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    if (signatureFields.length === 0) {
      toast.error(t("documents.create.validation.fieldRequired"));
      return false;
    }
    // Check each signer has at least one field
    for (let i = 0; i < signerRecipients.length; i++) {
      if (!signatureFields.some(f => f.signerIndex === i)) {
        toast.error(t("documents.create.validation.signerFieldMissing", {
          signer: signerRecipients[i].name || t("documents.create.signerIndex", { count: i + 1 }),
        }));
        return false;
      }
    }
    return true;
  };

  const goToStep = async (step: WizardStep) => {
    // Validate current step before advancing
    if (step > currentStep) {
      if (currentStep === 1 && !validateStep1()) return;
      if (currentStep === 2 && !validateStep2()) return;
      if (currentStep === 3 && !validateStep3()) return;
    }

    // If moving from step 1, create the document first
    if (currentStep === 1 && step > 1 && !createdDocId) {
      setIsSubmitting(true);
      try {
        let docId: number;
        if (isFromTemplate) {
          const result = await createFromTemplateMutation.mutateAsync({
            templateId: templateId!,
            title: title.trim(),
            description: description.trim() || undefined,
          });
          docId = result.id;
        } else {
          const result = await createMutation.mutateAsync({
            title: title.trim(),
            description: description.trim() || undefined,
          });
          docId = result.id;

          // Upload PDF
          if (file) {
            const base64 = await fileToBase64(file);
            await uploadMutation.mutateAsync({
              documentId: docId,
              fileName: file.name,
              fileBase64: base64,
              mimeType: file.type || "application/pdf",
            });
          }
        }
        setCreatedDocId(docId);
        utils.documents.getById.invalidate({ id: docId });
      } catch {
        toast.error(t("documents.create.createError"));
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    }

    setCurrentStep(step);
  };

  const handleSend = async () => {
    if (!createdDocId) return;
    setIsSending(true);
    try {
      // Save fields first
      await saveFieldsMutation.mutateAsync({
        documentId: createdDocId,
        fields: signatureFields.map(f => ({
          id: f.id,
          page: f.page,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          signerIndex: f.signerIndex,
          type: f.type,
        })),
      });

      // Send for signature
      const validRecipients = recipients.filter(r => r.email.trim());
      const sendPayload: any = {
        documentId: createdDocId,
        signers: validRecipients.map((r, i) => ({
          email: r.email.trim(),
          name: r.name.trim(),
          order: i + 1,
          role: r.role,
          accessCode: r.accessCode.trim() || undefined,
          message: globalComment.trim() || undefined,
          locale: resolveEmailLocaleCode(r.locale ?? defaultRecipientLocale),
        })),
        sequentialRouting,
        expirationDays: expirationDays ? parseInt(expirationDays) : undefined,
        reminderDays: reminderDays ? parseInt(reminderDays) : undefined,
      };

      // Add internal approval if enabled
      if (requireInternalApproval && internalApprovers.length > 0) {
        const validApprovers = internalApprovers.filter(a => a.email.trim() && a.name.trim());
        if (validApprovers.length > 0) {
          sendPayload.internalApproval = {
            approvers: validApprovers.map((a, i) => ({
              email: a.email.trim(),
              name: a.name.trim(),
              order: i + 1,
            })),
          };
        }
      }

      const result = await sendMutation.mutateAsync(sendPayload);

      setCurrentStep(5);
    } catch (err: any) {
      toast.error(err?.message || t("documents.create.sendError"));
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (currentStep === 1 && !createdDocId) {
      // Create draft
      if (!title.trim()) {
        toast.error(t("documents.create.validation.titleRequired"));
        return;
      }
      setIsSubmitting(true);
      try {
        let docId: number;
        if (isFromTemplate) {
          const result = await createFromTemplateMutation.mutateAsync({
            templateId: templateId!,
            title: title.trim(),
            description: description.trim() || undefined,
          });
          docId = result.id;
        } else {
          const result = await createMutation.mutateAsync({
            title: title.trim(),
            description: description.trim() || undefined,
          });
          docId = result.id;
          if (file) {
            const base64 = await fileToBase64(file);
            await uploadMutation.mutateAsync({
              documentId: docId,
              fileName: file.name,
              fileBase64: base64,
              mimeType: file.type || "application/pdf",
            });
          }
        }
        toast.success(t("documents.create.saveDraftSuccess"));
        navigate(`/dashboard/documents/${docId}`);
      } catch {
        toast.error(t("documents.create.saveDraftError"));
      } finally {
        setIsSubmitting(false);
      }
    } else if (createdDocId) {
      // Save fields if on step 3+
      if (signatureFields.length > 0) {
        try {
          await saveFieldsMutation.mutateAsync({
            documentId: createdDocId,
            fields: signatureFields.map(f => ({
              id: f.id,
              page: f.page,
              x: f.x,
              y: f.y,
              width: f.width,
              height: f.height,
              signerIndex: f.signerIndex,
              type: f.type,
            })),
          });
        } catch { /* ignore */ }
      }
      toast.success(t("documents.create.saveDraftSuccess"));
      navigate(`/dashboard/documents/${createdDocId}`);
    }
  };

  const handleCancel = () => {
    if (createdDocId) {
      navigate(`/dashboard/documents/${createdDocId}`);
    } else {
      navigate("/dashboard/documents");
    }
  };

  // PDF URL for viewer
  const pdfUrl = isFromTemplate ? template?.fileUrl : (createdDoc?.fileUrl || draftDoc?.fileUrl);

  // ==================== Render ====================

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                {t("common.back")}
              </Button>
              <span className="text-sm font-semibold text-gray-700">
                {String(currentStep).padStart(2, "0")} {getStepLabel(currentStep)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={isSubmitting}>
                <PenLine className="w-4 h-4 mr-1" />
                {t("documents.create.saveDraft")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCancel} className="text-red-600 border-red-200 hover:bg-red-50">
                {t("documents.create.cancelAndDelete")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Body: main content only (no sidebar) */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6">
          {/* Step indicator with labels */}
          <nav className="mb-8" aria-label={t("documents.create.stepNavAria")}>
            <div className="flex items-start justify-between max-w-xl mx-auto">
              {([1, 2, 3, 4, 5] as WizardStep[]).map((step, idx) => {
                const isActive = currentStep === step;
                const isCompleted = currentStep > step;
                const isAccessible = step <= currentStep;
                return (
                  <React.Fragment key={step}>
                    <button
                      onClick={() => isAccessible && step < currentStep && setCurrentStep(step)}
                      disabled={!isAccessible}
                      className="flex flex-col items-center gap-2 group w-20 shrink-0"
                      title={getStepLabel(step)}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                        isActive
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                          : isCompleted
                            ? "bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200 cursor-pointer"
                            : "bg-gray-100 text-gray-400 border border-gray-200"
                      }`}>
                        {isCompleted ? <Check className="w-4.5 h-4.5" /> : step}
                      </div>
                      <span className={`text-[11px] leading-tight font-medium text-center ${
                        isActive
                          ? "text-emerald-700"
                          : isCompleted
                            ? "text-emerald-600"
                            : "text-gray-400"
                      }`}>
                        {getStepLabel(step)}
                      </span>
                    </button>
                    {idx < 4 && (
                      <div className={`flex-1 h-0.5 mt-5 mx-0 ${
                        isCompleted ? "bg-emerald-300" : "bg-gray-200"
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </nav>

            {/* ==================== STEP 1 ==================== */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* Template banner */}
                {isFromTemplate && (
                  <Card className="border-emerald-200 bg-emerald-50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                          <Layers className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-emerald-900">{t("documents.create.fromTemplate")}</h3>
                          <p className="text-sm text-emerald-700 mt-1">
                            {t("documents.create.templateInherit", { title: template?.title })}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {template?.fileUrl && (
                              <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                                <FileText className="w-3 h-3 mr-1" />
                                {t("documents.create.templatePdfBadge", { count: template.pageCount || 0 })}
                              </Badge>
                            )}
                            {templateFields.length > 0 && (
                              <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                {t("documents.create.templateFieldsBadge", { count: templateFields.length })}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* PDF Upload area */}
                {!isFromTemplate && (
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-full max-w-2xl border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                        fileError
                          ? "border-red-400 bg-red-50"
                          : file
                            ? "border-green-400 bg-green-50"
                            : "border-gray-300 hover:border-emerald-600 hover:bg-emerald-50/30"
                      }`}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {file ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-24 h-32 bg-white rounded-lg border shadow-sm flex items-center justify-center">
                            <FileText className="w-10 h-10 text-green-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-green-800">{file.name}</p>
                            <p className="text-sm text-green-600 mt-1">
                              {(file.size / 1024 / 1024).toFixed(2)}
                            </p>
                          </div>
                          <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                            {t("documents.create.changeFile")}
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                            <Upload className="w-10 h-10 text-gray-400" />
                          </div>
                          <p className="text-lg font-semibold text-gray-700">{t("documents.create.uploadPdf")}</p>
                          <p className="text-sm text-gray-500 mt-2">{t("documents.create.dropHere")}</p>
                          <p className="text-sm text-gray-500">or</p>
                          <Button variant="outline" className="mt-2" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                            {t("documents.create.selectFile")}
                          </Button>
                          <p className="text-xs text-gray-400 mt-3">{t("documents.create.pdfOnly")}</p>
                        </>
                      )}
                    </div>
                    {fileError && (
                      <div className="flex items-center gap-2 mt-3 text-red-600 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {fileError}
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,application/pdf"
                      onChange={handleFileChange}
                    />
                  </div>
                )}

                {/* Title & Description */}
                {(file || isFromTemplate) && (
                  <Card>
                    <CardContent className="p-6 space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Label htmlFor="title">{t("common.title")}</Label>
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{t("documents.create.required")}</Badge>
                        </div>
                        <Input
                          id="title"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder={t("documents.create.titlePlaceholder")}
                          maxLength={500}
                        />
                        <p className="text-xs text-gray-400 mt-1">{t("documents.create.titleHint")}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Label htmlFor="counterparty">{t("documents.create.counterpartyLabel")}</Label>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{t("documents.create.optional")}</Badge>
                        </div>
                        <Input
                          id="counterparty"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder={t("documents.create.counterpartyPlaceholder")}
                          maxLength={2000}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Next button */}
                {(file || isFromTemplate) && (
                  <div className="flex justify-center">
                    <Button
                      onClick={() => goToStep(2)}
                      disabled={isSubmitting}
                      className="bg-emerald-600 hover:bg-emerald-700 px-12 py-6 text-base"
                    >
                      {isSubmitting ? t("common.creating") : t("common.next")}
                      <ChevronRight className="w-5 h-5 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ==================== STEP 2 ==================== */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-lg font-semibold mb-4">{t("documents.create.relatedParties")}</h2>

                    <div className="space-y-3">
                      {recipients.map((recipient, index) => (
                        <div key={index} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border">
                          {/* Order number / avatar */}
                          <div className="flex flex-col items-center gap-1 pt-1">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                              style={{ backgroundColor: ["#059669", "#dc2626", "#16a34a", "#ea580c", "#7c3aed", "#0891b2"][index % 6] }}
                            >
                              {index + 1}
                            </div>
                          </div>

                          <div className="flex-1 space-y-3">
                            {/* Row 1: Email + Name */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs text-gray-500">{t("documents.create.recipientEmailRequired")}</Label>
                                <Input
                                  value={recipient.email}
                                  onChange={(e) => updateRecipient(index, "email", e.target.value)}
                                  placeholder="example@company.com"
                                  type="email"
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-gray-500">{t("documents.create.recipientNameRequiredLabel")}</Label>
                                <Input
                                  value={recipient.name}
                                  onChange={(e) => updateRecipient(index, "name", e.target.value)}
                                  placeholder={t("documents.create.recipientNamePlaceholder")}
                                  className="mt-1"
                                />
                                <p className="text-[11px] text-gray-400 mt-1">
                                  {t('documents.create.honorificHint')}
                                </p>
                              </div>
                            </div>

                            {/* Row 2a: Company (full width) */}
                            <div>
                              <Label className="text-xs text-gray-500">{t("common.company")}</Label>
                              <Input
                                value={recipient.company}
                                onChange={(e) => updateRecipient(index, "company", e.target.value)}
                                placeholder={t("documents.create.companyPlaceholder")}
                                className="mt-1"
                              />
                            </div>

                            {/* Row 2b: Role + Language (2-column, matches Email+Name pattern) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs text-gray-500">{t("common.role")}</Label>
                                <Select value={recipient.role} onValueChange={(v) => updateRecipient(index, "role", v)}>
                                  <SelectTrigger className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="signer">{t("documents.create.roleSigner")}</SelectItem>
                                    <SelectItem value="cc">{t("documents.create.roleCc")}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs text-gray-500">{t("documents.create.recipientLocale")}</Label>
                                <Select value={recipient.locale} onValueChange={(v) => updateRecipient(index, "locale", v)}>
                                  <SelectTrigger className="mt-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60">
                                    {EMAIL_LOCALE_OPTIONS.map(opt => (
                                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Signer-only: access code */}
                            {recipient.role === "signer" && (
                              <div>
                                <Label className="text-xs text-gray-500">{t("documents.create.accessCodeOptional")}</Label>
                                <Input
                                  value={recipient.accessCode}
                                  onChange={(e) => updateRecipient(index, "accessCode", e.target.value)}
                                  placeholder={t("documents.create.accessCodePlaceholder")}
                                  type="password"
                                  className="mt-1 max-w-xs"
                                />
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-1 shrink-0 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3 gap-1.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 whitespace-nowrap"
                              onClick={() => openContactPicker(index)}
                              title={t("documents.create.selectFromContacts")}
                            >
                              <BookUser className="w-3.5 h-3.5" />
                              {t("documents.create.selectFromContacts")}
                            </Button>
                            {recipients.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => removeRecipient(index)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}

                      <Button variant="outline" onClick={addRecipient} className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        {t("documents.create.addRecipientCta")}
                      </Button>
                    </div>

                    {/* Options */}
                    <div className="mt-6 space-y-4 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                      <h4 className="text-sm font-semibold text-gray-700">{t("documents.create.sendOptions")}</h4>
                      {signerRecipients.length > 1 && (
                        <div className="flex items-center gap-3">
                          <Switch checked={sequentialRouting} onCheckedChange={setSequentialRouting} />
                          <div>
                            <p className="text-sm font-medium">{t("documents.create.sequentialRouting")}</p>
                            <p className="text-xs text-gray-500">{t("documents.create.sequentialRoutingHint")}</p>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">{t("documents.create.expirationDays")}</Label>
                          <Input
                            type="number"
                            min="1"
                            max="365"
                            value={expirationDays}
                            onChange={(e) => setExpirationDays(e.target.value)}
                            placeholder={t("documents.create.expirationPlaceholder")}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">{t("documents.create.reminderDays")}</Label>
                          <Input
                            type="number"
                            min="1"
                            max="30"
                            value={reminderDays}
                            onChange={(e) => setReminderDays(e.target.value)}
                            placeholder={t("documents.create.reminderPlaceholder")}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Social Internal Approval Flow */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg font-semibold">{t("documents.create.internalApproval.title")}</h2>
                        <p className="text-sm text-gray-500 mt-1">{t("documents.create.internalApproval.description")}</p>
                      </div>
                      <Switch
                        checked={requireInternalApproval}
                        onCheckedChange={setRequireInternalApproval}
                      />
                    </div>

                    {requireInternalApproval && (
                      <div className="space-y-3 mt-4 pt-4 border-t">
                        {internalApprovers.map((approver, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                            <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                              {idx + 1}
                            </div>
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Input
                                value={approver.email}
                                onChange={(e) => {
                                  const updated = [...internalApprovers];
                                  updated[idx] = { ...updated[idx], email: e.target.value };
                                  setInternalApprovers(updated);
                                }}
                                placeholder="approver@company.com"
                                type="email"
                                className="text-sm"
                              />
                              <Input
                                value={approver.name}
                                onChange={(e) => {
                                  const updated = [...internalApprovers];
                                  updated[idx] = { ...updated[idx], name: e.target.value };
                                  setInternalApprovers(updated);
                                }}
                                placeholder={t("documents.create.internalApproval.approverNamePlaceholder")}
                                className="text-sm"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setInternalApprovers(internalApprovers.filter((_, i) => i !== idx))}
                              className="text-red-500 hover:text-red-700 shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInternalApprovers([...internalApprovers, { email: "", name: "" }])}
                          className="w-full border-dashed border-amber-300 text-amber-700 hover:bg-amber-50"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {t("documents.create.internalApproval.addApprover")}
                        </Button>
                        <p className="text-xs text-gray-500">{t("documents.create.internalApproval.orderHint")}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex justify-center">
                  <Button
                    onClick={() => goToStep(3)}
                    className="bg-emerald-600 hover:bg-emerald-700 px-12 py-6 text-base"
                  >
                    {t("common.next")}
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                </div>

                {/* Contact Picker Overlay */}
                {showContactPicker && (
                  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowContactPicker(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                      <div className="p-4 border-b">
                        <h3 className="font-semibold text-lg">{t("documents.create.selectFromContacts")}</h3>
                        <div className="flex gap-2 mt-3">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                              value={contactSearch}
                              onChange={(e) => setContactSearch(e.target.value)}
                              placeholder={t("contacts.searchPlaceholder")}
                              className="pl-10"
                              autoFocus
                            />
                          </div>
                          <Select value={pickerGroupFilter} onValueChange={setPickerGroupFilter}>
                            <SelectTrigger className="w-[140px] shrink-0">
                              <SelectValue placeholder={t("contacts.allGroups")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">{t("contacts.allGroups")}</SelectItem>
                              {contactGroupsList?.map((g: any) => (
                                <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex-1 overflow-auto p-2">
                        {filteredContacts.length > 0 ? (
                          filteredContacts.map((c: any) => (
                            <button
                              key={c.id}
                              className="w-full text-left p-3 rounded-lg hover:bg-emerald-50 transition-colors flex items-center gap-3"
                              onClick={() => selectContact(c)}
                            >
                              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                <User className="w-5 h-5 text-gray-500" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm truncate">{c.name}</p>
                                  {c.company && <span className="text-xs text-gray-400 truncate shrink-0">({c.company})</span>}
                                </div>
                                <p className="text-xs text-gray-500 truncate">{c.email}</p>
                                {c.groups?.length > 0 && (
                                  <div className="flex gap-1 mt-0.5 flex-wrap">
                                    {c.groups.map((g: any) => (
                                      <span key={g.id} className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{g.name}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <BookUser className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">
                              {contactSearch ? t("contacts.noResults") : t("contacts.noContacts")}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="p-3 border-t">
                        <Button variant="outline" onClick={() => setShowContactPicker(false)} className="w-full">
                          {t("common.close")}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================== STEP 3 ==================== */}
            {currentStep === 3 && !(createdDoc?.fileUrl || pdfUrl) && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="relative">
                  <div className="animate-spin w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">{t("documents.create.preparingPdf")}</p>
                  <p className="text-xs text-gray-500 mt-1">{t("documents.create.preparingPdfHint")}</p>
                </div>
              </div>
            )}
            {currentStep === 3 && (createdDoc?.fileUrl || pdfUrl) && (
              <div className="space-y-4 max-w-5xl mx-auto">
                {/* Toolbar */}
                <SignatureFieldToolbar
                  selectedFieldType={selectedFieldType}
                  onFieldTypeChange={setSelectedFieldType}
                  selectedSigner={selectedSigner}
                  onSignerChange={setSelectedSigner}
                  signerCount={signerRecipients.length}
                  signerNames={signerRecipients.map(r => r.name || r.email)}
                />

                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-800">
                  {t("documents.create.fieldPlacementHint")}
                </div>

                {/* PDF with overlay */}
                <PdfViewer
                  url={(createdDoc?.fileUrl || pdfUrl)!}
                  className="border rounded-lg overflow-hidden"
                  overlayContent={(pageIndex: number) => (
                    <SignatureFieldPageOverlay
                      pageIndex={pageIndex}
                      fields={signatureFields}
                      onFieldsChange={setSignatureFields}
                      selectedFieldType={selectedFieldType}
                      selectedSigner={selectedSigner}
                      signerNames={signerRecipients.map(r => r.name || r.email)}
                    />
                  )}
                />

                {/* Field summary */}
                {signatureFields.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-3 border">
                    <h4 className="text-sm font-medium mb-2">{t("documents.create.placedFields", { count: signatureFields.length })}</h4>
                    <div className="flex flex-wrap gap-2">
                      {signatureFields.map(field => (
                        <Badge key={field.id} variant="outline" className="gap-1">
                          {field.type === "signature"
                            ? t("signing.fieldType.signature")
                            : field.type === "date"
                            ? t("signing.fieldType.date")
                            : field.type === "name"
                            ? t("signing.fieldType.name")
                            : t("signing.fieldType.initials")}
                          <span className="text-gray-400">-</span>
                          {signerRecipients[field.signerIndex]?.name || t("documents.create.signerIndex", { count: field.signerIndex + 1 })}
                          <button
                            onClick={() => setSignatureFields(signatureFields.filter(f => f.id !== field.id))}
                            className="ml-1 text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-center">
                  <Button
                    onClick={() => goToStep(4)}
                    className="bg-emerald-600 hover:bg-emerald-700 px-12 py-6 text-base"
                  >
                    {t("common.next")}
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* ==================== STEP 4 ==================== */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    {/* Document title */}
                    <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>

                    {/* PDF thumbnail */}
                    {(createdDoc?.fileUrl || pdfUrl) && (
                      <div className="flex justify-center mb-6">
                        <div className="w-48 h-64 bg-gray-100 rounded-lg border overflow-hidden flex items-center justify-center">
                          <FileText className="w-16 h-16 text-gray-300" />
                        </div>
                      </div>
                    )}

                    {/* Recipients summary */}
                    <h3 className="font-semibold text-gray-700 mb-3">{t("documents.create.relatedParties")}</h3>
                    <div className="space-y-2 mb-6">
                      {recipients.filter(r => r.email.trim()).map((r, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            {r.role === "signer" ? (
                              <CheckCircle className="w-4 h-4 text-blue-600" />
                            ) : (
                              <User className="w-4 h-4 text-gray-500" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{r.email}</p>
                            <p className="text-xs text-gray-500">{r.name} {r.company && `(${r.company})`}</p>
                          </div>
                          <span className="text-xs text-gray-500">
                            {r.role === "signer" ? t("documents.create.signerIndex", { count: i + 1 }) : t("documents.role.cc")}
                          </span>
                          <span className="text-xs text-gray-400 ml-1">
                            {EMAIL_LOCALE_OPTIONS.find(o => o.value === r.locale)?.label || r.locale}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Settings summary */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {expirationDays && (
                        <div>
                          <p className="text-gray-500">{t("documents.create.expirationDays")}</p>
                          <p className="font-medium">{t("documents.create.expirationValue", { count: Number(expirationDays) })}</p>
                        </div>
                      )}
                      {reminderDays && (
                        <div>
                          <p className="text-gray-500">{t("documents.create.reminderDays")}</p>
                          <p className="font-medium">{t("documents.create.reminderValue", { count: Number(reminderDays) })}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-500">{t("documents.create.signatureFieldsLabel")}</p>
                        <p className="font-medium">{t("documents.create.signatureFieldsValue", { count: signatureFields.length })}</p>
                      </div>
                      {sequentialRouting && (
                        <div>
                          <p className="text-gray-500">{t("documents.create.routingLabel")}</p>
                          <p className="font-medium">{t("documents.create.sequentialRouting")}</p>
                        </div>
                      )}
                    </div>

                    {/* Internal Approval Flow Summary */}
                    {requireInternalApproval && internalApprovers.length > 0 && (
                      <div className="mt-6 pt-4 border-t">
                        <h3 className="font-semibold text-amber-700 mb-3 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {t("documents.create.internalApproval.summaryTitle")}
                        </h3>
                        <div className="space-y-2">
                          {internalApprovers.filter(a => a.email.trim()).map((a, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 bg-amber-50 rounded-lg border border-amber-200">
                              <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold">
                                {i + 1}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium">{a.name}</p>
                                <p className="text-xs text-gray-500">{a.email}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-amber-600 mt-2">{t("documents.create.internalApproval.summaryHint")}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Global comment */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="w-4 h-4 text-gray-500" />
                      <Label className="font-semibold text-gray-700">{t('documents.create.globalComment')}</Label>
                    </div>
                    <Textarea
                      value={globalComment}
                      onChange={(e) => setGlobalComment(e.target.value)}
                      placeholder={t('documents.create.globalCommentPlaceholder')}
                      rows={3}
                      maxLength={1000}
                      className="resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">{globalComment.length}/1000</p>
                  </CardContent>
                </Card>

                {/* Preview & Send buttons */}
                <div className="flex flex-col sm:flex-row justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowEmailPreview(true)}
                    className="px-8 py-6 text-base"
                  >
                    <Eye className="w-5 h-5 mr-2" />
                    {t('documents.create.previewEmail')}
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={isSending}
                    className="bg-emerald-600 hover:bg-emerald-700 px-16 py-6 text-base"
                  >
                    {isSending ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        {t("common.loading")}
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        {t("common.submit")}
                      </>
                    )}
                  </Button>
                </div>

                {/* Email Preview Dialog */}
                <Dialog open={showEmailPreview} onOpenChange={setShowEmailPreview}>
                  <DialogContent className="w-[90vw] max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Eye className="w-5 h-5" />
                        {t('documents.create.emailPreviewTitle')}
                      </DialogTitle>
                      <DialogDescription>
                        {t('documents.create.previewEmailDesc')}
                      </DialogDescription>
                    </DialogHeader>

                    {/* Preview for first signer */}
                    {(() => {
                      const firstSigner = recipients.find(r => r.email.trim() && r.role === "signer");
                      if (!firstSigner) return null;
                      const senderName = user?.name || t("documents.create.senderFallback");
                      return (
                        <div className="space-y-4">
                          {/* Meta info */}
                          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                            <div className="flex gap-2">
                              <span className="font-medium text-gray-500 w-16 shrink-0">{t('documents.create.emailPreviewFrom')}</span>
                              <span className="text-gray-900">{senderName}</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="font-medium text-gray-500 w-16 shrink-0">{t('documents.create.emailPreviewTo')}</span>
                              <span className="text-gray-900">{firstSigner.name || firstSigner.email}</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="font-medium text-gray-500 w-16 shrink-0">{t('documents.create.emailPreviewSubject')}</span>
                              <span className="text-gray-900">{t("documents.create.emailSubjectPreview", { sender: senderName, title })}</span>
                            </div>
                          </div>

                          {/* Email body preview */}
                          <div className="border rounded-lg overflow-hidden">
                            <div className="bg-gray-100 p-3">
                              {/* Email header with logo */}
                              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                                <div className="p-4">
                                  <div className="mb-4 text-lg font-extrabold tracking-tight text-gray-950">
                                    Hundredth Sign
                                  </div>
                                </div>
                                {/* Header banner */}
                                <div className="bg-emerald-500 text-white text-center py-6 px-4 rounded-lg mx-4">
                                  <div className="text-3xl mb-2">📄</div>
                                  <p className="font-semibold">{t("documents.create.emailHeaderRequest", { sender: senderName })}</p>
                                  <p className="text-sm opacity-90 mt-1">{t("documents.create.emailHeaderRequestDesc", { title })}</p>
                                  <div className="mt-4 inline-block bg-amber-500 text-white font-bold px-8 py-3 rounded text-sm">
                                    {t("signing.reviewAndSign")}
                                  </div>
                                </div>

                                {/* Message block */}
                                {globalComment && (
                                  <div className="mx-4 mt-4 bg-gray-50 p-3 border-l-[3px] border-emerald-500 rounded">
                                    <p className="text-[11px] text-gray-400 font-semibold mb-1">{t("documents.create.messageFromSender")}</p>
                                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                                      {globalComment}
                                    </p>
                                  </div>
                                )}

                                {/* Document info */}
                                <div className="p-4 mt-2">
                                  <div className="border-t pt-3">
                                    <p className="text-xs text-gray-400">{t("documents.create.documentNameLabel", { title })}</p>
                                    <p className="text-xs text-gray-400 mt-1">{t("documents.create.senderLabel", { sender: senderName })}</p>
                                  </div>
                                </div>

                                <div className="mx-4 mb-4 rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">
                                  Powered by Hundredth Sign OSS
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowEmailPreview(false)}>
                        {t('documents.create.emailPreviewClose')}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* ==================== STEP 5 ==================== */}
            {currentStep === 5 && (
              <div className="flex flex-col items-center justify-center py-16">
                {requireInternalApproval && internalApprovers.length > 0 ? (
                  <>
                    <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mb-6">
                      <Clock className="w-10 h-10 text-amber-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("documents.create.complete.internalApprovalTitle")}</h2>
                    <p className="text-gray-500 mb-8">{t("documents.create.complete.internalApprovalDesc")}</p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
                      <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("documents.create.complete.sentTitle")}</h2>
                    <p className="text-gray-500 mb-8">{t("documents.create.complete.sentDesc")}</p>
                  </>
                )}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => navigate("/dashboard/documents")}>
                    {t("documents.backToList")}
                  </Button>
                  {createdDocId && (
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => navigate(`/dashboard/documents/${createdDocId}`)}
                    >
                      {t("documents.detail.documentInfo")}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}

// ==================== Helpers ====================

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
