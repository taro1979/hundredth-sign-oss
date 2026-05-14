/**
 * Email notification service for Hundredth Sign
 * Uses AWS SES for production email delivery, with notification API fallback
 * Supports 20 languages with Hundredth Sign-style HTML email templates
 */
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import nodemailer from "nodemailer";
import { notifyOwner } from "./_core/notification";
import { getDb } from "./db";
import { emailLogs } from "../drizzle/schema";
import {
  type SupportedLanguage,
  type TranslationSet,
  TRANSLATIONS,
  isRtlLanguage,
  resolveEmailLocale,
} from "./emailTranslations";

// Re-export for consumers
export { type SupportedLanguage, resolveEmailLocale } from "./emailTranslations";

// AWS SES Configuration
const AWS_SES_ACCESS_KEY_ID = process.env.AWS_SES_ACCESS_KEY_ID;
const AWS_SES_SECRET_ACCESS_KEY = process.env.AWS_SES_SECRET_ACCESS_KEY;
const AWS_SES_REGION = process.env.AWS_SES_REGION || "ap-northeast-1";
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL || "Hundredth Sign <noreply@hundredthsign.com>";
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || "587");
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SES_FROM_EMAIL;

let sesClient: SESClient | null = null;
let smtpTransporter: nodemailer.Transporter | null = null;

function getSmtpTransporter(): nodemailer.Transporter | null {
  if (smtpTransporter) return smtpTransporter;
  if (!SMTP_HOST) return null;
  smtpTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number.isFinite(SMTP_PORT) ? SMTP_PORT : 587,
    secure: SMTP_SECURE,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  console.log(`[Email] SMTP transporter initialized (host: ${SMTP_HOST}, port: ${SMTP_PORT})`);
  return smtpTransporter;
}

function getSesClient(): SESClient | null {
  if (sesClient) return sesClient;
  if (AWS_SES_ACCESS_KEY_ID && AWS_SES_SECRET_ACCESS_KEY) {
    sesClient = new SESClient({
      region: AWS_SES_REGION,
      credentials: {
        accessKeyId: AWS_SES_ACCESS_KEY_ID,
        secretAccessKey: AWS_SES_SECRET_ACCESS_KEY,
      },
    });
    console.log(`[Email] AWS SES client initialized (region: ${AWS_SES_REGION})`);
    return sesClient;
  }
  return null;
}

type EmailType =
  | "signature_request"
  | "signature_complete"
  | "signature_declined"
  | "all_signed"
  | "document_voided"
  | "reminder"
  | "password_reset"
  | "staff_invitation";

interface SendEmailOptions {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  type: EmailType;
  documentId?: number;
  signatureRequestId?: number;
}

async function logEmail(opts: SendEmailOptions, status: "sent" | "failed") {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(emailLogs).values({
      toEmail: opts.to,
      toName: opts.toName ?? null,
      subject: opts.subject,
      type: opts.type,
      documentId: opts.documentId ?? null,
      signatureRequestId: opts.signatureRequestId ?? null,
      status,
    });
  } catch (e) {
    console.warn("[Email] Failed to log email:", e);
  }
}

