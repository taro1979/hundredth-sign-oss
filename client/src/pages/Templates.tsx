import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Trash2, MoreHorizontal, Search, Upload, Settings, ArrowLeft, Save, CheckCircle2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { validatePdfFile } from "@shared/validation";
import PdfViewer from "@/components/PdfViewer";
import {
  SignatureFieldToolbar,
  SignatureFieldPageOverlay,
  type SignatureField,
  type SignatureFieldType,
} from "@/components/SignatureFieldEditor";
import { getDateFnsLocale, getDateFormat } from "@/lib/locale";

type TemplateView = "list" | "edit";

export default function Templates() {
  const { t, i18n } = useTranslation();

  const activeDateLocale = getDateFnsLocale(i18n.language);
  const activeDateFormat = getDateFormat(i18n.language, "dateShort");

  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", signerCount: 1 });
  const [view, setView] = useState<TemplateView>("list");
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();

  // Signature field editor state
  const [fields, setFields] = useState<SignatureField[]>([]);
  const [selectedFieldType, setSelectedFieldType] = useState<SignatureFieldType>("signature");
  const [selectedSigner, setSelectedSigner] = useState(0);
  const [signerCount, setSignerCount] = useState(1);

  const { data: templates, isLoading } = trpc.templates.list.useQuery();
  const { data: editingTemplate, isLoading: templateLoading } = trpc.templates.getById.useQuery(
    { id: editingTemplateId! },
    { enabled: !!editingTemplateId },
  );
  const utils = trpc.useUtils();

  // When template data loads, populate fields from templateFields
  useEffect(() => {
    if (editingTemplate) {
      const tplFields = (editingTemplate as any).templateFields || [];
      if (tplFields.length > 0) {
        setFields(tplFields.map((f: any) => ({
          id: f.clientId || `tf-${f.id}`,
          page: f.page,
          x: Number(f.xPercent),
          y: Number(f.yPercent),
          width: Number(f.widthPercent),
          height: Number(f.heightPercent),
          signerIndex: f.signerIndex,
          type: f.type as SignatureFieldType,
          required: f.required ?? true,
          label: f.label ?? undefined,
        })));
      } else {
        setFields([]);
      }
      setSignerCount(editingTemplate.signerCount || 1);
    }
  }, [editingTemplate]);

  const createMutation = trpc.templates.create.useMutation({
    onSuccess: (data) => {
      toast.success(t("templates.createSuccess"));
      setDialogOpen(false);
      setForm({ title: "", description: "", signerCount: 1 });
      utils.templates.list.invalidate();
      setEditingTemplateId(data.id);
      setView("edit");
    },
    onError: (err) => toast.error(t(err.message, { defaultValue: t("templates.createError") })),
  });

  const uploadPdfMutation = trpc.templates.uploadPdf.useMutation({
    onSuccess: (data) => {
      toast.success(t("templates.uploadSuccess", { pageCount: data.pageCount }));
      setUploading(false);
      utils.templates.getById.invalidate({ id: editingTemplateId! });
    },
    onError: (err) => {
      toast.error(t(err.message, { defaultValue: t("templates.uploadError") }));
      setUploading(false);
    },
  });

  const [showSaveSuccessDialog, setShowSaveSuccessDialog] = useState(false);

  const updateFieldsMutation = trpc.templates.saveFields.useMutation({
    onSuccess: () => {
      utils.templates.getById.invalidate({ id: editingTemplateId! });
      utils.templates.list.invalidate();
      setShowSaveSuccessDialog(true);
    },
    onError: (err: any) => toast.error(t(err.message, { defaultValue: t("templates.saveError") })),
  });

  const deleteMutation = trpc.templates.delete.useMutation({
    onSuccess: () => {
      toast.success(t("templates.deleteSuccess"));
      utils.templates.list.invalidate();
    },
    onError: () => toast.error(t("templates.deleteError")),
  });

  const handleCreate = () => {
    if (!form.title.trim()) {
      toast.error(t("templates.titleRequired"));
      return;
    }
    createMutation.mutate({
      title: form.title,
      description: form.description,
      signerCount: form.signerCount,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTemplateId) return;

    const validation = validatePdfFile({ name: file.name, size: file.size, type: file.type });
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadPdfMutation.mutate({
        templateId: editingTemplateId,
        fileName: file.name,
        fileBase64: base64,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSaveFields = () => {
    if (!editingTemplateId) return;
    updateFieldsMutation.mutate({
      templateId: editingTemplateId,
      fields: fields.map(f => ({
        id: f.id,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        signerIndex: f.signerIndex,
        type: f.type,
        label: f.label,
      })),
      signerCount,
    });
  };

  const filteredTemplates = templates?.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ==================== EDIT VIEW ====================
  if (view === "edit" && editingTemplateId) {
    return (
      <>
      <div className="min-h-[calc(100vh-64px)] bg-gray-50">
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => { setView("list"); setEditingTemplateId(null); setFields([]); }}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {editingTemplate?.title || t("templates.editTemplate")}
                  </h1>
                  <p className="text-sm text-gray-500">{t("templates.editDescription")}</p>
                </div>
              </div>
              {editingTemplate?.fileUrl && (
                <Button
                  onClick={handleSaveFields}
                  disabled={updateFieldsMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateFieldsMutation.isPending ? t("templates.savingFields") : t("templates.saveFields", { count: fields.length })}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {templateLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Step 1: Upload PDF */}
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">1</span>
                    {t("templates.uploadPdf")}
                  </h2>
                  {editingTemplate?.fileUrl ? (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-green-600">
                        <FileText className="w-5 h-5" />
                        <span className="font-medium">{editingTemplate.fileName || t("templates.uploadPdf")}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-4 h-4 mr-2" />
                        {t("templates.replacePdf")}
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-400 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                      <p className="text-gray-600 font-medium">{t("templates.uploadPdf")}</p>
                      <p className="text-sm text-gray-400 mt-1">{t("documents.create.pdfOnly")}</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  {uploading && (
                    <div className="flex items-center gap-2 mt-3 text-emerald-600">
                      <div className="animate-spin w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full" />
                      <span className="text-sm">{t("templates.uploading")}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Step 2: Place signature fields */}
              {editingTemplate?.fileUrl && (
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">2</span>
                      {t("templates.placeFields")}
                    </h2>

                    {/* Toolbar */}
                    <div className="mb-4">
                      <SignatureFieldToolbar
                        selectedFieldType={selectedFieldType}
                        onFieldTypeChange={setSelectedFieldType}
                        selectedSigner={selectedSigner}
                        onSignerChange={setSelectedSigner}
                        signerCount={signerCount}
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm font-medium text-gray-700">{t("templates.signerCountLabel")}</span>
                        <Input
                          type="number"
                          min={1}
                          max={20}
                          value={signerCount}
                          onChange={(e) => {
                            const v = Math.max(1, Math.min(20, parseInt(e.target.value) || 1));
                            setSignerCount(v);
                            if (selectedSigner >= v) setSelectedSigner(v - 1);
                          }}
                          className="w-16 h-8"
                        />
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 mb-3">{t("templates.pdfFieldInstruction")}</p>

                    {/* PDF Viewer with overlay */}
                    <PdfViewer
                      url={editingTemplate.fileUrl}
                      className="border rounded-lg overflow-hidden"
                      overlayContent={(pageIndex: number) => (
                        <SignatureFieldPageOverlay
                          pageIndex={pageIndex}
                          fields={fields}
                          onFieldsChange={setFields}
                          selectedFieldType={selectedFieldType}
                          selectedSigner={selectedSigner}
                        />
                      )}
                    />

                    {/* Field Summary */}
                    {fields.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3 border mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium">{t("templates.placedFields", { count: fields.length })}</h4>
                          <Button
                            onClick={handleSaveFields}
                            disabled={updateFieldsMutation.isPending}
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <Save className="w-3 h-3 mr-1" />
                            {t("templates.save")}
                          </Button>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {fields.map(field => (
                            <div key={field.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ["#059669", "#dc2626", "#16a34a", "#ea580c", "#7c3aed", "#0891b2"][field.signerIndex % 6] }} />
                                <span>{field.type === "signature" ? t("signing.signHere") : field.type === "date" ? t("signing.dateHere") : field.type === "name" ? t("signing.nameHere") : t("signing.initialHere")}</span>
                                <span className="text-gray-500">- {t("documents.role.signer")}{field.signerIndex + 1}</span>
                                <span className="text-gray-400">#{field.page + 1}</span>
                              </div>
                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setFields(fields.filter(f => f.id !== field.id))}>
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save Success Dialog */}
      <Dialog open={showSaveSuccessDialog} onOpenChange={setShowSaveSuccessDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader className="text-center">
            <div className="flex justify-center mb-3">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <DialogTitle className="text-center">{t("templates.saveSuccessDialog")}</DialogTitle>
            <DialogDescription className="text-center">
              {t("templates.saveSuccessDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setShowSaveSuccessDialog(false);
                setView("list");
                setEditingTemplateId(null);
              }}
            >
              {t("templates.backToList")}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowSaveSuccessDialog(false)}
            >
              {t("templates.continueEditing")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
    );
  }

  // ==================== LIST VIEW ====================
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{t("nav.templates")}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{t("templates.noTemplatesDesc")}</p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" />
                  {t("templates.new")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("templates.createNew")}</DialogTitle>
                  <DialogDescription className="sr-only">
                    {t("templates.noTemplatesDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>{t("templates.titleLabel")}</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("common.title")} />
                  </div>
                  <div>
                    <Label>{t("templates.descriptionLabel")}</Label>
                    <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t("common.description")} rows={3} />
                  </div>
                  <div>
                    <Label>{t("templates.signerCount")}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={form.signerCount}
                      onChange={(e) => setForm({ ...form, signerCount: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)) })}
                    />
                  </div>
                  <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    {t("templates.createAndEdit")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder={t("templates.searchPlaceholder")} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6"><div className="h-24 bg-gray-200 rounded" /></CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTemplates && filteredTemplates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{template.title}</h3>
                        {template.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{template.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {template.fileUrl ? (
                            <Badge variant="outline" className="text-green-600 border-green-300">{t("templates.uploadPdf")}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 border-orange-300">{t("templates.uploadPdf")}</Badge>
                          )}
                          <span className="text-xs text-gray-400">
                            {format(new Date(template.updatedAt), activeDateFormat, { locale: activeDateLocale })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingTemplateId(template.id); setView("edit"); }}>
                          <Settings className="w-4 h-4 mr-2" />
                          {t("common.edit")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setLocation(`/dashboard/documents/new?templateId=${template.id}`)}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          {t("templates.useTemplate")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => {
                            if (confirm(t("templates.deleteConfirm"))) {
                              deleteMutation.mutate({ id: template.id });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t("templates.noTemplates")}</h3>
              <p className="text-gray-500 mb-6">{t("templates.noTemplatesDesc")}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
