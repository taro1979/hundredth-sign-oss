import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, FileText, AlertTriangle, Loader2, Lock,
  ChevronDown, ChevronUp, Send, ArrowDown, MoreHorizontal,
  Download, Shield, Users, Home, Clock, MessageSquare,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import PdfViewer from "@/components/PdfViewer";
import { resolveSignPageLocale } from "@shared/locales";
import SignaturePad from "@/components/SignaturePad";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "react-i18next";
import { formatLocaleDate } from "@/lib/locale";

export default function SignDocument() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { t, i18n } = useTranslation();

  // Determine language on mount: valid ?lng= URL param > browser language > "en"
  // localStorage is intentionally excluded for the sign page (each visit is fresh)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlLng = urlParams.get("lng") ?? undefined;
    const locale = resolveSignPageLocale(navigator.language || undefined, urlLng);
    i18n.changeLanguage(locale);
  }, [i18n]);

  // Consent state
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(true);

  // Signing state
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [fieldSignatures, setFieldSignatures] = useState<Record<string, {
    signatureDataUrl?: string;
    signatureFont?: string;
    stampDataUrl?: string;
    signerName: string;
  }>>({});

  // Email verification state (Bug 1 security fix)
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");

  // Stamp (hanko) state
  const [showStampDialog, setShowStampDialog] = useState(false);
  const [stampLastName, setStampLastName] = useState("");
  const [stampPreviewUrl, setStampPreviewUrl] = useState<string | null>(null);
  const [stampGenerating, setStampGenerating] = useState(false);

  // Decline/Delegate state
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [showDelegateDialog, setShowDelegateDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [delegateEmail, setDelegateEmail] = useState("");
  const [delegateName, setDelegateName] = useState("");

  // Result state
  const [signed, setSigned] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [delegated, setDelegated] = useState(false);

  // Access code
  const [accessCodeInput, setAccessCodeInput] = useState("");
  const [accessVerified, setAccessVerified] = useState(false);

  // Guide navigation
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const fieldRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const docPollCountRef = useRef(0);
  const { data, isLoading, error } = trpc.signature.getByToken.useQuery(
    { token: token || "" },
    {
      enabled: !!token,
      retry: false,
      refetchInterval: (query) => {
        // Poll while signed but waiting for other signers to complete
        if (signed && query.state.data?.document.status !== "completed") {
          docPollCountRef.current += 1;
          if (docPollCountRef.current > 40) return false; // stop after ~2 min
          return 3_000;
        }
        docPollCountRef.current = 0;
        return false;
      },
    }
  );

  const verifyAccessCodeMutation = trpc.signature.verifyAccessCode.useMutation({
    onSuccess: () => {
      setAccessVerified(true);
      toast.success(t("signing.accessVerified"));
    },
    onError: (err: { message: string }) => toast.error(t(err.message, { defaultValue: err.message })),
  });

  const utils = trpc.useUtils();

  const signMutation = trpc.signature.sign.useMutation({
    onSuccess: () => {
      setSigned(true);
      setShowSignaturePad(false);
      toast.success(t("signing.signatureComplete"));
      utils.signature.getByToken.invalidate({ token });
    },
    onError: (err: { message: string }) => {
      toast.error(t(err.message, { defaultValue: err.message }));
      // If already signed, navigate to document view (SPA navigation)
      if (err.message === "signing.errors.alreadySigned") {
        setTimeout(() => {
          navigate(`/document-view/${token}`);
        }, 1500);
      }
    },
  });

  const declineMutation = trpc.signature.decline.useMutation({
    onSuccess: () => {
      setDeclined(true);
      setShowDeclineDialog(false);
      toast.success(t("signing.declineSuccess"));
    },
    onError: (err: { message: string }) => toast.error(t(err.message, { defaultValue: err.message })),
  });

  const delegateMutation = trpc.signature.delegate.useMutation({
    onSuccess: () => {
      setDelegated(true);
      setShowDelegateDialog(false);
      toast.success(t("signing.delegateSuccess"));
    },
    onError: (err: { message: string }) => toast.error(t(err.message, { defaultValue: err.message })),
  });

  // Stamp generation mutation
  const generateStampMutation = trpc.signature.generateStamp.useMutation({
    onSuccess: (result) => {
      setStampPreviewUrl(result.dataUrl);
      setStampGenerating(false);
    },
    onError: (err: { message: string }) => {
      toast.error(t(err.message, { defaultValue: err.message }));
      setStampGenerating(false);
    },
  });

  const handleGenerateStamp = useCallback(() => {
    if (!stampLastName.trim()) {
      toast.error(t("signing.stamp.enterLastName"));
      return;
    }
    setStampGenerating(true);
    generateStampMutation.mutate({ name: stampLastName.trim() });
  }, [stampLastName, generateStampMutation]);

  const handleConfirmStamp = useCallback(() => {
    if (!activeFieldId || !stampPreviewUrl) return;
    setFieldSignatures(prev => ({
      ...prev,
      [activeFieldId]: {
        stampDataUrl: stampPreviewUrl,
        signerName: stampLastName,
      },
    }));
    setShowStampDialog(false);
    setStampPreviewUrl(null);
    setStampLastName('');
    setActiveFieldId(null);
    toast.success(t("signing.stamp.applied"));
  }, [activeFieldId, stampPreviewUrl, stampLastName, t]);

  // Unsigned fields for guide navigation
  const unsignedFields = useMemo(() => {
    if (!data) return [];
    return data.assignedFields.filter(f => !fieldSignatures[f.clientId || f.id?.toString()]);
  }, [data, fieldSignatures]);

  const totalFields = data?.assignedFields.length ?? 0;
  const signedFieldCount = totalFields - unsignedFields.length;
  const allFieldsSigned = totalFields > 0 && unsignedFields.length === 0;

  // Scroll to next unsigned field
  const scrollToNextField = useCallback(() => {
    if (unsignedFields.length === 0) return;
    const nextField = unsignedFields[0];
    const fieldKey = nextField.clientId || nextField.id?.toString();
    const el = fieldRefs.current.get(fieldKey);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Flash animation
      el.classList.add("ring-4", "ring-yellow-400");
      setTimeout(() => el.classList.remove("ring-4", "ring-yellow-400"), 1500);
    }
  }, [unsignedFields]);

  // Active field type for conditional UI
  const activeFieldType = useMemo(() => {
    if (!activeFieldId || !data) return 'signature';
    const field = data.assignedFields.find(f => (f.clientId || f.id?.toString()) === activeFieldId);
    return field?.type || 'signature';
  }, [activeFieldId, data]);

  // Handle field click to open appropriate input UI
  const handleFieldClick = useCallback((fieldId: string) => {
    if (!data) return;
    const field = data.assignedFields.find(f => (f.clientId || f.id?.toString()) === fieldId);
    const fieldType = field?.type || 'signature';

    if (fieldType === 'date') {
      // Auto-fill date field with today's date
      const today = formatLocaleDate(new Date(), i18n.language, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      setFieldSignatures(prev => ({
        ...prev,
        [fieldId]: {
          signatureFont: 'noto-sans-jp' as any,
          signerName: today,
        },
      }));
      toast.success(t("signing.fieldFilled.date"));
      return;
    }

    if (fieldType === 'name') {
      // Auto-fill name field with signer name
      const signerName = data.request.signerName || data.request.signerEmail;
      setFieldSignatures(prev => ({
        ...prev,
        [fieldId]: {
          signatureFont: 'noto-sans-jp' as any,
          signerName: signerName,
        },
      }));
      toast.success(t("signing.fieldFilled.name"));
      return;
    }

    if (fieldType === 'initials') {
      // Auto-fill initials field
      const signerName = data.request.signerName || data.request.signerEmail;
      // Extract initials: for Japanese names take first character, for Western names take first letters
      let initials = signerName;
      if (/[\u3000-\u9fff]/.test(signerName)) {
        // Japanese: take first character of each part
        const parts = signerName.split(/[\s\u3000]+/);
        initials = parts.map(p => p.charAt(0)).join('');
      } else {
        // Western: take first letter of each word
        const parts = signerName.split(/\s+/);
        initials = parts.map(p => p.charAt(0).toUpperCase()).join('');
      }
      setFieldSignatures(prev => ({
        ...prev,
        [fieldId]: {
          signatureFont: 'noto-sans-jp' as any,
          signerName: initials,
        },
      }));
      toast.success(t("signing.fieldFilled.initials"));
      return;
    }

    if (fieldType === 'stamp') {
      // Open stamp dialog: generate hanko from last name
      setActiveFieldId(fieldId);
      setShowStampDialog(true);
      return;
    }

    // For signature type, open SignaturePad
    setActiveFieldId(fieldId);
    setShowSignaturePad(true);
  }, [data, formatLocaleDate, i18n.language, t]);

  // Handle signature completion for a specific field
  const handleFieldSignature = useCallback((sigData: {
    signatureDataUrl?: string;
    signatureFont?: string;
    signerName: string;
  }) => {
    if (!activeFieldId) return;
    setFieldSignatures(prev => ({
      ...prev,
      [activeFieldId]: sigData,
    }));
    setShowSignaturePad(false);
    setActiveFieldId(null);
  }, [activeFieldId]);

  // Submit all signatures
  const handleSubmitAll = useCallback(() => {
    if (!allFieldsSigned || !data || !emailVerified) return;

    // Find the actual signature field's data (not date/name/initials which use 'noto-sans-jp')
    const signatureEntry = Object.values(fieldSignatures).find(
      s => s.signatureDataUrl || (s.signatureFont && s.signatureFont !== 'noto-sans-jp') || s.stampDataUrl
    );
    signMutation.mutate({
      token: token || "",
      signerEmail: emailInput,
      signatureDataUrl: signatureEntry?.signatureDataUrl || undefined,
      signatureFont: (signatureEntry?.signatureFont && signatureEntry.signatureFont !== 'noto-sans-jp')
        ? signatureEntry.signatureFont as any
        : undefined,
      stampDataUrl: signatureEntry?.stampDataUrl || undefined,
    });
  }, [allFieldsSigned, data, fieldSignatures, token, signMutation, emailVerified, emailInput]);

  // Prevent browser back button from returning to signing page after completion
  useEffect(() => {
    if (signed || declined || delegated) {
      window.history.pushState(null, '', window.location.href);
      const handlePopState = () => {
        window.history.pushState(null, '', window.location.href);
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [signed, declined, delegated]);

  // Already signed or declined 竊・SPA navigate to document view (avoids full-page reload)
  useEffect(() => {
    const status = data?.request?.status;
    if (status === "signed" || status === "declined") {
      navigate(`/document-view/${token}`);
    }
  }, [data?.request?.status, token, navigate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-600" />
          <p className="mt-4 text-gray-600">{t("signing.loadingDocument")}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{t("signing.accessDenied")}</h2>
            <p className="text-gray-600">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (signed) {
    const handleDownloadPdf = () => {
      window.location.href = `/document-view/${token}`;
    };

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="bg-white border-b">
          <div className="max-w-3xl mx-auto px-4 py-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-500">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("signing.signatureComplete")}</h1>
            <p className="text-gray-600 text-lg">
              {t("signing.successMessage", { title: data?.document.title })}
            </p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6 text-center">
                <Download className="h-8 w-8 text-emerald-600 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">{t("signing.quickActions.downloadTitle")}</h3>
                <p className="text-sm text-gray-500 mb-4">{t("signing.quickActions.downloadDesc")}</p>
                <Button variant="outline" className="w-full" onClick={handleDownloadPdf}>
                  <Download className="w-4 h-4 mr-2" />
                  {t("common.download")}
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6 text-center">
                <FileText className="h-8 w-8 text-emerald-600 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">{t("signing.quickActions.viewTitle")}</h3>
                <p className="text-sm text-gray-500 mb-4">{t("signing.quickActions.viewDesc")}</p>
                <Button variant="outline" className="w-full" onClick={() => window.location.href = `/document-view/${token}`}>
                  <FileText className="w-4 h-4 mr-2" />
                  {t("documents.detailView")}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="border-emerald-100 bg-emerald-50">
            <CardContent className="pt-6 text-sm text-emerald-800">
              この文書の閲覧、署名済みPDFの取得、辞退にはアカウント登録は不要です。
            </CardContent>
          </Card>

          {isAuthenticated && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-11 px-6"
                onClick={() => window.location.href = '/dashboard'}
              >
                <Home className="w-4 h-4" />
                {t("errors.goDashboard")}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Declined confirmation
  if (declined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">{t("signing.declineSuccess")}</h2>
            <p className="text-gray-600">
              {t("signing.declineMessage", { title: data?.document.title })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Delegated confirmation
  if (delegated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Send className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">{t("signing.delegateSuccess")}</h2>
            <p className="text-gray-600">
              {t("signing.delegateMessage", { title: data?.document.title, name: delegateName })}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { request, document: doc, assignedFields } = data;

  // Access code gate
  if (request.hasAccessCode && !accessVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Lock className="h-12 w-12 text-emerald-600 mx-auto mb-2" />
            <CardTitle>{t("signing.enterAccessCode")}</CardTitle>
            <CardDescription>
              {t("signing.accessCodeDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder={t("signing.enterAccessCode")}
              value={accessCodeInput}
              onChange={(e) => setAccessCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && accessCodeInput.trim()) {
                  verifyAccessCodeMutation.mutate({ token: token || "", accessCode: accessCodeInput.trim() });
                }
              }}
            />
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              disabled={!accessCodeInput.trim() || verifyAccessCodeMutation.isPending}
              onClick={() => {
                verifyAccessCodeMutation.mutate({ token: token || "", accessCode: accessCodeInput.trim() });
              }}
            >
              {verifyAccessCodeMutation.isPending ? t("signing.verifying") : t("common.confirm")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (request.status === "signed" || request.status === "declined") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // ==================== Consent Modal ====================
  if (showConsentModal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="w-14 h-14 bg-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-3">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-xl">{t("signing.consent.title")}</CardTitle>
            <CardDescription className="text-base mt-2">
              {t("signing.consent.description", { title: doc.title })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="bg-gray-50 border rounded-lg p-4 text-sm text-gray-700 space-y-3 max-h-48 overflow-y-auto">
              <p>{t("signing.consent.paragraph1")}</p>
              <p>{t("signing.consent.paragraph2")}</p>
              <p>{t("signing.consent.paragraph3")}</p>
            </div>

            <div className="flex items-start gap-3 p-3 border rounded-lg bg-white">
              <Checkbox
                id="consent"
                checked={consentAccepted}
                onCheckedChange={(checked) => setConsentAccepted(checked === true)}
                className="mt-0.5"
              />
              <label htmlFor="consent" className="text-sm cursor-pointer leading-relaxed">
                {t("signing.consent.checkbox")}
              </label>
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                disabled={!consentAccepted}
                onClick={() => setShowConsentModal(false)}
              >
                {t("signing.consent.agreeAndContinue")}
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50"
                onClick={() => setShowDeclineDialog(true)}
              >
                {t("signing.decline")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Decline Dialog (accessible from consent screen) */}
        <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("signing.declineDialog.title")}</DialogTitle>
              <DialogDescription>
                {t("signing.declineDialog.description")}
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder={t("signing.declineDialog.placeholder")}
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeclineDialog(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={!declineReason.trim() || declineMutation.isPending}
                onClick={() => {
                  declineMutation.mutate({
                    token: token || "",
                    reason: declineReason.trim(),
                  });
                }}
              >
                {declineMutation.isPending ? t("common.loading") : t("signing.declineDialog.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ==================== Email Verification Gate ====================
  if (!emailVerified) {
    const handleEmailVerify = () => {
      const trimmed = emailInput.trim().toLowerCase();
      if (!trimmed) {
        setEmailError(t("signing.emailVerification.enterEmailError"));
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setEmailError(t("signing.emailVerification.invalidEmailError"));
        return;
      }
      if (trimmed !== request.signerEmail.toLowerCase()) {
        setEmailError(t("signing.emailVerification.notAuthorizedError"));
        return;
      }
      setEmailError("");
      setEmailVerified(true);
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-14 h-14 bg-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-xl">{t("signing.emailVerification.title")}</CardTitle>
            <CardDescription className="text-base mt-2">
              {t("signing.emailVerification.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder={t("signing.emailVerification.placeholder")}
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setEmailError("");
                  setEmailVerified(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleEmailVerify();
                }}
                className={emailError ? "border-red-500" : ""}
              />
              {emailError && (
                <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {emailError}
                </p>
              )}
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={handleEmailVerify}
            >
              {t("signing.emailVerification.confirmAndStart")}
            </Button>
            <p className="text-xs text-gray-400 text-center">
              {t("signing.emailVerification.securityNote")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ==================== Main Signing View ====================
  const FIELD_TYPE_LABELS: Record<string, string> = {
    signature: t("signing.fieldType.signature"),
    date: t("signing.fieldType.date"),
    name: t("signing.fieldType.name"),
    initials: t("signing.fieldType.initials"),
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-lg truncate">{doc.title}</h1>
              <p className="text-xs text-gray-500 truncate">
                {request.signerName || request.signerEmail}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Message from sender popover */}
            {request.message && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <MessageSquare className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("signing.messageFromSender")}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700">{t("signing.messageFromSender")}</p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{request.message}</p>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {/* Options menu: decline & delegate */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("common.actions")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={() => setShowDeclineDialog(true)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {t("signing.decline")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDelegateDialog(true)}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {t("signing.delegate")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Submit button */}
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 gap-1"
              disabled={!allFieldsSigned || !emailVerified || signMutation.isPending}
              onClick={handleSubmitAll}
            >
              {signMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {signMutation.isPending ? t("common.loading") : t("signing.finishSigning")}
              </span>
              <span className="sm:hidden">
                {signMutation.isPending ? "..." : t("common.done")}
              </span>
            </Button>
          </div>
        </div>
      </header>

      {/* PDF Viewer with field overlays */}
      <div className="flex-1 relative">
        {doc.fileUrl && (
          <PdfViewer
            url={doc.fileUrl}
            className="h-full"
            overlayContent={(pageIndex: number) => (
              <>
                {assignedFields
                  .filter((f) => f.page === pageIndex)
                  .map((field) => {
                    const fieldKey = field.clientId || field.id?.toString();
                    const isSigned = !!fieldSignatures[fieldKey];
                    return (
                      <div
                        key={fieldKey}
                        ref={(el) => {
                          if (el) fieldRefs.current.set(fieldKey, el);
                        }}
                        className={`absolute rounded cursor-pointer transition-all duration-300 ${
                          isSigned
                            ? "border-2 border-green-500 bg-green-50/40"
                            : "border-2 border-emerald-600 bg-emerald-100/40 hover:bg-emerald-200/50 animate-pulse"
                        }`}
                        style={{
                          left: `${Number(field.xPercent)}%`,
                          top: `${Number(field.yPercent)}%`,
                          width: `${Number(field.widthPercent)}%`,
                          height: `${Number(field.heightPercent)}%`,
                        }}
                        onClick={() => !isSigned && handleFieldClick(fieldKey)}
                      >
                        {isSigned ? (
                          <div className="flex items-center justify-center h-full overflow-hidden px-1">
                            {(fieldSignatures[fieldKey]?.signatureDataUrl || fieldSignatures[fieldKey]?.stampDataUrl) ? (
                              <img
                                src={fieldSignatures[fieldKey].signatureDataUrl || fieldSignatures[fieldKey].stampDataUrl}
                                alt={t("signing.fieldType.signature")}
                                className="max-h-full max-w-full object-contain"
                              />
                            ) : (
                              <span className="text-xs text-green-700 font-medium truncate" style={{
                                fontFamily: fieldSignatures[fieldKey]?.signatureFont ? undefined : 'inherit',
                              }}>
                                {fieldSignatures[fieldKey]?.signerName || <CheckCircle2 className="h-4 w-4 text-green-600" />}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-xs text-emerald-600 font-medium">
                            {FIELD_TYPE_LABELS[field.type || "signature"] || t("signing.fieldType.signature")}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </>
            )}
          />
        )}
      </div>

      {/* Guide Navigation Bar (bottom) */}
      <div className="sticky bottom-0 bg-white border-t shadow-lg z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                allFieldsSigned ? "bg-green-100 text-green-700" : "bg-emerald-600/10 text-emerald-600"
              }`}>
                <>{signedFieldCount}/{totalFields}</>
              </div>
              <div className="text-sm">
                {allFieldsSigned ? (
                  <span className="text-green-700 font-medium">{t("signing.allFieldsComplete")}</span>
                ) : (
                  <span className="text-gray-700">
                    {t("signing.fieldsRemaining", { count: unsignedFields.length })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!allFieldsSigned && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1 border-emerald-600 text-emerald-600 hover:bg-emerald-600/5"
                onClick={scrollToNextField}
              >
                <ArrowDown className="h-4 w-4" />
                <span className="hidden sm:inline">{t("signing.nextField")}</span>
                <span className="sm:hidden">{t("common.next")}</span>
              </Button>
            )}
            {allFieldsSigned && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 gap-1"
                disabled={signMutation.isPending}
                onClick={handleSubmitAll}
              >
                {signMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {t("signing.finishSigning")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Signature Pad Dialog */}
      {showSignaturePad && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <SignaturePad
            signerName={request.signerName || request.signerEmail}
            onSignatureComplete={handleFieldSignature}
            onCancel={() => {
              setShowSignaturePad(false);
              setActiveFieldId(null);
            }}
          />
        </div>
      )}

      {/* Stamp (Hanko) Dialog */}
      <Dialog open={showStampDialog} onOpenChange={(open) => {
        setShowStampDialog(open);
        if (!open) {
          setActiveFieldId(null);
          setStampPreviewUrl(null);
          setStampLastName('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("signing.stamp.title")}</DialogTitle>
            <DialogDescription>
              {t("signing.stamp.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder={t("signing.stamp.placeholder")}
                value={stampLastName}
                onChange={(e) => setStampLastName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateStamp()}
                className="flex-1"
              />
              <Button
                onClick={handleGenerateStamp}
                disabled={stampGenerating || !stampLastName.trim()}
                variant="outline"
              >
                {stampGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : t("signing.stamp.generate")}
              </Button>
            </div>
            {stampPreviewUrl && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="bg-white border rounded-lg p-4">
                  <img
                    src={stampPreviewUrl}
                    alt={t("signing.stamp.previewAlt")}
                    className="w-24 h-24 object-contain"
                  />
                </div>
                <p className="text-sm text-gray-500">{t("signing.stamp.confirmQuestion")}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowStampDialog(false);
                setActiveFieldId(null);
                setStampPreviewUrl(null);
                setStampLastName('');
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleConfirmStamp}
              disabled={!stampPreviewUrl}
            >
              {t("signing.stamp.apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Dialog */}
      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("signing.declineDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("signing.declineDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder={t("signing.declineDialog.placeholder")}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeclineDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={!declineReason.trim() || declineMutation.isPending}
              onClick={() => {
                declineMutation.mutate({
                  token: token || "",
                  reason: declineReason.trim(),
                });
              }}
            >
              {declineMutation.isPending ? t("common.loading") : t("signing.declineDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delegate Dialog */}
      <Dialog open={showDelegateDialog} onOpenChange={setShowDelegateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("signing.delegateDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("signing.delegateDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">{t("signing.delegateDialog.nameLabel")}</label>
              <Input
                value={delegateName}
                onChange={(e) => setDelegateName(e.target.value)}
                placeholder={t("signing.delegateDialog.namePlaceholder")}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">{t("signing.delegateDialog.emailLabel")}</label>
              <Input
                type="email"
                value={delegateEmail}
                onChange={(e) => setDelegateEmail(e.target.value)}
                placeholder={t("signing.delegateDialog.emailPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelegateDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!delegateName.trim() || !delegateEmail.trim() || delegateMutation.isPending}
              onClick={() => {
                delegateMutation.mutate({
                  token: token || "",
                  delegateEmail: delegateEmail.trim(),
                  delegateName: delegateName.trim(),
                });
              }}
            >
              {delegateMutation.isPending ? t("common.loading") : t("signing.delegate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