export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  console.log(`[Email] sendEmail called: to=${opts.to}, subject=${opts.subject}, type=${opts.type}`);
  const smtp = getSmtpTransporter();
  console.log(`[Email] SMTP transport: ${smtp ? "available" : "not configured"}`);

  if (smtp) {
    try {
      const result = await smtp.sendMail({
        from: SMTP_FROM_EMAIL,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: stripHtml(opts.html),
      });
      console.log(`[Email] SMTP send success: MessageId=${result.messageId ?? "unknown"}`);
      await logEmail(opts, "sent");
      return true;
    } catch (e: any) {
      console.warn("[Email] SMTP send failed:", e?.message || e);
      await logEmail(opts, "failed");
      return false;
    }
  }

  const client = getSesClient();
  console.log(`[Email] AWS SES client: ${client ? "available" : "not configured, using notifyOwner fallback"}`);

  if (client) {
    try {
      const command = new SendEmailCommand({
        Source: SES_FROM_EMAIL,
        Destination: {
          ToAddresses: [opts.to],
        },
        Message: {
          Subject: {
            Data: opts.subject,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: opts.html,
              Charset: "UTF-8",
            },
          },
        },
      });

      const result = await client.send(command);
      console.log(`[Email] SES send success: MessageId=${result.MessageId}`);
      await logEmail(opts, "sent");
      return true;
    } catch (e: any) {
      console.warn("[Email] SES send failed:", e?.message || e);
      await logEmail(opts, "failed");
      // Don't fall through to notifyOwner on SES error - the email is configured but failed
      return false;
    }
  }

  // Fallback: use notification API to notify owner (when SES is not configured)
  try {
    const strippedContent = stripHtml(opts.html);
    console.log(`[Email] Sending via notifyOwner: title length=${opts.subject.length}, content length=${strippedContent.length}`);
    const success = await notifyOwner({
      title: `[Email] ${opts.subject}`,
      content: `Recipient: ${opts.toName || opts.to}\nEmail: ${opts.to}\n\n${strippedContent}`,
    });
    console.log(`[Email] notifyOwner result: ${success}`);
    await logEmail(opts, success ? "sent" : "failed");
    return success;
  } catch (e) {
    console.warn("[Email] Notification fallback failed:", e);
    await logEmail(opts, "failed");
    return false;
  }
}

export function buildPasswordResetEmail(params: {
  name?: string | null;
  resetUrl: string;
}): { subject: string; html: string } {
  const greeting = params.name ? escapeHtml(params.name) : "Hello";
  return {
    subject: "[Hundredth Sign] Password reset",
    html: `
      <p>${greeting}</p>
      <p>A password reset was requested for your Hundredth Sign staff account.</p>
      <p><a href="${escapeHtml(params.resetUrl)}">Reset your password</a></p>
      <p>This link expires in 1 hour. If you did not request it, you can ignore this email.</p>
    `,
  };
}

export function buildStaffInvitationEmail(params: {
  email: string;
  name?: string | null;
  temporaryPassword: string;
  loginUrl: string;
}): { subject: string; html: string } {
  const greeting = params.name ? escapeHtml(params.name) : escapeHtml(params.email);
  return {
    subject: "[Hundredth Sign] Staff account created",
    html: `
      <p>${greeting}</p>
      <p>Your Hundredth Sign staff account has been created.</p>
      <p>Login URL: <a href="${escapeHtml(params.loginUrl)}">${escapeHtml(params.loginUrl)}</a></p>
      <p>Email: ${escapeHtml(params.email)}</p>
      <p>Temporary password: <strong>${escapeHtml(params.temporaryPassword)}</strong></p>
      <p>Please sign in and change your password.</p>
    `,
  };
}
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<hr[^>]*>/gi, "\n---\n")
    .replace(/<table[^>]*>[\s\S]*?<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>[\s\S]*?<\/table>/gi, "\n\n> $2\n$1\n")
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi, "$2 ( $1 )")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n /g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 2000);
}

// ==================== TRANSLATION HELPERS ====================

function getTranslation(lang?: SupportedLanguage): TranslationSet {
  return TRANSLATIONS[lang || "ja"] || TRANSLATIONS.ja;
}

function getInternalApprovalTranslation(lang?: SupportedLanguage) {
  const t = getTranslation(lang);
  return t.internalApproval ?? TRANSLATIONS.en.internalApproval!;
}

/** Escape user-supplied strings for safe HTML embedding */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ==================== HUNDREDTH-SIGN-STYLE HTML EMAIL LAYOUT ====================

function hundredthSignEmailLayout(rawParams: {
  headerColor: string;
  iconSvg: string;
  mainContent: string;
  senderName: string;
  senderEmail?: string;
  recipientName: string;
  documentTitle: string;
  lang?: SupportedLanguage;
  origin?: string;
  bodyRows?: string;
}): string {
  // Escape user-supplied strings to prevent HTML injection
  const params = {
    ...rawParams,
    senderName: escapeHtml(rawParams.senderName),
    recipientName: escapeHtml(rawParams.recipientName),
    documentTitle: escapeHtml(rawParams.documentTitle),
    senderEmail: rawParams.senderEmail ? escapeHtml(rawParams.senderEmail) : undefined,
  };
  const t = getTranslation(params.lang);
  const rtl = isRtlLanguage(params.lang);
  const dir = rtl ? 'dir="rtl"' : '';
  const textAlign = rtl ? 'text-align:right;' : '';
  return `<!DOCTYPE html>
<html ${dir}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;${textAlign}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Logo -->
          <tr>
            <td style="padding:24px 32px 16px;${textAlign}">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:20px;font-weight:800;color:#111827;letter-spacing:0;">Hundredth Sign</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Header Banner -->
          <tr>
            <td style="padding:0 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${params.headerColor};border-radius:8px;text-align:center;">
                <tr>
                  <td style="padding:40px 24px;">
                    ${params.iconSvg}
                    <p style="color:#ffffff;font-size:16px;line-height:1.5;margin:16px 0 0;font-weight:500;">
                      ${params.mainContent}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Sender Info -->
          <tr>
            <td style="padding:24px 32px 8px;${textAlign}">
              <p style="margin:0;font-size:14px;font-weight:600;color:#1a1a2e;">${params.senderName}</p>
              ${params.senderEmail ? `<p style="margin:4px 0 0;font-size:13px;color:#4C00FF;"><a href="mailto:${params.senderEmail}" style="color:#4C00FF;text-decoration:none;">${params.senderEmail}</a></p>` : ""}
            </td>
          </tr>
          ${params.bodyRows ? params.bodyRows : `
          <!-- Recipient greeting -->
          <tr>
            <td style="padding:16px 32px 8px;${textAlign}">
              <p style="margin:0;font-size:14px;color:#333;">${t.greeting(params.recipientName)}</p>
            </td>
          </tr>
          <!-- Complete with -->
          <tr>
            <td style="padding:8px 32px;${textAlign}">
              <p style="margin:0;font-size:14px;color:#555;line-height:1.6;">
                ${t.completeWith(params.documentTitle)}
              </p>
            </td>
          </tr>
          <!-- Thank you -->
          <tr>
            <td style="padding:16px 32px 32px;${textAlign}">
              <p style="margin:0;font-size:14px;color:#555;">
                ${t.thankYou(params.recipientName)}
              </p>
            </td>
          </tr>`}
          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:1px solid #e5e5e5;margin:0;">
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;${textAlign}">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:16px;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#333;">${t.footer.doNotShare}</p>
                    <p style="margin:0;font-size:11px;color:#777;line-height:1.6;">${t.footer.doNotShareBody}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:16px;border-top:1px solid #f0f0f0;padding-top:16px;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#333;">${t.footer.aboutHundredthSign}</p>
                    <p style="margin:0;font-size:11px;color:#777;line-height:1.6;">${t.footer.aboutHundredthSignBody}</p>
                  </td>
                </tr>
                <tr>
                  <td style="border-top:1px solid #f0f0f0;padding-top:16px;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#333;">${t.footer.questions}</p>
                    <p style="margin:0;font-size:11px;color:#777;line-height:1.6;">${t.footer.questionsBody}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function iconBadge(label: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="width:64px;height:64px;text-align:center;vertical-align:middle;background-color:rgba(255,255,255,0.22);border-radius:50%;">
  <span style="font-size:24px;font-weight:800;color:#ffffff;line-height:64px;">${label}</span>
</td></tr></table>`;
}

const ICON_DOCUMENT = iconBadge("DOC");
const ICON_CHECK = iconBadge("OK");
const ICON_PARTY = iconBadge("PDF");
const ICON_DECLINED = iconBadge("NO");
const ICON_REMINDER = iconBadge("!");

function buttonHtml(text: string, url: string, color: string = "#D4A017"): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:16px auto 0;"><tr><td style="background-color:${color};border-radius:4px;padding:12px 32px;text-align:center;">
    <a href="${url}" style="color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:0.5px;display:inline-block;">${text}</a>
  </td></tr></table>`;
}

// ==================== PUBLIC EMAIL BUILDERS ====================

export function buildSignatureRequestEmail(params: {
  signerName: string;
  senderName: string;
  senderEmail?: string;
  documentTitle: string;
  message?: string;
  signUrl: string;
  lang?: SupportedLanguage;
}): { subject: string; html: string } {
  const t = getTranslation(params.lang);
  const subject = t.signatureRequest.subject(params.senderName, params.documentTitle);

  const mainContent = `
    <span style="display:block;margin-bottom:8px;">${t.signatureRequest.heading(params.senderName)}</span>
    <span style="display:block;font-size:14px;opacity:0.9;margin-bottom:4px;">${t.signatureRequest.body(params.documentTitle)}</span>
    ${buttonHtml(t.signatureRequest.button, params.signUrl)}`;

  const rtl = isRtlLanguage(params.lang);
  const messageBlock = params.message
    ? `<tr><td style="padding:0 32px 16px;${rtl ? "text-align:right;" : ""}">
        <div style="background:#f9f9f9;padding:12px 16px;border-${rtl ? "right" : "left"}:3px solid #4C00FF;border-radius:4px;" dir="${rtl ? "rtl" : "ltr"}">
          <p style="margin:0 0 4px;font-size:11px;color:#999;font-weight:600;">${t.signatureRequest.messagePreamble}</p>
          <p style="margin:0;font-size:13px;color:#555;line-height:1.5;">${escapeHtml(params.message).replace(/\n/g, "<br>")}</p>
        </div>
      </td></tr>`
    : "";

  let html = hundredthSignEmailLayout({
    headerColor: "#10B981",
    iconSvg: ICON_DOCUMENT,
    mainContent,
    senderName: params.senderName,
    senderEmail: params.senderEmail,
    recipientName: params.signerName,
    documentTitle: params.documentTitle,
    lang: params.lang,
  });

  // Insert message block before the divider
  if (messageBlock) {
    html = html.replace("<!-- Divider -->", `${messageBlock}\n          <!-- Divider -->`);
  }

  return { subject, html };
}

export function buildSignatureCompleteEmail(params: {
  senderName: string;
  signerName: string;
  documentTitle: string;
  dashboardUrl: string;
  lang?: SupportedLanguage;
}): { subject: string; html: string } {
  const t = getTranslation(params.lang);
  const subject = t.signatureComplete.subject(params.signerName, params.documentTitle);

  const mainContent = `${t.signatureComplete.body(params.signerName, params.documentTitle)}
    ${buttonHtml(t.signatureComplete.button, params.dashboardUrl, "#4C00FF")}`;

  const html = hundredthSignEmailLayout({
    headerColor: "#4C00FF",
    iconSvg: ICON_CHECK,
    mainContent,
    senderName: params.signerName,
    recipientName: params.senderName,
    documentTitle: params.documentTitle,
    lang: params.lang,
  });

  return { subject, html };
}

export function buildAllSignedEmail(params: {
  senderName: string;
  documentTitle: string;
  downloadUrl: string;
  lang?: SupportedLanguage;
}): { subject: string; html: string } {
  const t = getTranslation(params.lang);
  const subject = t.allSigned.subject(params.documentTitle);

  const mainContent = `${t.allSigned.body(params.documentTitle)}
    ${buttonHtml(t.allSigned.button, params.downloadUrl, "#16a34a")}`;

  const html = hundredthSignEmailLayout({
    headerColor: "#16a34a",
    iconSvg: ICON_PARTY,
    mainContent,
    senderName: "Hundredth Sign",
    recipientName: params.senderName,
    documentTitle: params.documentTitle,
    lang: params.lang,
  });

  return { subject, html };
}

export function buildDeclinedEmail(params: {
  senderName: string;
  signerName: string;
  documentTitle: string;
  reason?: string;
  dashboardUrl: string;
  lang?: SupportedLanguage;
}): { subject: string; html: string } {
  const t = getTranslation(params.lang);
  const subject = t.declined.subject(params.signerName, params.documentTitle);

  const mainContent = `${t.declined.body(params.signerName, params.documentTitle)}
    ${buttonHtml(t.declined.button, params.dashboardUrl, "#4C00FF")}`;

  let html = hundredthSignEmailLayout({
    headerColor: "#dc2626",
    iconSvg: ICON_DECLINED,
    mainContent,
    senderName: params.signerName,
    recipientName: params.senderName,
    documentTitle: params.documentTitle,
    lang: params.lang,
  });

  if (params.reason) {
    const rtlDeclined = isRtlLanguage(params.lang);
    const reasonBlock = `<tr><td style="padding:0 32px 16px;${rtlDeclined ? "text-align:right;" : ""}">
      <div style="background:#fef2f2;padding:12px 16px;border-${rtlDeclined ? "right" : "left"}:3px solid #dc2626;border-radius:4px;" dir="${rtlDeclined ? "rtl" : "ltr"}">
        <p style="margin:0 0 4px;font-size:11px;color:#999;font-weight:600;">${t.declined.reasonLabel}</p>
        <p style="margin:0;font-size:13px;color:#555;line-height:1.5;">${escapeHtml(params.reason).replace(/\n/g, "<br>")}</p>
      </div>
    </td></tr>`;
    html = html.replace("<!-- Divider -->", `${reasonBlock}\n          <!-- Divider -->`);
  }

  return { subject, html };
}

export function buildReminderEmail(params: {
  signerName: string;
  senderName: string;
  documentTitle: string;
  signUrl: string;
  lang?: SupportedLanguage;
}): { subject: string; html: string } {
  const t = getTranslation(params.lang);
  const subject = t.reminder.subject(params.documentTitle);

  const mainContent = `${t.reminder.body(params.documentTitle)}
    ${buttonHtml(t.reminder.button, params.signUrl)}`;

  const html = hundredthSignEmailLayout({
    headerColor: "#ea580c",
    iconSvg: ICON_REMINDER,
    mainContent,
    senderName: params.senderName,
    recipientName: params.signerName,
    documentTitle: params.documentTitle,
    lang: params.lang,
  });

  return { subject, html };
}


/**
 * Build CC notification email for when a document is sent for signature.
 * CC recipients get a notification that they've been added as CC, not the "all signed" template.
 */
export function buildCcNotificationEmail(params: {
  ccName: string;
  senderName: string;
  documentTitle: string;
  dashboardUrl: string;
  lang?: SupportedLanguage;
}): { subject: string; html: string } {
  const t = getTranslation(params.lang);
  const subject = `[${t.ccNotification.subjectPrefix}] ${escapeHtml(params.documentTitle)}`;

  const mainContent = `
    <span style="display:block;margin-bottom:8px;">${t.ccNotification.body(escapeHtml(params.senderName), escapeHtml(params.documentTitle))}</span>
    ${buttonHtml(t.ccNotification.button, params.dashboardUrl, "#6366f1")}`;

  const html = hundredthSignEmailLayout({
    headerColor: "#6366f1",
    iconSvg: ICON_DOCUMENT,
    mainContent,
    senderName: params.senderName,
    recipientName: params.ccName,
    documentTitle: params.documentTitle,
    lang: params.lang,
  });

  return { subject, html };
}

/**
 * Build internal approval request email
 */
export function buildInternalApprovalEmail(params: {
  approverName: string;
  senderName: string;
  documentTitle: string;
  approveUrl: string;
  lang?: SupportedLanguage;
}): { subject: string; html: string } {
  const t = getInternalApprovalTranslation(params.lang);
  const mainContent = `
    <span style="display:block;margin-bottom:8px;">${escapeHtml(t.heading(params.senderName))}</span>
    <span style="display:block;font-size:14px;opacity:0.9;margin-bottom:4px;">${escapeHtml(t.body(params.documentTitle))}</span>
    ${buttonHtml(t.button, params.approveUrl, "#D97706")}`;

  const html = hundredthSignEmailLayout({
    headerColor: "#D97706",
    iconSvg: ICON_DOCUMENT,
    mainContent,
    senderName: params.senderName,
    recipientName: params.approverName,
    documentTitle: params.documentTitle,
    lang: params.lang,
  });

  return { subject: t.subject(params.documentTitle), html };
}
