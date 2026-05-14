/**
 * Email translations for 20 languages
 * Separated from email.ts for maintainability
 */
import {
  isRtlLocale,
  resolveEmailLocaleCode,
  type EmailLocale as SupportedLanguage,
} from "@shared/locales";

export type { SupportedLanguage };

export interface TranslationSet {
  signatureRequest: {
    subject: (sender: string, docTitle: string) => string;
    heading: (sender: string) => string;
    body: (docTitle: string) => string;
    button: string;
    messagePreamble: string;
  };
  signatureComplete: {
    subject: (signer: string, docTitle: string) => string;
    heading: string;
    body: (signer: string, docTitle: string) => string;
    button: string;
  };
  allSigned: {
    subject: (docTitle: string) => string;
    heading: string;
    body: (docTitle: string) => string;
    button: string;
  };
  declined: {
    subject: (signer: string, docTitle: string) => string;
    heading: string;
    body: (signer: string, docTitle: string) => string;
    reasonLabel: string;
    button: string;
  };
  reminder: {
    subject: (docTitle: string) => string;
    heading: string;
    body: (docTitle: string) => string;
    button: string;
  };
  internalApproval?: {
    subject: (docTitle: string) => string;
    heading: (sender: string) => string;
    body: (docTitle: string) => string;
    button: string;
  };
  footer: {
    doNotShare: string;
    doNotShareBody: string;
    aboutHundredthSign: string;
    aboutHundredthSignBody: string;
    questions: string;
    questionsBody: string;
  };
  greeting: (name: string) => string;
  completeWith: (docTitle: string) => string;
  thankYou: (name: string) => string;
  ccNotification: {
    subjectPrefix: string;
    body: (senderName: string, docTitle: string) => string;
    button: string;
  };
  plgBanner: {
    headline: string;
    subtext: string;
    cta: string;
  };
  invitation: {
    subject: (orgName: string) => string;
    heading: string;
    body: (inviterName: string, orgName: string) => string;
    expiry: (date: string) => string;
    button: string;
    ignore: string;
  };
}

export function isRtlLanguage(lang?: SupportedLanguage): boolean {
  return !!lang && isRtlLocale(lang);
}

/**
 * Map frontend locale codes to email SupportedLanguage.
 * Frontend uses "zh-CN", "zh-TW" etc. Legacy "zh" maps to "zh-CN".
 */
export function resolveEmailLocale(locale?: string | null): SupportedLanguage {
  return resolveEmailLocaleCode(locale);
}

export const TRANSLATIONS: Record<SupportedLanguage, TranslationSet> = {
  // ==================== Japanese ====================
  ja: {
    signatureRequest: {
      subject: (sender, docTitle) => `\u3010\u7F72\u540D\u4F9D\u983C\u3011${sender}\u3055\u3093\u304B\u3089\u300C${docTitle}\u300D\u306E\u7F72\u540D\u4F9D\u983C`,
      heading: (sender) => `${sender}\u3055\u3093\u304B\u3089\u6587\u66F8\u306E\u78BA\u8A8D\u30FB\u7F72\u540D\u4F9D\u983C\u304C\u5C4A\u3044\u3066\u3044\u307E\u3059\u3002`,
      body: (docTitle) => `\u6587\u66F8\u300C${docTitle}\u300D\u306E\u78BA\u8A8D\u3068\u7F72\u540D\u3092\u304A\u9858\u3044\u3057\u307E\u3059\u3002`,
      button: "\u6587\u66F8\u3092\u78BA\u8A8D\u3059\u308B",
      messagePreamble: "\u9001\u4FE1\u8005\u304B\u3089\u306E\u30E1\u30C3\u30BB\u30FC\u30B8:",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `\u3010\u7F72\u540D\u5B8C\u4E86\u3011${signer}\u3055\u3093\u304C\u300C${docTitle}\u300D\u306B\u7F72\u540D\u3057\u307E\u3057\u305F`,
      heading: "\u7F72\u540D\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F",
      body: (signer, docTitle) => `${signer}\u3055\u3093\u304C\u300C${docTitle}\u300D\u306B\u7F72\u540D\u3057\u307E\u3057\u305F\u3002`,
      button: "\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u3067\u78BA\u8A8D",
    },
    allSigned: {
      subject: (docTitle) => `\u3010\u5168\u54E1\u7F72\u540D\u5B8C\u4E86\u3011\u300C${docTitle}\u300D\u306E\u7F72\u540D\u304C\u5168\u3066\u5B8C\u4E86\u3057\u307E\u3057\u305F`,
      heading: "\u5168\u3066\u306E\u7F72\u540D\u304C\u5B8C\u4E86\u3057\u307E\u3057\u305F",
      body: (docTitle) => `\u300C${docTitle}\u300D\u306E\u5168\u7F72\u540D\u8005\u304C\u7F72\u540D\u3092\u5B8C\u4E86\u3057\u307E\u3057\u305F\u3002\u7F72\u540D\u6E08\u307FPDF\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9\u3067\u304D\u307E\u3059\u3002`,
      button: "\u7F72\u540D\u6E08\u307FPDF\u3092\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9",
    },
    declined: {
      subject: (signer, docTitle) => `\u3010\u7F72\u540D\u62D2\u5426\u3011${signer}\u3055\u3093\u304C\u300C${docTitle}\u300D\u306E\u7F72\u540D\u3092\u62D2\u5426\u3057\u307E\u3057\u305F`,
      heading: "\u7F72\u540D\u304C\u62D2\u5426\u3055\u308C\u307E\u3057\u305F",
      body: (signer, docTitle) => `${signer}\u3055\u3093\u304C\u300C${docTitle}\u300D\u306E\u7F72\u540D\u3092\u62D2\u5426\u3057\u307E\u3057\u305F\u3002`,
      reasonLabel: "\u62D2\u5426\u7406\u7531",
      button: "\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u3067\u78BA\u8A8D",
    },
    reminder: {
      subject: (docTitle) => `\u3010\u30EA\u30DE\u30A4\u30F3\u30C0\u30FC\u3011\u300C${docTitle}\u300D\u306E\u7F72\u540D\u3092\u304A\u5F85\u3061\u3057\u3066\u3044\u307E\u3059`,
      heading: "\u7F72\u540D\u306E\u30EA\u30DE\u30A4\u30F3\u30C0\u30FC",
      body: (docTitle) => `\u300C${docTitle}\u300D\u306F\u307E\u3060\u7F72\u540D\u3092\u304A\u5F85\u3061\u3057\u3066\u3044\u307E\u3059\u3002\u304A\u65E9\u3081\u306B\u3054\u5BFE\u5FDC\u304F\u3060\u3055\u3044\u3002`,
      button: "\u6587\u66F8\u3092\u78BA\u8A8D\u3059\u308B",
    },
    internalApproval: {
      subject: (docTitle) => `\u3010\u793E\u5185\u627F\u8A8D\u4F9D\u983C\u3011${docTitle}`,
      heading: (sender) => `${sender}\u3055\u3093\u304B\u3089\u793E\u5185\u627F\u8A8D\u4F9D\u983C\u304C\u5C4A\u3044\u3066\u3044\u307E\u3059\u3002`,
      body: (docTitle) => `\u9001\u4FE1\u524D\u306B\u300C${docTitle}\u300D\u3092\u78BA\u8A8D\u3057\u3001\u627F\u8A8D\u307E\u305F\u306F\u5374\u4E0B\u3057\u3066\u304F\u3060\u3055\u3044\u3002`,
      button: "\u627F\u8A8D\u30DA\u30FC\u30B8\u3092\u958B\u304F",
    },
    footer: {
      doNotShare: "\u3053\u306E\u30E1\u30FC\u30EB\u3092\u5171\u6709\u3057\u306A\u3044\u3067\u304F\u3060\u3055\u3044",
      doNotShareBody: "\u3053\u306E\u30E1\u30FC\u30EB\u306B\u306FHundredth Sign\u3078\u306E\u30BB\u30AD\u30E5\u30A2\u30EA\u30F3\u30AF\u304C\u542B\u307E\u308C\u3066\u3044\u307E\u3059\u3002\u3053\u306E\u30E1\u30FC\u30EB\u3001\u30EA\u30F3\u30AF\u3001\u307E\u305F\u306F\u30A2\u30AF\u30BB\u30B9\u30B3\u30FC\u30C9\u3092\u4ED6\u306E\u4EBA\u3068\u5171\u6709\u3057\u306A\u3044\u3067\u304F\u3060\u3055\u3044\u3002",
      aboutHundredthSign: "Hundredth Sign\u306B\u3064\u3044\u3066",
      aboutHundredthSignBody: "\u6570\u5206\u3067\u96FB\u5B50\u7F72\u540D\u304C\u5B8C\u4E86\u3057\u307E\u3059\u3002\u5B89\u5168\u30FB\u5B89\u5FC3\u3067\u6CD5\u7684\u62D8\u675F\u529B\u304C\u3042\u308A\u307E\u3059\u3002",
      questions: "\u6587\u66F8\u306B\u3064\u3044\u3066\u8CEA\u554F\u304C\u3042\u308A\u307E\u3059\u304B\uFF1F",
      questionsBody: "\u6587\u66F8\u306E\u4FEE\u6B63\u304C\u5FC5\u8981\u306A\u5834\u5408\u3084\u8CEA\u554F\u304C\u3042\u308B\u5834\u5408\u306F\u3001\u9001\u4FE1\u8005\u306B\u76F4\u63A5\u30E1\u30FC\u30EB\u3067\u304A\u554F\u3044\u5408\u308F\u305B\u304F\u3060\u3055\u3044\u3002",
    },
    greeting: (name) => `${name}様`,
    completeWith: (docTitle) => `Hundredth Sign\u3067\u5B8C\u4E86: ${docTitle}`,
    thankYou: (name) => `${name}\u69D8\u3001\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059`,
    ccNotification: {
      subjectPrefix: "\u5199\u3057\u901A\u77E5",
      body: (senderName, docTitle) => `${senderName}\u3055\u3093\u304C\u300C${docTitle}\u300D\u306E\u7F72\u540D\u4F9D\u983C\u3092\u9001\u4FE1\u3057\u307E\u3057\u305F\u3002\u3042\u306A\u305F\u306FCC\u3068\u3057\u3066\u8FFD\u52A0\u3055\u308C\u3066\u3044\u307E\u3059\u3002\u7F72\u540D\u304C\u5B8C\u4E86\u3059\u308B\u3068\u901A\u77E5\u3055\u308C\u307E\u3059\u3002`,
      button: "\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9\u3092\u958B\u304F",
    },
    plgBanner: {
      headline: "契約業務を、もっとスマートに。",
      subtext: "電子署名・契約管理をオールインワンで。チーム何人でも定額。無料で始められます。",
      cta: "無料で試してみる →",
    },
    invitation: {
      subject: (orgName) => `【Hundredth Sign】${orgName}への招待`,
      heading: "チームへの招待",
      body: (inviterName, orgName) => `${inviterName}さんから${orgName}への参加招待が届いています。`,
      expiry: (date) => `この招待は${date}まで有効です。`,
      button: "招待を承認する",
      ignore: "このメールに心当たりがない場合は無視してください。",
    },
  },

  // ==================== English ====================
  en: {
    signatureRequest: {
      subject: (sender, docTitle) => `Hundredth Sign: ${docTitle}`,
      heading: (sender) => `${sender} sent you a document to review and sign.`,
      body: (docTitle) => `Please review and sign the document "${docTitle}".`,
      button: "REVIEW DOCUMENT",
      messagePreamble: "Message from sender:",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `Signature Complete: ${signer} signed "${docTitle}"`,
      heading: "Signature Completed",
      body: (signer, docTitle) => `${signer} has signed "${docTitle}".`,
      button: "View Dashboard",
    },
    allSigned: {
      subject: (docTitle) => `All Signatures Complete: "${docTitle}"`,
      heading: "All Signatures Complete",
      body: (docTitle) => `All signers have completed signing "${docTitle}". You can now download the signed PDF.`,
      button: "Download Signed PDF",
    },
    declined: {
      subject: (signer, docTitle) => `Signature Declined: ${signer} declined "${docTitle}"`,
      heading: "Signature Declined",
      body: (signer, docTitle) => `${signer} has declined to sign "${docTitle}".`,
      reasonLabel: "Reason",
      button: "View Dashboard",
    },
    reminder: {
      subject: (docTitle) => `Reminder: "${docTitle}" is awaiting your signature`,
      heading: "Signature Reminder",
      body: (docTitle) => `"${docTitle}" is still awaiting your signature. Please sign at your earliest convenience.`,
      button: "REVIEW DOCUMENT",
    },
    internalApproval: {
      subject: (docTitle) => `Internal approval requested: ${docTitle}`,
      heading: (sender) => `${sender} requested internal approval.`,
      body: (docTitle) => `Please review "${docTitle}" before it is sent.`,
      button: "Open approval page",
    },
    footer: {
      doNotShare: "Do Not Share This Email",
      doNotShareBody: "This email contains a secure link to Hundredth Sign. Please do not share this email, link, or access code with others.",
      aboutHundredthSign: "About Hundredth Sign",
      aboutHundredthSignBody: "Sign documents electronically in just minutes. It's safe, secure, and legally binding.",
      questions: "Questions about the Document?",
      questionsBody: "If you need to modify the document or have questions about the content, please reach out to the sender by emailing them directly.",
    },
    greeting: (name) => `Dear ${name},`,
    completeWith: (docTitle) => `Complete with Hundredth Sign: ${docTitle}`,
    thankYou: (name) => `Thank You, ${name}`,
    ccNotification: {
      subjectPrefix: "CC",
      body: (senderName, docTitle) => `${senderName} has sent "${docTitle}" for signature. You have been added as a CC recipient and will be notified when all signatures are complete.`,
      button: "Open Dashboard",
    },
    plgBanner: {
      headline: "Smarter contracts, faster deals.",
      subtext: "All-in-one e-signature & contract management. Flat rate for your whole team. Start free.",
      cta: "Try it free →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign: Invitation to join ${orgName}`,
      heading: "Team Invitation",
      body: (inviterName, orgName) => `${inviterName} has invited you to join ${orgName} on Hundredth Sign.`,
      expiry: (date) => `This invitation expires on ${date}.`,
      button: "Accept Invitation",
      ignore: "If you didn't expect this, you can safely ignore this email.",
    },
  },

  // ==================== Simplified Chinese ====================
  "zh-CN": {
    signatureRequest: {
      subject: (sender, docTitle) => `\u3010\u7B7E\u7F72\u8BF7\u6C42\u3011${sender}\u53D1\u9001\u4E86\u201C${docTitle}\u201D\u7684\u7B7E\u7F72\u8BF7\u6C42`,
      heading: (sender) => `${sender}\u5411\u60A8\u53D1\u9001\u4E86\u4E00\u4EFD\u9700\u8981\u5BA1\u9605\u548C\u7B7E\u7F72\u7684\u6587\u4EF6\u3002`,
      body: (docTitle) => `\u8BF7\u5BA1\u9605\u5E76\u7B7E\u7F72\u6587\u4EF6\u201C${docTitle}\u201D\u3002`,
      button: "\u67E5\u770B\u6587\u4EF6",
      messagePreamble: "\u53D1\u9001\u8005\u7559\u8A00\uFF1A",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `\u3010\u7B7E\u7F72\u5B8C\u6210\u3011${signer}\u5DF2\u7B7E\u7F72\u201C${docTitle}\u201D`,
      heading: "\u7B7E\u7F72\u5DF2\u5B8C\u6210",
      body: (signer, docTitle) => `${signer}\u5DF2\u7B7E\u7F72\u201C${docTitle}\u201D\u3002`,
      button: "\u67E5\u770B\u4EEA\u8868\u677F",
    },
    allSigned: {
      subject: (docTitle) => `\u3010\u5168\u90E8\u7B7E\u7F72\u5B8C\u6210\u3011\u201C${docTitle}\u201D\u7684\u6240\u6709\u7B7E\u7F72\u5DF2\u5B8C\u6210`,
      heading: "\u6240\u6709\u7B7E\u7F72\u5DF2\u5B8C\u6210",
      body: (docTitle) => `\u201C${docTitle}\u201D\u7684\u6240\u6709\u7B7E\u7F72\u8005\u5DF2\u5B8C\u6210\u7B7E\u7F72\u3002\u60A8\u73B0\u5728\u53EF\u4EE5\u4E0B\u8F7D\u5DF2\u7B7E\u7F72\u7684PDF\u3002`,
      button: "\u4E0B\u8F7D\u5DF2\u7B7E\u7F72PDF",
    },
    declined: {
      subject: (signer, docTitle) => `\u3010\u7B7E\u7F72\u62D2\u7EDD\u3011${signer}\u62D2\u7EDD\u7B7E\u7F72\u201C${docTitle}\u201D`,
      heading: "\u7B7E\u7F72\u88AB\u62D2\u7EDD",
      body: (signer, docTitle) => `${signer}\u62D2\u7EDD\u7B7E\u7F72\u201C${docTitle}\u201D\u3002`,
      reasonLabel: "\u62D2\u7EDD\u539F\u56E0",
      button: "\u67E5\u770B\u4EEA\u8868\u677F",
    },
    reminder: {
      subject: (docTitle) => `\u3010\u63D0\u9192\u3011\u201C${docTitle}\u201D\u7B49\u5F85\u60A8\u7684\u7B7E\u7F72`,
      heading: "\u7B7E\u7F72\u63D0\u9192",
      body: (docTitle) => `\u201C${docTitle}\u201D\u4ECD\u5728\u7B49\u5F85\u60A8\u7684\u7B7E\u7F72\u3002\u8BF7\u5C3D\u5FEB\u5904\u7406\u3002`,
      button: "\u67E5\u770B\u6587\u4EF6",
    },
    internalApproval: {
      subject: (docTitle) => `\u3010\u5185\u90E8\u5BA1\u6279\u8BF7\u6C42\u3011${docTitle}`,
      heading: (sender) => `${sender}\u8BF7\u6C42\u5185\u90E8\u5BA1\u6279\u3002`,
      body: (docTitle) => `\u8BF7\u5728\u53D1\u9001\u524D\u5BA1\u9605\u201C${docTitle}\u201D\u3002`,
      button: "\u6253\u5F00\u5BA1\u6279\u9875\u9762",
    },
    footer: {
      doNotShare: "\u8BF7\u52FF\u5206\u4EAB\u6B64\u90AE\u4EF6",
      doNotShareBody: "\u6B64\u90AE\u4EF6\u5305\u542BHundredth Sign\u7684\u5B89\u5168\u94FE\u63A5\u3002\u8BF7\u52FF\u4E0E\u4ED6\u4EBA\u5206\u4EAB\u6B64\u90AE\u4EF6\u3001\u94FE\u63A5\u6216\u8BBF\u95EE\u4EE3\u7801\u3002",
      aboutHundredthSign: "\u5173\u4E8EHundredth Sign",
      aboutHundredthSignBody: "\u51E0\u5206\u949F\u5185\u5373\u53EF\u7535\u5B50\u7B7E\u7F72\u6587\u4EF6\u3002\u5B89\u5168\u3001\u53EF\u9760\u4E14\u5177\u6709\u6CD5\u5F8B\u7EA6\u675F\u529B\u3002",
      questions: "\u5173\u4E8E\u6587\u4EF6\u7684\u95EE\u9898\uFF1F",
      questionsBody: "\u5982\u9700\u4FEE\u6539\u6587\u4EF6\u6216\u6709\u4EFB\u4F55\u95EE\u9898\uFF0C\u8BF7\u76F4\u63A5\u901A\u8FC7\u90AE\u4EF6\u8054\u7CFB\u53D1\u9001\u8005\u3002",
    },
    greeting: (name) => `${name}\uFF0C\u60A8\u597D`,
    completeWith: (docTitle) => `\u901A\u8FC7Hundredth Sign\u5B8C\u6210: ${docTitle}`,
    thankYou: (name) => `\u8C22\u8C22\uFF0C${name}`,
    ccNotification: {
      subjectPrefix: "\u6284\u9001\u901A\u77E5",
      body: (senderName, docTitle) => `${senderName}\u5DF2\u53D1\u9001\u201C${docTitle}\u201D\u7B7E\u7F72\u8BF7\u6C42\u3002\u60A8\u5DF2\u88AB\u6DFB\u52A0\u4E3ACC\u6536\u4EF6\u4EBA\uFF0C\u6240\u6709\u7B7E\u7F72\u5B8C\u6210\u540E\u5C06\u6536\u5230\u901A\u77E5\u3002`,
      button: "\u67E5\u770B\u4EEA\u8868\u677F",
    },
    plgBanner: {
      headline: "更智能的合同管理",
      subtext: "一站式电子签名和合同管理。免费开始，加速您的业务。",
      cta: "免费试用 →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign：加入${orgName}的邀请`,
      heading: "团队邀请",
      body: (inviterName, orgName) => `${inviterName}邀请您加入${orgName}（Hundredth Sign）。`,
      expiry: (date) => `此邀请将于${date}过期。`,
      button: "接受邀请",
      ignore: "如果您没有预期此邀请，请忽略此邮件。",
    },
  },

  // ==================== Traditional Chinese ====================
  "zh-TW": {
    signatureRequest: {
      subject: (sender, docTitle) => `\u3010\u7C3D\u7F72\u8ACB\u6C42\u3011${sender}\u767C\u9001\u4E86\u300C${docTitle}\u300D\u7684\u7C3D\u7F72\u8ACB\u6C42`,
      heading: (sender) => `${sender}\u5411\u60A8\u767C\u9001\u4E86\u4E00\u4EFD\u9700\u8981\u5BE9\u95B1\u548C\u7C3D\u7F72\u7684\u6587\u4EF6\u3002`,
      body: (docTitle) => `\u8ACB\u5BE9\u95B1\u4E26\u7C3D\u7F72\u6587\u4EF6\u300C${docTitle}\u300D\u3002`,
      button: "\u67E5\u770B\u6587\u4EF6",
      messagePreamble: "\u767C\u9001\u8005\u7559\u8A00\uFF1A",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `\u3010\u7C3D\u7F72\u5B8C\u6210\u3011${signer}\u5DF2\u7C3D\u7F72\u300C${docTitle}\u300D`,
      heading: "\u7C3D\u7F72\u5DF2\u5B8C\u6210",
      body: (signer, docTitle) => `${signer}\u5DF2\u7C3D\u7F72\u300C${docTitle}\u300D\u3002`,
      button: "\u67E5\u770B\u5100\u8868\u677F",
    },
    allSigned: {
      subject: (docTitle) => `\u3010\u5168\u90E8\u7C3D\u7F72\u5B8C\u6210\u3011\u300C${docTitle}\u300D\u7684\u6240\u6709\u7C3D\u7F72\u5DF2\u5B8C\u6210`,
      heading: "\u6240\u6709\u7C3D\u7F72\u5DF2\u5B8C\u6210",
      body: (docTitle) => `\u300C${docTitle}\u300D\u7684\u6240\u6709\u7C3D\u7F72\u8005\u5DF2\u5B8C\u6210\u7C3D\u7F72\u3002\u60A8\u73FE\u5728\u53EF\u4EE5\u4E0B\u8F09\u5DF2\u7C3D\u7F72\u7684PDF\u3002`,
      button: "\u4E0B\u8F09\u5DF2\u7C3D\u7F72PDF",
    },
    declined: {
      subject: (signer, docTitle) => `\u3010\u7C3D\u7F72\u62D2\u7D55\u3011${signer}\u62D2\u7D55\u7C3D\u7F72\u300C${docTitle}\u300D`,
      heading: "\u7C3D\u7F72\u88AB\u62D2\u7D55",
      body: (signer, docTitle) => `${signer}\u62D2\u7D55\u7C3D\u7F72\u300C${docTitle}\u300D\u3002`,
      reasonLabel: "\u62D2\u7D55\u539F\u56E0",
      button: "\u67E5\u770B\u5100\u8868\u677F",
    },
    reminder: {
      subject: (docTitle) => `\u3010\u63D0\u9192\u3011\u300C${docTitle}\u300D\u7B49\u5F85\u60A8\u7684\u7C3D\u7F72`,
      heading: "\u7C3D\u7F72\u63D0\u9192",
      body: (docTitle) => `\u300C${docTitle}\u300D\u4ECD\u5728\u7B49\u5F85\u60A8\u7684\u7C3D\u7F72\u3002\u8ACB\u5118\u5FEB\u8655\u7406\u3002`,
      button: "\u67E5\u770B\u6587\u4EF6",
    },
    footer: {
      doNotShare: "\u8ACB\u52FF\u5206\u4EAB\u6B64\u90F5\u4EF6",
      doNotShareBody: "\u6B64\u90F5\u4EF6\u5305\u542BHundredth Sign\u7684\u5B89\u5168\u9023\u7D50\u3002\u8ACB\u52FF\u8207\u4ED6\u4EBA\u5206\u4EAB\u6B64\u90F5\u4EF6\u3001\u9023\u7D50\u6216\u5B58\u53D6\u4EE3\u78BC\u3002",
      aboutHundredthSign: "\u95DC\u65BCHundredth Sign",
      aboutHundredthSignBody: "\u5E7E\u5206\u9418\u5167\u5373\u53EF\u96FB\u5B50\u7C3D\u7F72\u6587\u4EF6\u3002\u5B89\u5168\u3001\u53EF\u9760\u4E14\u5177\u6709\u6CD5\u5F8B\u7D04\u675F\u529B\u3002",
      questions: "\u95DC\u65BC\u6587\u4EF6\u7684\u554F\u984C\uFF1F",
      questionsBody: "\u5982\u9700\u4FEE\u6539\u6587\u4EF6\u6216\u6709\u4EFB\u4F55\u554F\u984C\uFF0C\u8ACB\u76F4\u63A5\u901A\u904E\u90F5\u4EF6\u806F\u7E6B\u767C\u9001\u8005\u3002",
    },
    greeting: (name) => `${name}\uFF0C\u60A8\u597D`,
    completeWith: (docTitle) => `\u900F\u904EHundredth Sign\u5B8C\u6210: ${docTitle}`,
    thankYou: (name) => `\u8B1D\u8B1D\uFF0C${name}`,
    ccNotification: {
      subjectPrefix: "\u526F\u672C\u901A\u77E5",
      body: (senderName, docTitle) => `${senderName}\u5DF2\u767C\u9001\u300C${docTitle}\u300D\u7C3D\u7F72\u8ACB\u6C42\u3002\u60A8\u5DF2\u88AB\u6DFB\u52A0\u70BACC\u6536\u4EF6\u4EBA\uFF0C\u6240\u6709\u7C3D\u7F72\u5B8C\u6210\u5F8C\u5C07\u6536\u5230\u901A\u77E5\u3002`,
      button: "\u67E5\u770B\u5100\u8868\u677F",
    },
    plgBanner: {
      headline: "更智慧的合約管理",
      subtext: "一站式電子簽名和合約管理。免費開始，加速您的業務。",
      cta: "免費試用 →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign：加入${orgName}的邀請`,
      heading: "團隊邀請",
      body: (inviterName, orgName) => `${inviterName}邀請您加入${orgName}（Hundredth Sign）。`,
      expiry: (date) => `此邀請將於${date}到期。`,
      button: "接受邀請",
      ignore: "如果您沒有預期此邀請，請忽略此郵件。",
    },
  },

  // ==================== Korean ====================
  ko: {
    signatureRequest: {
      subject: (sender, docTitle) => `\u3010\uC11C\uBA85 \uC694\uCCAD\u3011${sender}\uB2D8\uC774 "${docTitle}" \uC11C\uBA85\uC744 \uC694\uCCAD\uD588\uC2B5\uB2C8\uB2E4`,
      heading: (sender) => `${sender}\uB2D8\uC774 \uAC80\uD1A0 \uBC0F \uC11C\uBA85\uD560 \uBB38\uC11C\uB97C \uBCF4\uB0C8\uC2B5\uB2C8\uB2E4.`,
      body: (docTitle) => `"${docTitle}" \uBB38\uC11C\uB97C \uAC80\uD1A0\uD558\uACE0 \uC11C\uBA85\uD574 \uC8FC\uC138\uC694.`,
      button: "\uBB38\uC11C \uD655\uC778\uD558\uAE30",
      messagePreamble: "\uBC1C\uC2E0\uC790 \uBA54\uC2DC\uC9C0:",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `\u3010\uC11C\uBA85 \uC644\uB8CC\u3011${signer}\uB2D8\uC774 "${docTitle}"\uC5D0 \uC11C\uBA85\uD588\uC2B5\uB2C8\uB2E4`,
      heading: "\uC11C\uBA85\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
      body: (signer, docTitle) => `${signer}\uB2D8\uC774 "${docTitle}"\uC5D0 \uC11C\uBA85\uD588\uC2B5\uB2C8\uB2E4.`,
      button: "\uB300\uC2DC\uBCF4\uB4DC \uD655\uC778",
    },
    allSigned: {
      subject: (docTitle) => `\u3010\uC804\uCCB4 \uC11C\uBA85 \uC644\uB8CC\u3011"${docTitle}"\uC758 \uBAA8\uB4E0 \uC11C\uBA85\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4`,
      heading: "\uBAA8\uB4E0 \uC11C\uBA85\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
      body: (docTitle) => `"${docTitle}"\uC758 \uBAA8\uB4E0 \uC11C\uBA85\uC790\uAC00 \uC11C\uBA85\uC744 \uC644\uB8CC\uD588\uC2B5\uB2C8\uB2E4.`,
      button: "\uC11C\uBA85\uB41C PDF \uB2E4\uC6B4\uB85C\uB4DC",
    },
    declined: {
      subject: (signer, docTitle) => `\u3010\uC11C\uBA85 \uAC70\uBD80\u3011${signer}\uB2D8\uC774 "${docTitle}" \uC11C\uBA85\uC744 \uAC70\uBD80\uD588\uC2B5\uB2C8\uB2E4`,
      heading: "\uC11C\uBA85\uC774 \uAC70\uBD80\uB418\uC5C8\uC2B5\uB2C8\uB2E4",
      body: (signer, docTitle) => `${signer}\uB2D8\uC774 "${docTitle}" \uC11C\uBA85\uC744 \uAC70\uBD80\uD588\uC2B5\uB2C8\uB2E4.`,
      reasonLabel: "\uAC70\uBD80 \uC0AC\uC720",
      button: "\uB300\uC2DC\uBCF4\uB4DC \uD655\uC778",
    },
    reminder: {
      subject: (docTitle) => `\u3010\uC54C\uB9BC\u3011"${docTitle}" \uC11C\uBA85\uC774 \uB300\uAE30 \uC911\uC785\uB2C8\uB2E4`,
      heading: "\uC11C\uBA85 \uC54C\uB9BC",
      body: (docTitle) => `"${docTitle}" \uC11C\uBA85\uC774 \uC544\uC9C1 \uC644\uB8CC\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uBE60\uB978 \uC2DC\uC77C \uB0B4\uC5D0 \uCC98\uB9AC\uD574 \uC8FC\uC138\uC694.`,
      button: "\uBB38\uC11C \uD655\uC778\uD558\uAE30",
    },
    footer: {
      doNotShare: "\uC774 \uC774\uBA54\uC77C\uC744 \uACF5\uC720\uD558\uC9C0 \uB9C8\uC138\uC694",
      doNotShareBody: "\uC774 \uC774\uBA54\uC77C\uC5D0\uB294 Hundredth Sign \uBCF4\uC548 \uB9C1\uD06C\uAC00 \uD3EC\uD568\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4. \uC774 \uC774\uBA54\uC77C, \uB9C1\uD06C \uB610\uB294 \uC561\uC138\uC2A4 \uCF54\uB4DC\uB97C \uB2E4\uB978 \uC0AC\uB78C\uACFC \uACF5\uC720\uD558\uC9C0 \uB9C8\uC138\uC694.",
      aboutHundredthSign: "Hundredth Sign \uC18C\uAC1C",
      aboutHundredthSignBody: "\uBA87 \uBD84 \uB9CC\uC5D0 \uC804\uC790 \uC11C\uBA85\uC73C\uB85C \uBB38\uC11C\uC5D0 \uC11C\uBA85\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC548\uC804\uD558\uACE0 \uBC95\uC801 \uD6A8\uB825\uC774 \uC788\uC2B5\uB2C8\uB2E4.",
      questions: "\uBB38\uC11C\uC5D0 \uB300\uD55C \uC9C8\uBB38\uC774 \uC788\uC73C\uC2E0\uAC00\uC694?",
      questionsBody: "\uBB38\uC11C \uC218\uC815\uC774 \uD544\uC694\uD558\uAC70\uB098 \uC9C8\uBB38\uC774 \uC788\uB294 \uACBD\uC6B0 \uBC1C\uC2E0\uC790\uC5D0\uAC8C \uC9C1\uC811 \uC774\uBA54\uC77C\uB85C \uBB38\uC758\uD558\uC138\uC694.",
    },
    greeting: (name) => `${name}\uB2D8\uAED8`,
    completeWith: (docTitle) => `Hundredth Sign\uC73C\uB85C \uC644\uB8CC: ${docTitle}`,
    thankYou: (name) => `${name}\uB2D8, \uAC10\uC0AC\uD569\uB2C8\uB2E4`,
    ccNotification: {
      subjectPrefix: "\uCC38\uC870",
      body: (senderName, docTitle) => `${senderName}\uB2D8\uC774 "${docTitle}" \uC11C\uBA85 \uC694\uCCAD\uC744 \uBCF4\uB0C8\uC2B5\uB2C8\uB2E4. \uADC0\uD558\uB294 CC \uC218\uC2E0\uC790\uB85C \uCD94\uAC00\uB418\uC5C8\uC73C\uBA70, \uBAA8\uB4E0 \uC11C\uBA85\uC774 \uC644\uB8CC\uB418\uBA74 \uC54C\uB9BC\uC744 \uBC1B\uC2DC\uAC8C \uB429\uB2C8\uB2E4.`,
      button: "\uB300\uC2DC\uBCF4\uB4DC \uC5F4\uAE30",
    },
    plgBanner: {
      headline: "더 스마트한 계약 관리",
      subtext: "올인원 전자 서명 및 계약 관리. 무료로 시작하고 비즈니스를 가속화하세요.",
      cta: "무료로 시작 →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign: ${orgName} 팀 초대`,
      heading: "팀 초대",
      body: (inviterName, orgName) => `${inviterName}님이 Hundredth Sign의 ${orgName}에 초대했습니다.`,
      expiry: (date) => `이 초대는 ${date}까지 유효합니다.`,
      button: "초대 수락하기",
      ignore: "예상치 못한 초대라면 이 이메일을 무시하세요.",
    },
  },

  // ==================== French ====================
  fr: {
    signatureRequest: {
      subject: (sender, docTitle) => `Hundredth Sign: ${sender} vous a envoy\u00E9 "${docTitle}" pour signature`,
      heading: (sender) => `${sender} vous a envoy\u00E9 un document \u00E0 examiner et signer.`,
      body: (docTitle) => `Veuillez examiner et signer le document "${docTitle}".`,
      button: "EXAMINER LE DOCUMENT",
      messagePreamble: "Message de l'exp\u00E9diteur :",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `Signature termin\u00E9e : ${signer} a sign\u00E9 "${docTitle}"`,
      heading: "Signature termin\u00E9e",
      body: (signer, docTitle) => `${signer} a sign\u00E9 "${docTitle}".`,
      button: "Voir le tableau de bord",
    },
    allSigned: {
      subject: (docTitle) => `Toutes les signatures sont termin\u00E9es : "${docTitle}"`,
      heading: "Toutes les signatures sont termin\u00E9es",
      body: (docTitle) => `Tous les signataires ont termin\u00E9 la signature de "${docTitle}".`,
      button: "T\u00E9l\u00E9charger le PDF sign\u00E9",
    },
    declined: {
      subject: (signer, docTitle) => `Signature refus\u00E9e : ${signer} a refus\u00E9 "${docTitle}"`,
      heading: "Signature refus\u00E9e",
      body: (signer, docTitle) => `${signer} a refus\u00E9 de signer "${docTitle}".`,
      reasonLabel: "Motif du refus",
      button: "Voir le tableau de bord",
    },
    reminder: {
      subject: (docTitle) => `Rappel : "${docTitle}" attend votre signature`,
      heading: "Rappel de signature",
      body: (docTitle) => `"${docTitle}" attend toujours votre signature.`,
      button: "EXAMINER LE DOCUMENT",
    },
    footer: {
      doNotShare: "Ne partagez pas cet e-mail",
      doNotShareBody: "Cet e-mail contient un lien s\u00E9curis\u00E9 vers Hundredth Sign. Ne partagez pas cet e-mail, ce lien ou ce code d'acc\u00E8s.",
      aboutHundredthSign: "\u00C0 propos de Hundredth Sign",
      aboutHundredthSignBody: "Signez des documents \u00E9lectroniquement en quelques minutes. S\u00FBr et juridiquement contraignant.",
      questions: "Questions sur le document ?",
      questionsBody: "Si vous devez modifier le document ou avez des questions, contactez directement l'exp\u00E9diteur.",
    },
    greeting: (name) => `Bonjour ${name},`,
    completeWith: (docTitle) => `Compl\u00E9t\u00E9 avec Hundredth Sign : ${docTitle}`,
    thankYou: (name) => `Merci, ${name}`,
    ccNotification: {
      subjectPrefix: "CC",
      body: (senderName, docTitle) => `${senderName} a envoy\u00E9 "${docTitle}" pour signature. Vous avez \u00E9t\u00E9 ajout\u00E9(e) en copie et serez notifi\u00E9(e) lorsque toutes les signatures seront compl\u00E8tes.`,
      button: "Ouvrir le tableau de bord",
    },
    plgBanner: {
      headline: "Des contrats plus intelligents.",
      subtext: "Signature électronique et gestion de contrats tout-en-un. Commencez gratuitement.",
      cta: "Essayer gratuitement →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign : Invitation à rejoindre ${orgName}`,
      heading: "Invitation d'équipe",
      body: (inviterName, orgName) => `${inviterName} vous invite à rejoindre ${orgName} sur Hundredth Sign.`,
      expiry: (date) => `Cette invitation expire le ${date}.`,
      button: "Accepter l'invitation",
      ignore: "Si vous n'attendiez pas cette invitation, veuillez ignorer cet e-mail.",
    },
  },

  // ==================== German ====================
  de: {
    signatureRequest: {
      subject: (sender, docTitle) => `Hundredth Sign: ${sender} hat Ihnen "${docTitle}" zur Unterschrift gesendet`,
      heading: (sender) => `${sender} hat Ihnen ein Dokument zur Pr\u00FCfung und Unterschrift gesendet.`,
      body: (docTitle) => `Bitte pr\u00FCfen und unterschreiben Sie das Dokument "${docTitle}".`,
      button: "DOKUMENT PR\u00DCFEN",
      messagePreamble: "Nachricht des Absenders:",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `Unterschrift abgeschlossen: ${signer} hat "${docTitle}" unterschrieben`,
      heading: "Unterschrift abgeschlossen",
      body: (signer, docTitle) => `${signer} hat "${docTitle}" unterschrieben.`,
      button: "Dashboard anzeigen",
    },
    allSigned: {
      subject: (docTitle) => `Alle Unterschriften abgeschlossen: "${docTitle}"`,
      heading: "Alle Unterschriften abgeschlossen",
      body: (docTitle) => `Alle Unterzeichner haben "${docTitle}" unterschrieben.`,
      button: "Signiertes PDF herunterladen",
    },
    declined: {
      subject: (signer, docTitle) => `Unterschrift abgelehnt: ${signer} hat "${docTitle}" abgelehnt`,
      heading: "Unterschrift abgelehnt",
      body: (signer, docTitle) => `${signer} hat die Unterschrift von "${docTitle}" abgelehnt.`,
      reasonLabel: "Ablehnungsgrund",
      button: "Dashboard anzeigen",
    },
    reminder: {
      subject: (docTitle) => `Erinnerung: "${docTitle}" wartet auf Ihre Unterschrift`,
      heading: "Unterschrift-Erinnerung",
      body: (docTitle) => `"${docTitle}" wartet noch auf Ihre Unterschrift.`,
      button: "DOKUMENT PR\u00DCFEN",
    },
    footer: {
      doNotShare: "Teilen Sie diese E-Mail nicht",
      doNotShareBody: "Diese E-Mail enth\u00E4lt einen sicheren Link zu Hundredth Sign. Teilen Sie diese E-Mail, den Link oder den Zugangscode nicht mit anderen.",
      aboutHundredthSign: "\u00DCber Hundredth Sign",
      aboutHundredthSignBody: "Unterschreiben Sie Dokumente elektronisch in wenigen Minuten. Sicher und rechtsverbindlich.",
      questions: "Fragen zum Dokument?",
      questionsBody: "Bei \u00C4nderungsw\u00FCnschen oder Fragen wenden Sie sich bitte direkt an den Absender.",
    },
    greeting: (name) => `Guten Tag ${name},`,
    completeWith: (docTitle) => `Abgeschlossen mit Hundredth Sign: ${docTitle}`,
    thankYou: (name) => `Vielen Dank, ${name}`,
    ccNotification: {
      subjectPrefix: "CC",
      body: (senderName, docTitle) => `${senderName} hat "${docTitle}" zur Unterschrift gesendet. Sie wurden als CC-Empf\u00E4nger hinzugef\u00FCgt und werden benachrichtigt, wenn alle Unterschriften vorliegen.`,
      button: "Dashboard \u00F6ffnen",
    },
    plgBanner: {
      headline: "Intelligentere Verträge.",
      subtext: "All-in-One E-Signatur und Vertragsmanagement. Kostenlos starten.",
      cta: "Kostenlos testen →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign: Einladung zu ${orgName}`,
      heading: "Team-Einladung",
      body: (inviterName, orgName) => `${inviterName} hat Sie eingeladen, ${orgName} bei Hundredth Sign beizutreten.`,
      expiry: (date) => `Diese Einladung ist bis ${date} gültig.`,
      button: "Einladung annehmen",
      ignore: "Falls Sie diese Einladung nicht erwartet haben, ignorieren Sie bitte diese E-Mail.",
    },
  },

  // ==================== Spanish ====================
  es: {
    signatureRequest: {
      subject: (sender, docTitle) => `Hundredth Sign: ${sender} le envi\u00F3 "${docTitle}" para firmar`,
      heading: (sender) => `${sender} le envi\u00F3 un documento para revisar y firmar.`,
      body: (docTitle) => `Por favor revise y firme el documento "${docTitle}".`,
      button: "REVISAR DOCUMENTO",
      messagePreamble: "Mensaje del remitente:",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `Firma completada: ${signer} firm\u00F3 "${docTitle}"`,
      heading: "Firma completada",
      body: (signer, docTitle) => `${signer} ha firmado "${docTitle}".`,
      button: "Ver panel",
    },
    allSigned: {
      subject: (docTitle) => `Todas las firmas completadas: "${docTitle}"`,
      heading: "Todas las firmas completadas",
      body: (docTitle) => `Todos los firmantes han completado la firma de "${docTitle}".`,
      button: "Descargar PDF firmado",
    },
    declined: {
      subject: (signer, docTitle) => `Firma rechazada: ${signer} rechaz\u00F3 "${docTitle}"`,
      heading: "Firma rechazada",
      body: (signer, docTitle) => `${signer} ha rechazado firmar "${docTitle}".`,
      reasonLabel: "Motivo del rechazo",
      button: "Ver panel",
    },
    reminder: {
      subject: (docTitle) => `Recordatorio: "${docTitle}" espera su firma`,
      heading: "Recordatorio de firma",
      body: (docTitle) => `"${docTitle}" a\u00FAn espera su firma.`,
      button: "REVISAR DOCUMENTO",
    },
    footer: {
      doNotShare: "No comparta este correo",
      doNotShareBody: "Este correo contiene un enlace seguro a Hundredth Sign. No comparta este correo, enlace o c\u00F3digo de acceso.",
      aboutHundredthSign: "Acerca de Hundredth Sign",
      aboutHundredthSignBody: "Firme documentos electr\u00F3nicamente en minutos. Seguro y legalmente vinculante.",
      questions: "\u00BFPreguntas sobre el documento?",
      questionsBody: "Si necesita modificar el documento o tiene preguntas, contacte directamente al remitente.",
    },
    greeting: (name) => `Estimado/a ${name},`,
    completeWith: (docTitle) => `Completado con Hundredth Sign: ${docTitle}`,
    thankYou: (name) => `Gracias, ${name}`,
    ccNotification: {
      subjectPrefix: "CC",
      body: (senderName, docTitle) => `${senderName} ha enviado "${docTitle}" para firma. Usted ha sido agregado/a como destinatario/a en copia y ser\u00E1 notificado/a cuando se completen todas las firmas.`,
      button: "Abrir panel",
    },
    plgBanner: {
      headline: "Contratos más inteligentes.",
      subtext: "Firma electrónica y gestión de contratos todo en uno. Empieza gratis.",
      cta: "Prueba gratis →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign: Invitación a unirse a ${orgName}`,
      heading: "Invitación al equipo",
      body: (inviterName, orgName) => `${inviterName} le ha invitado a unirse a ${orgName} en Hundredth Sign.`,
      expiry: (date) => `Esta invitación caduca el ${date}.`,
      button: "Aceptar invitación",
      ignore: "Si no esperaba esta invitación, puede ignorar este correo.",
    },
  },

  // ==================== Portuguese ====================
  pt: {
    signatureRequest: {
      subject: (sender, docTitle) => `Hundredth Sign: ${sender} enviou "${docTitle}" para assinatura`,
      heading: (sender) => `${sender} enviou um documento para voc\u00EA revisar e assinar.`,
      body: (docTitle) => `Por favor, revise e assine o documento "${docTitle}".`,
      button: "REVISAR DOCUMENTO",
      messagePreamble: "Mensagem do remetente:",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `Assinatura conclu\u00EDda: ${signer} assinou "${docTitle}"`,
      heading: "Assinatura conclu\u00EDda",
      body: (signer, docTitle) => `${signer} assinou "${docTitle}".`,
      button: "Ver painel",
    },
    allSigned: {
      subject: (docTitle) => `Todas as assinaturas conclu\u00EDdas: "${docTitle}"`,
      heading: "Todas as assinaturas conclu\u00EDdas",
      body: (docTitle) => `Todos os signat\u00E1rios conclu\u00EDram a assinatura de "${docTitle}".`,
      button: "Baixar PDF assinado",
    },
    declined: {
      subject: (signer, docTitle) => `Assinatura recusada: ${signer} recusou "${docTitle}"`,
      heading: "Assinatura recusada",
      body: (signer, docTitle) => `${signer} recusou assinar "${docTitle}".`,
      reasonLabel: "Motivo da recusa",
      button: "Ver painel",
    },
    reminder: {
      subject: (docTitle) => `Lembrete: "${docTitle}" aguarda sua assinatura`,
      heading: "Lembrete de assinatura",
      body: (docTitle) => `"${docTitle}" ainda aguarda sua assinatura.`,
      button: "REVISAR DOCUMENTO",
    },
    footer: {
      doNotShare: "N\u00E3o compartilhe este e-mail",
      doNotShareBody: "Este e-mail cont\u00E9m um link seguro para o Hundredth Sign. N\u00E3o compartilhe este e-mail, link ou c\u00F3digo de acesso.",
      aboutHundredthSign: "Sobre o Hundredth Sign",
      aboutHundredthSignBody: "Assine documentos eletronicamente em minutos. Seguro e juridicamente vinculativo.",
      questions: "Perguntas sobre o documento?",
      questionsBody: "Se precisar modificar o documento ou tiver perguntas, entre em contato diretamente com o remetente.",
    },
    greeting: (name) => `Prezado(a) ${name},`,
    completeWith: (docTitle) => `Conclu\u00EDdo com Hundredth Sign: ${docTitle}`,
    thankYou: (name) => `Obrigado, ${name}`,
    ccNotification: {
      subjectPrefix: "CC",
      body: (senderName, docTitle) => `${senderName} enviou "${docTitle}" para assinatura. Voc\u00EA foi adicionado(a) como destinat\u00E1rio(a) em c\u00F3pia e ser\u00E1 notificado(a) quando todas as assinaturas forem conclu\u00EDdas.`,
      button: "Abrir painel",
    },
    plgBanner: {
      headline: "Contratos mais inteligentes.",
      subtext: "Assinatura eletrônica e gestão de contratos tudo-em-um. Comece grátis.",
      cta: "Experimente grátis →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign: Convite para entrar em ${orgName}`,
      heading: "Convite para equipe",
      body: (inviterName, orgName) => `${inviterName} convidou você a entrar em ${orgName} no Hundredth Sign.`,
      expiry: (date) => `Este convite expira em ${date}.`,
      button: "Aceitar convite",
      ignore: "Se você não esperava este convite, pode ignorar este e-mail.",
    },
  },

  // ==================== Italian ====================
  it: {
    signatureRequest: {
      subject: (sender, docTitle) => `Hundredth Sign: ${sender} ti ha inviato "${docTitle}" per la firma`,
      heading: (sender) => `${sender} ti ha inviato un documento da esaminare e firmare.`,
      body: (docTitle) => `Si prega di esaminare e firmare il documento "${docTitle}".`,
      button: "ESAMINA DOCUMENTO",
      messagePreamble: "Messaggio dal mittente:",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `Firma completata: ${signer} ha firmato "${docTitle}"`,
      heading: "Firma completata",
      body: (signer, docTitle) => `${signer} ha firmato "${docTitle}".`,
      button: "Visualizza dashboard",
    },
    allSigned: {
      subject: (docTitle) => `Tutte le firme completate: "${docTitle}"`,
      heading: "Tutte le firme completate",
      body: (docTitle) => `Tutti i firmatari hanno completato la firma di "${docTitle}".`,
      button: "Scarica PDF firmato",
    },
    declined: {
      subject: (signer, docTitle) => `Firma rifiutata: ${signer} ha rifiutato "${docTitle}"`,
      heading: "Firma rifiutata",
      body: (signer, docTitle) => `${signer} ha rifiutato di firmare "${docTitle}".`,
      reasonLabel: "Motivo del rifiuto",
      button: "Visualizza dashboard",
    },
    reminder: {
      subject: (docTitle) => `Promemoria: "${docTitle}" attende la tua firma`,
      heading: "Promemoria firma",
      body: (docTitle) => `"${docTitle}" attende ancora la tua firma.`,
      button: "ESAMINA DOCUMENTO",
    },
    footer: {
      doNotShare: "Non condividere questa email",
      doNotShareBody: "Questa email contiene un link sicuro a Hundredth Sign. Non condividere questa email, il link o il codice di accesso.",
      aboutHundredthSign: "Informazioni su Hundredth Sign",
      aboutHundredthSignBody: "Firma documenti elettronicamente in pochi minuti. Sicuro e giuridicamente vincolante.",
      questions: "Domande sul documento?",
      questionsBody: "Se hai bisogno di modificare il documento o hai domande, contatta direttamente il mittente.",
    },
    greeting: (name) => `Gentile ${name},`,
    completeWith: (docTitle) => `Completato con Hundredth Sign: ${docTitle}`,
    thankYou: (name) => `Grazie, ${name}`,
    ccNotification: {
      subjectPrefix: "CC",
      body: (senderName, docTitle) => `${senderName} ha inviato "${docTitle}" per la firma. \u00C8 stato/a aggiunto/a come destinatario/a in copia e ricever\u00E0 una notifica quando tutte le firme saranno completate.`,
      button: "Apri dashboard",
    },
    plgBanner: {
      headline: "Contratti più intelligenti.",
      subtext: "Firma elettronica e gestione contratti tutto in uno. Inizia gratis.",
      cta: "Prova gratis →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign: Invito ad unirsi a ${orgName}`,
      heading: "Invito al team",
      body: (inviterName, orgName) => `${inviterName} ti ha invitato a unirti a ${orgName} su Hundredth Sign.`,
      expiry: (date) => `Questo invito scade il ${date}.`,
      button: "Accetta invito",
      ignore: "Se non ti aspettavi questo invito, puoi ignorare questa email.",
    },
  },

  // ==================== Thai ====================
  th: {
    signatureRequest: {
      subject: (sender, docTitle) => `Hundredth Sign: ${sender} \u0E2A\u0E48\u0E07\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23 "${docTitle}" \u0E43\u0E2B\u0E49\u0E04\u0E38\u0E13\u0E25\u0E07\u0E19\u0E32\u0E21`,
      heading: (sender) => `${sender} \u0E2A\u0E48\u0E07\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23\u0E43\u0E2B\u0E49\u0E04\u0E38\u0E13\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E41\u0E25\u0E30\u0E25\u0E07\u0E19\u0E32\u0E21`,
      body: (docTitle) => `\u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E41\u0E25\u0E30\u0E25\u0E07\u0E19\u0E32\u0E21\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23 "${docTitle}"`,
      button: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23",
      messagePreamble: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E08\u0E32\u0E01\u0E1C\u0E39\u0E49\u0E2A\u0E48\u0E07:",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `\u0E25\u0E07\u0E19\u0E32\u0E21\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19: ${signer} \u0E25\u0E07\u0E19\u0E32\u0E21 "${docTitle}" \u0E41\u0E25\u0E49\u0E27`,
      heading: "\u0E01\u0E32\u0E23\u0E25\u0E07\u0E19\u0E32\u0E21\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19",
      body: (signer, docTitle) => `${signer} \u0E44\u0E14\u0E49\u0E25\u0E07\u0E19\u0E32\u0E21 "${docTitle}" \u0E41\u0E25\u0E49\u0E27`,
      button: "\u0E14\u0E39\u0E41\u0E14\u0E0A\u0E1A\u0E2D\u0E23\u0E4C\u0E14",
    },
    allSigned: {
      subject: (docTitle) => `\u0E25\u0E07\u0E19\u0E32\u0E21\u0E04\u0E23\u0E1A\u0E17\u0E38\u0E01\u0E04\u0E19: "${docTitle}"`,
      heading: "\u0E01\u0E32\u0E23\u0E25\u0E07\u0E19\u0E32\u0E21\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19",
      body: (docTitle) => `\u0E1C\u0E39\u0E49\u0E25\u0E07\u0E19\u0E32\u0E21\u0E17\u0E38\u0E01\u0E04\u0E19\u0E44\u0E14\u0E49\u0E25\u0E07\u0E19\u0E32\u0E21 "${docTitle}" \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27`,
      button: "\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14 PDF \u0E17\u0E35\u0E48\u0E25\u0E07\u0E19\u0E32\u0E21\u0E41\u0E25\u0E49\u0E27",
    },
    declined: {
      subject: (signer, docTitle) => `\u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18\u0E01\u0E32\u0E23\u0E25\u0E07\u0E19\u0E32\u0E21: ${signer} \u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18 "${docTitle}"`,
      heading: "\u0E01\u0E32\u0E23\u0E25\u0E07\u0E19\u0E32\u0E21\u0E16\u0E39\u0E01\u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18",
      body: (signer, docTitle) => `${signer} \u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18\u0E01\u0E32\u0E23\u0E25\u0E07\u0E19\u0E32\u0E21 "${docTitle}"`,
      reasonLabel: "\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25\u0E43\u0E19\u0E01\u0E32\u0E23\u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18",
      button: "\u0E14\u0E39\u0E41\u0E14\u0E0A\u0E1A\u0E2D\u0E23\u0E4C\u0E14",
    },
    reminder: {
      subject: (docTitle) => `\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19: "${docTitle}" \u0E23\u0E2D\u0E01\u0E32\u0E23\u0E25\u0E07\u0E19\u0E32\u0E21\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13`,
      heading: "\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E01\u0E32\u0E23\u0E25\u0E07\u0E19\u0E32\u0E21",
      body: (docTitle) => `"${docTitle}" \u0E22\u0E31\u0E07\u0E23\u0E2D\u0E01\u0E32\u0E23\u0E25\u0E07\u0E19\u0E32\u0E21\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13`,
      button: "\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23",
    },
    internalApproval: {
      subject: (docTitle) => `คำขออนุมัติภายใน: ${docTitle}`,
      heading: (sender) => `${sender} ขออนุมัติภายใน`,
      body: (docTitle) => `โปรดตรวจสอบ "${docTitle}" ก่อนส่งออก`,
      button: "เปิดหน้าอนุมัติ",
    },
    footer: {
      doNotShare: "\u0E2D\u0E22\u0E48\u0E32\u0E41\u0E0A\u0E23\u0E4C\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E19\u0E35\u0E49",
      doNotShareBody: "\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E19\u0E35\u0E49\u0E21\u0E35\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E17\u0E35\u0E48\u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22\u0E44\u0E1B\u0E22\u0E31\u0E07 Hundredth Sign \u0E01\u0E23\u0E38\u0E13\u0E32\u0E2D\u0E22\u0E48\u0E32\u0E41\u0E0A\u0E23\u0E4C\u0E2D\u0E35\u0E40\u0E21\u0E25 \u0E25\u0E34\u0E07\u0E01\u0E4C \u0E2B\u0E23\u0E37\u0E2D\u0E23\u0E2B\u0E31\u0E2A\u0E40\u0E02\u0E49\u0E32\u0E16\u0E36\u0E07\u0E19\u0E35\u0E49",
      aboutHundredthSign: "\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E01\u0E31\u0E1A Hundredth Sign",
      aboutHundredthSignBody: "\u0E25\u0E07\u0E19\u0E32\u0E21\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23\u0E17\u0E32\u0E07\u0E2D\u0E34\u0E40\u0E25\u0E47\u0E01\u0E17\u0E23\u0E2D\u0E19\u0E34\u0E01\u0E2A\u0E4C\u0E43\u0E19\u0E44\u0E21\u0E48\u0E01\u0E35\u0E48\u0E19\u0E32\u0E17\u0E35 \u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22\u0E41\u0E25\u0E30\u0E21\u0E35\u0E1C\u0E25\u0E17\u0E32\u0E07\u0E01\u0E0E\u0E2B\u0E21\u0E32\u0E22",
      questions: "\u0E21\u0E35\u0E04\u0E33\u0E16\u0E32\u0E21\u0E40\u0E01\u0E35\u0E48\u0E22\u0E27\u0E01\u0E31\u0E1A\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23?",
      questionsBody: "\u0E2B\u0E32\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49\u0E44\u0E02\u0E40\u0E2D\u0E01\u0E2A\u0E32\u0E23\u0E2B\u0E23\u0E37\u0E2D\u0E21\u0E35\u0E04\u0E33\u0E16\u0E32\u0E21 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E2A\u0E48\u0E07\u0E42\u0E14\u0E22\u0E15\u0E23\u0E07",
    },
    greeting: (name) => `\u0E04\u0E38\u0E13${name}`,
    completeWith: (docTitle) => `\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19\u0E14\u0E49\u0E27\u0E22 Hundredth Sign: ${docTitle}`,
    thankYou: (name) => `\u0E02\u0E2D\u0E1A\u0E04\u0E38\u0E13\u0E04\u0E38\u0E13${name}`,
    ccNotification: {
      subjectPrefix: "\u0E2A\u0E33\u0E40\u0E19\u0E32",
      body: (senderName, docTitle) => `${senderName} \u0E2A\u0E48\u0E07 "${docTitle}" \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E25\u0E07\u0E19\u0E32\u0E21 \u0E04\u0E38\u0E13\u0E16\u0E39\u0E01\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E1B\u0E47\u0E19\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E1A\u0E2A\u0E33\u0E40\u0E19\u0E32 \u0E41\u0E25\u0E30\u0E08\u0E30\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E41\u0E08\u0E49\u0E07\u0E40\u0E15\u0E37\u0E2D\u0E19\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E25\u0E07\u0E19\u0E32\u0E21\u0E04\u0E23\u0E1A\u0E17\u0E38\u0E01\u0E04\u0E19`,
      button: "\u0E40\u0E1B\u0E14\u0E41\u0E14\u0E0A\u0E1A\u0E2D\u0E23\u0E4C\u0E14",
    },
    plgBanner: {
      headline: "สัญญาที่ชาญฉลาดยิ่งขึ้น",
      subtext: "ลายเซ็นอิเล็กทรอนิกส์และการจัดการสัญญาแบบครบวงจร เริ่มต้นฟรี",
      cta: "ทดลองใช้ฟรี →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign: คำเชิญเข้าร่วม ${orgName}`,
      heading: "คำเชิญเข้าร่วมทีม",
      body: (inviterName, orgName) => `คุณ${inviterName}ขอเชิญคุณเข้าร่วม${orgName}บน Hundredth Sign`,
      expiry: (date) => `คำเชิญนี้จะหมดอายุในวันที่ ${date}`,
      button: "ยอมรับคำเชิญ",
      ignore: "หากคุณไม่ได้คาดหวังอีเมลนี้ กรุณาเพิกเฉยต่ออีเมลนี้",
    },
  },

  // ==================== Vietnamese ====================
  vi: {
    signatureRequest: {
      subject: (sender, docTitle) => `Hundredth Sign: ${sender} \u0111\u00E3 g\u1EEDi "${docTitle}" \u0111\u1EC3 b\u1EA1n k\u00FD`,
      heading: (sender) => `${sender} \u0111\u00E3 g\u1EEDi cho b\u1EA1n m\u1ED9t t\u00E0i li\u1EC7u \u0111\u1EC3 xem x\u00E9t v\u00E0 k\u00FD.`,
      body: (docTitle) => `Vui l\u00F2ng xem x\u00E9t v\u00E0 k\u00FD t\u00E0i li\u1EC7u "${docTitle}".`,
      button: "XEM T\u00C0I LI\u1EC6U",
      messagePreamble: "Tin nh\u1EAFn t\u1EEB ng\u01B0\u1EDDi g\u1EEDi:",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `K\u00FD ho\u00E0n t\u1EA5t: ${signer} \u0111\u00E3 k\u00FD "${docTitle}"`,
      heading: "K\u00FD ho\u00E0n t\u1EA5t",
      body: (signer, docTitle) => `${signer} \u0111\u00E3 k\u00FD "${docTitle}".`,
      button: "Xem b\u1EA3ng \u0111i\u1EC1u khi\u1EC3n",
    },
    allSigned: {
      subject: (docTitle) => `T\u1EA5t c\u1EA3 \u0111\u00E3 k\u00FD: "${docTitle}"`,
      heading: "T\u1EA5t c\u1EA3 ch\u1EEF k\u00FD \u0111\u00E3 ho\u00E0n t\u1EA5t",
      body: (docTitle) => `T\u1EA5t c\u1EA3 ng\u01B0\u1EDDi k\u00FD \u0111\u00E3 ho\u00E0n t\u1EA5t k\u00FD "${docTitle}".`,
      button: "T\u1EA3i PDF \u0111\u00E3 k\u00FD",
    },
    declined: {
      subject: (signer, docTitle) => `T\u1EEB ch\u1ED1i k\u00FD: ${signer} \u0111\u00E3 t\u1EEB ch\u1ED1i "${docTitle}"`,
      heading: "Ch\u1EEF k\u00FD b\u1ECB t\u1EEB ch\u1ED1i",
      body: (signer, docTitle) => `${signer} \u0111\u00E3 t\u1EEB ch\u1ED1i k\u00FD "${docTitle}".`,
      reasonLabel: "L\u00FD do t\u1EEB ch\u1ED1i",
      button: "Xem b\u1EA3ng \u0111i\u1EC1u khi\u1EC3n",
    },
    reminder: {
      subject: (docTitle) => `Nh\u1EAFc nh\u1EDF: "${docTitle}" \u0111ang ch\u1EDD ch\u1EEF k\u00FD c\u1EE7a b\u1EA1n`,
      heading: "Nh\u1EAFc nh\u1EDF k\u00FD",
      body: (docTitle) => `"${docTitle}" v\u1EABn \u0111ang ch\u1EDD ch\u1EEF k\u00FD c\u1EE7a b\u1EA1n.`,
      button: "XEM T\u00C0I LI\u1EC6U",
    },
    footer: {
      doNotShare: "Kh\u00F4ng chia s\u1EBB email n\u00E0y",
      doNotShareBody: "Email n\u00E0y ch\u1EE9a li\u00EAn k\u1EBFt b\u1EA3o m\u1EADt \u0111\u1EBFn Hundredth Sign. Vui l\u00F2ng kh\u00F4ng chia s\u1EBB email, li\u00EAn k\u1EBFt ho\u1EB7c m\u00E3 truy c\u1EADp n\u00E0y.",
      aboutHundredthSign: "V\u1EC1 Hundredth Sign",
      aboutHundredthSignBody: "K\u00FD t\u00E0i li\u1EC7u \u0111i\u1EC7n t\u1EED ch\u1EC9 trong v\u00E0i ph\u00FAt. An to\u00E0n v\u00E0 c\u00F3 gi\u00E1 tr\u1ECB ph\u00E1p l\u00FD.",
      questions: "C\u00E2u h\u1ECFi v\u1EC1 t\u00E0i li\u1EC7u?",
      questionsBody: "N\u1EBFu c\u1EA7n s\u1EEDa \u0111\u1ED5i t\u00E0i li\u1EC7u ho\u1EB7c c\u00F3 c\u00E2u h\u1ECFi, vui l\u00F2ng li\u00EAn h\u1EC7 tr\u1EF1c ti\u1EBFp v\u1EDBi ng\u01B0\u1EDDi g\u1EEDi.",
    },
    greeting: (name) => `K\u00EDnh g\u1EEDi ${name},`,
    completeWith: (docTitle) => `Ho\u00E0n t\u1EA5t v\u1EDBi Hundredth Sign: ${docTitle}`,
    thankYou: (name) => `C\u1EA3m \u01A1n, ${name}`,
    ccNotification: {
      subjectPrefix: "CC",
      body: (senderName, docTitle) => `${senderName} \u0111\u00E3 g\u1EEDi "${docTitle}" \u0111\u1EC3 k\u00FD. B\u1EA1n \u0111\u00E3 \u0111\u01B0\u1EE3c th\u00EAm v\u00E0o danh s\u00E1ch CC v\u00E0 s\u1EBD \u0111\u01B0\u1EE3c th\u00F4ng b\u00E1o khi t\u1EA5t c\u1EA3 ch\u1EEF k\u00FD ho\u00E0n t\u1EA5t.`,
      button: "M\u1EDF b\u1EA3ng \u0111i\u1EC1u khi\u1EC3n",
    },
    plgBanner: {
      headline: "Hợp đồng thông minh hơn.",
      subtext: "Chữ ký điện tử và quản lý hợp đồng tất cả trong một. Bắt đầu miễn phí.",
      cta: "Dùng thử miễn phí →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign: Lời mời tham gia ${orgName}`,
      heading: "Lời mời nhóm",
      body: (inviterName, orgName) => `${inviterName} đã mời bạn tham gia ${orgName} trên Hundredth Sign.`,
      expiry: (date) => `Lời mời này hết hạn vào ngày ${date}.`,
      button: "Chấp nhận lời mời",
      ignore: "Nếu bạn không mong đợi lời mời này, vui lòng bỏ qua email này.",
    },
  },

  // ==================== Indonesian ====================
  id: {
    signatureRequest: {
      subject: (sender, docTitle) => `Hundredth Sign: ${sender} mengirim "${docTitle}" untuk ditandatangani`,
      heading: (sender) => `${sender} mengirim dokumen untuk Anda tinjau dan tandatangani.`,
      body: (docTitle) => `Silakan tinjau dan tandatangani dokumen "${docTitle}".`,
      button: "TINJAU DOKUMEN",
      messagePreamble: "Pesan dari pengirim:",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `Tanda tangan selesai: ${signer} menandatangani "${docTitle}"`,
      heading: "Tanda tangan selesai",
      body: (signer, docTitle) => `${signer} telah menandatangani "${docTitle}".`,
      button: "Lihat dasbor",
    },
    allSigned: {
      subject: (docTitle) => `Semua tanda tangan selesai: "${docTitle}"`,
      heading: "Semua tanda tangan selesai",
      body: (docTitle) => `Semua penandatangan telah menyelesaikan penandatanganan "${docTitle}".`,
      button: "Unduh PDF yang ditandatangani",
    },
    declined: {
      subject: (signer, docTitle) => `Tanda tangan ditolak: ${signer} menolak "${docTitle}"`,
      heading: "Tanda tangan ditolak",
      body: (signer, docTitle) => `${signer} menolak menandatangani "${docTitle}".`,
      reasonLabel: "Alasan penolakan",
      button: "Lihat dasbor",
    },
    reminder: {
      subject: (docTitle) => `Pengingat: "${docTitle}" menunggu tanda tangan Anda`,
      heading: "Pengingat tanda tangan",
      body: (docTitle) => `"${docTitle}" masih menunggu tanda tangan Anda.`,
      button: "TINJAU DOKUMEN",
    },
    footer: {
      doNotShare: "Jangan bagikan email ini",
      doNotShareBody: "Email ini berisi tautan aman ke Hundredth Sign. Jangan bagikan email, tautan, atau kode akses ini.",
      aboutHundredthSign: "Tentang Hundredth Sign",
      aboutHundredthSignBody: "Tandatangani dokumen secara elektronik dalam hitungan menit. Aman dan mengikat secara hukum.",
      questions: "Pertanyaan tentang dokumen?",
      questionsBody: "Jika perlu mengubah dokumen atau memiliki pertanyaan, hubungi pengirim secara langsung.",
    },
    greeting: (name) => `Yth. ${name},`,
    completeWith: (docTitle) => `Selesai dengan Hundredth Sign: ${docTitle}`,
    thankYou: (name) => `Terima kasih, ${name}`,
    ccNotification: {
      subjectPrefix: "Salinan",
      body: (senderName, docTitle) => `${senderName} telah mengirim "${docTitle}" untuk ditandatangani. Anda ditambahkan sebagai penerima salinan (CC) dan akan diberitahu setelah semua tanda tangan selesai.`,
      button: "Buka dasbor",
    },
    plgBanner: {
      headline: "Kontrak yang lebih cerdas.",
      subtext: "Tanda tangan elektronik dan manajemen kontrak all-in-one. Mulai gratis.",
      cta: "Coba gratis →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign: Undangan bergabung dengan ${orgName}`,
      heading: "Undangan Tim",
      body: (inviterName, orgName) => `${inviterName} mengundang Anda untuk bergabung dengan ${orgName} di Hundredth Sign.`,
      expiry: (date) => `Undangan ini berlaku hingga ${date}.`,
      button: "Terima undangan",
      ignore: "Jika Anda tidak mengharapkan undangan ini, abaikan saja email ini.",
    },
  },

  // ==================== Hindi ====================
  hi: {
    signatureRequest: {
      subject: (sender, docTitle) => `Hundredth Sign: ${sender} \u0928\u0947 "${docTitle}" \u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u0915\u0947 \u0932\u093F\u090F \u092D\u0947\u091C\u093E`,
      heading: (sender) => `${sender} \u0928\u0947 \u0906\u092A\u0915\u094B \u0938\u092E\u0940\u0915\u094D\u0937\u093E \u0914\u0930 \u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u0915\u0947 \u0932\u093F\u090F \u090F\u0915 \u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C \u092D\u0947\u091C\u093E \u0939\u0948\u0964`,
      body: (docTitle) => `\u0915\u0943\u092A\u092F\u093E \u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C "${docTitle}" \u0915\u0940 \u0938\u092E\u0940\u0915\u094D\u0937\u093E \u0915\u0930\u0947\u0902 \u0914\u0930 \u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u0915\u0930\u0947\u0902\u0964`,
      button: "\u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C \u0926\u0947\u0916\u0947\u0902",
      messagePreamble: "\u092A\u094D\u0930\u0947\u0937\u0915 \u0915\u093E \u0938\u0902\u0926\u0947\u0936:",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `\u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u092A\u0942\u0930\u094D\u0923: ${signer} \u0928\u0947 "${docTitle}" \u092A\u0930 \u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u0915\u093F\u090F`,
      heading: "\u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u092A\u0942\u0930\u094D\u0923",
      body: (signer, docTitle) => `${signer} \u0928\u0947 "${docTitle}" \u092A\u0930 \u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u0915\u093F\u090F\u0964`,
      button: "\u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921 \u0926\u0947\u0916\u0947\u0902",
    },
    allSigned: {
      subject: (docTitle) => `\u0938\u092D\u0940 \u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u092A\u0942\u0930\u094D\u0923: "${docTitle}"`,
      heading: "\u0938\u092D\u0940 \u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u092A\u0942\u0930\u094D\u0923",
      body: (docTitle) => `"${docTitle}" \u0915\u0947 \u0938\u092D\u0940 \u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930\u0915\u0930\u094D\u0924\u093E\u0913\u0902 \u0928\u0947 \u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u092A\u0942\u0930\u094D\u0923 \u0915\u093F\u090F\u0964`,
      button: "\u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930\u093F\u0924 PDF \u0921\u093E\u0909\u0928\u0932\u094B\u0921 \u0915\u0930\u0947\u0902",
    },
    declined: {
      subject: (signer, docTitle) => `\u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u0905\u0938\u094D\u0935\u0940\u0915\u0943\u0924: ${signer} \u0928\u0947 "${docTitle}" \u0905\u0938\u094D\u0935\u0940\u0915\u0943\u0924 \u0915\u093F\u092F\u093E`,
      heading: "\u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u0905\u0938\u094D\u0935\u0940\u0915\u0943\u0924",
      body: (signer, docTitle) => `${signer} \u0928\u0947 "${docTitle}" \u092A\u0930 \u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u0905\u0938\u094D\u0935\u0940\u0915\u0943\u0924 \u0915\u093F\u092F\u093E\u0964`,
      reasonLabel: "\u0905\u0938\u094D\u0935\u0940\u0915\u0943\u0924\u093F \u0915\u093E \u0915\u093E\u0930\u0923",
      button: "\u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921 \u0926\u0947\u0916\u0947\u0902",
    },
    reminder: {
      subject: (docTitle) => `\u0905\u0928\u0941\u0938\u094D\u092E\u093E\u0930\u0915: "${docTitle}" \u0906\u092A\u0915\u0947 \u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u0915\u0940 \u092A\u094D\u0930\u0924\u0940\u0915\u094D\u0937\u093E \u092E\u0947\u0902 \u0939\u0948`,
      heading: "\u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u0905\u0928\u0941\u0938\u094D\u092E\u093E\u0930\u0915",
      body: (docTitle) => `"${docTitle}" \u0905\u092D\u0940 \u092D\u0940 \u0906\u092A\u0915\u0947 \u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u0915\u0940 \u092A\u094D\u0930\u0924\u0940\u0915\u094D\u0937\u093E \u092E\u0947\u0902 \u0939\u0948\u0964`,
      button: "\u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C \u0926\u0947\u0916\u0947\u0902",
    },
    footer: {
      doNotShare: "\u0907\u0938 \u0908\u092E\u0947\u0932 \u0915\u094B \u0938\u093E\u091D\u093E \u0928 \u0915\u0930\u0947\u0902",
      doNotShareBody: "\u0907\u0938 \u0908\u092E\u0947\u0932 \u092E\u0947\u0902 Hundredth Sign \u0915\u093E \u0938\u0941\u0930\u0915\u094D\u0937\u093F\u0924 \u0932\u093F\u0902\u0915 \u0939\u0948\u0964 \u0915\u0943\u092A\u092F\u093E \u0907\u0938 \u0908\u092E\u0947\u0932, \u0932\u093F\u0902\u0915 \u092F\u093E \u090F\u0915\u094D\u0938\u0947\u0938 \u0915\u094B\u0921 \u0915\u094B \u0938\u093E\u091D\u093E \u0928 \u0915\u0930\u0947\u0902\u0964",
      aboutHundredthSign: "Hundredth Sign \u0915\u0947 \u092C\u093E\u0930\u0947 \u092E\u0947\u0902",
      aboutHundredthSignBody: "\u0915\u0941\u091B \u0939\u0940 \u092E\u093F\u0928\u091F\u094B\u0902 \u092E\u0947\u0902 \u0907\u0932\u0947\u0915\u094D\u091F\u094D\u0930\u0949\u0928\u093F\u0915 \u0930\u0942\u092A \u0938\u0947 \u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C\u094B\u0902 \u092A\u0930 \u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u0915\u0930\u0947\u0902\u0964 \u0938\u0941\u0930\u0915\u094D\u0937\u093F\u0924 \u0914\u0930 \u0915\u093E\u0928\u0942\u0928\u0940 \u0930\u0942\u092A \u0938\u0947 \u092C\u093E\u0927\u094D\u092F\u0915\u093E\u0930\u0940\u0964",
      questions: "\u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C \u0915\u0947 \u092C\u093E\u0930\u0947 \u092E\u0947\u0902 \u092A\u094D\u0930\u0936\u094D\u0928?",
      questionsBody: "\u092F\u0926\u093F \u0926\u0938\u094D\u0924\u093E\u0935\u0947\u091C\u093C \u092E\u0947\u0902 \u0938\u0902\u0936\u094B\u0927\u0928 \u0915\u0940 \u0906\u0935\u0936\u094D\u092F\u0915\u0924\u093E \u0939\u0948 \u092F\u093E \u092A\u094D\u0930\u0936\u094D\u0928 \u0939\u0948\u0902, \u0924\u094B \u0915\u0943\u092A\u092F\u093E \u092A\u094D\u0930\u0947\u0937\u0915 \u0938\u0947 \u0938\u0940\u0927\u0947 \u0938\u0902\u092A\u0930\u094D\u0915 \u0915\u0930\u0947\u0902\u0964",
    },
    greeting: (name) => `${name} \u091C\u0940,`,
    completeWith: (docTitle) => `Hundredth Sign \u0915\u0947 \u0938\u093E\u0925 \u092A\u0942\u0930\u094D\u0923: ${docTitle}`,
    thankYou: (name) => `${name} \u091C\u0940, \u0927\u0928\u094D\u092F\u0935\u093E\u0926`,
    ccNotification: {
      subjectPrefix: "\u092A\u094D\u0930\u0924\u093F\u0932\u093F\u092A\u093F",
      body: (senderName, docTitle) => `${senderName} \u0928\u0947 "${docTitle}" \u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u0915\u0947 \u0932\u093F\u090F \u092D\u0947\u091C\u093E \u0939\u0948\u0964 \u0906\u092A\u0915\u094B CC \u092A\u094D\u0930\u093E\u092A\u094D\u0924\u0915\u0930\u094D\u0924\u093E \u0915\u0947 \u0930\u0942\u092A \u092E\u0947\u0902 \u091C\u094B\u0921\u093C\u093E \u0917\u092F\u093E \u0939\u0948 \u0914\u0930 \u0938\u092D\u0940 \u0939\u0938\u094D\u0924\u093E\u0915\u094D\u0937\u0930 \u092A\u0942\u0930\u094D\u0923 \u0939\u094B\u0928\u0947 \u092A\u0930 \u0938\u0942\u091A\u093F\u0924 \u0915\u093F\u092F\u093E \u091C\u093E\u090F\u0917\u093E\u0964`,
      button: "\u0921\u0948\u0936\u092C\u094B\u0930\u094D\u0921 \u0916\u094B\u0932\u0947\u0902",
    },
    plgBanner: {
      headline: "स्मार्ट अनुबंध प्रबंधन",
      subtext: "ऑल-इन-वन ई-हस्ताक्षर और अनुबंध प्रबंधन। मुफ्त में शुरू करें।",
      cta: "मुफ्त में आज़माएं →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign: ${orgName} में शामिल होने का निमंत्रण`,
      heading: "टीम आमंत्रण",
      body: (inviterName, orgName) => `${inviterName} जी ने आपको Hundredth Sign पर ${orgName} में शामिल होने के लिए आमंत्रित किया है।`,
      expiry: (date) => `यह आमंत्रण ${date} तक वैध है।`,
      button: "आमंत्रण स्वीकार करें",
      ignore: "यदि आपको इस आमंत्रण की उम्मीद नहीं थी, तो इस ईमेल को अनदेखा करें।",
    },
  },

  // ==================== Dutch ====================
  nl: {
    signatureRequest: {
      subject: (sender, docTitle) => `Hundredth Sign: ${sender} heeft "${docTitle}" ter ondertekening gestuurd`,
      heading: (sender) => `${sender} heeft u een document gestuurd om te bekijken en te ondertekenen.`,
      body: (docTitle) => `Bekijk en onderteken het document "${docTitle}".`,
      button: "DOCUMENT BEKIJKEN",
      messagePreamble: "Bericht van de afzender:",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `Ondertekening voltooid: ${signer} heeft "${docTitle}" ondertekend`,
      heading: "Ondertekening voltooid",
      body: (signer, docTitle) => `${signer} heeft "${docTitle}" ondertekend.`,
      button: "Dashboard bekijken",
    },
    allSigned: {
      subject: (docTitle) => `Alle ondertekeningen voltooid: "${docTitle}"`,
      heading: "Alle ondertekeningen voltooid",
      body: (docTitle) => `Alle ondertekenaars hebben "${docTitle}" ondertekend.`,
      button: "Ondertekende PDF downloaden",
    },
    declined: {
      subject: (signer, docTitle) => `Ondertekening geweigerd: ${signer} heeft "${docTitle}" geweigerd`,
      heading: "Ondertekening geweigerd",
      body: (signer, docTitle) => `${signer} heeft geweigerd "${docTitle}" te ondertekenen.`,
      reasonLabel: "Reden van weigering",
      button: "Dashboard bekijken",
    },
    reminder: {
      subject: (docTitle) => `Herinnering: "${docTitle}" wacht op uw ondertekening`,
      heading: "Ondertekeningsherinnering",
      body: (docTitle) => `"${docTitle}" wacht nog op uw ondertekening.`,
      button: "DOCUMENT BEKIJKEN",
    },
    footer: {
      doNotShare: "Deel deze e-mail niet",
      doNotShareBody: "Deze e-mail bevat een beveiligde link naar Hundredth Sign. Deel deze e-mail, link of toegangscode niet met anderen.",
      aboutHundredthSign: "Over Hundredth Sign",
      aboutHundredthSignBody: "Onderteken documenten elektronisch in enkele minuten. Veilig en juridisch bindend.",
      questions: "Vragen over het document?",
      questionsBody: "Als u het document moet wijzigen of vragen heeft, neem dan rechtstreeks contact op met de afzender.",
    },
    greeting: (name) => `Beste ${name},`,
    completeWith: (docTitle) => `Voltooid met Hundredth Sign: ${docTitle}`,
    thankYou: (name) => `Bedankt, ${name}`,
    ccNotification: {
      subjectPrefix: "CC",
      body: (senderName, docTitle) => `${senderName} heeft "${docTitle}" ter ondertekening verzonden. U bent toegevoegd als CC-ontvanger en ontvangt een melding wanneer alle handtekeningen zijn voltooid.`,
      button: "Dashboard openen",
    },
    plgBanner: {
      headline: "Slimmere contracten.",
      subtext: "Alles-in-één e-handtekening en contractbeheer. Gratis beginnen.",
      cta: "Gratis proberen →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign: Uitnodiging voor ${orgName}`,
      heading: "Teamuitnodiging",
      body: (inviterName, orgName) => `${inviterName} heeft u uitgenodigd om deel te nemen aan ${orgName} op Hundredth Sign.`,
      expiry: (date) => `Deze uitnodiging verloopt op ${date}.`,
      button: "Uitnodiging accepteren",
      ignore: "Als u deze uitnodiging niet verwachtte, kunt u deze e-mail negeren.",
    },
  },

  // ==================== Polish ====================
  pl: {
    signatureRequest: {
      subject: (sender, docTitle) => `Hundredth Sign: ${sender} wys\u0142a\u0142 "${docTitle}" do podpisu`,
      heading: (sender) => `${sender} wys\u0142a\u0142 Ci dokument do przejrzenia i podpisania.`,
      body: (docTitle) => `Prosz\u0119 przejrze\u0107 i podpisa\u0107 dokument "${docTitle}".`,
      button: "PRZEJRZYJ DOKUMENT",
      messagePreamble: "Wiadomo\u015B\u0107 od nadawcy:",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `Podpis zako\u0144czony: ${signer} podpisa\u0142 "${docTitle}"`,
      heading: "Podpis zako\u0144czony",
      body: (signer, docTitle) => `${signer} podpisa\u0142 "${docTitle}".`,
      button: "Zobacz panel",
    },
    allSigned: {
      subject: (docTitle) => `Wszystkie podpisy zako\u0144czone: "${docTitle}"`,
      heading: "Wszystkie podpisy zako\u0144czone",
      body: (docTitle) => `Wszyscy sygnatariusze podpisali "${docTitle}".`,
      button: "Pobierz podpisany PDF",
    },
    declined: {
      subject: (signer, docTitle) => `Podpis odrzucony: ${signer} odrzuci\u0142 "${docTitle}"`,
      heading: "Podpis odrzucony",
      body: (signer, docTitle) => `${signer} odrzuci\u0142 podpisanie "${docTitle}".`,
      reasonLabel: "Pow\u00F3d odrzucenia",
      button: "Zobacz panel",
    },
    reminder: {
      subject: (docTitle) => `Przypomnienie: "${docTitle}" czeka na Tw\u00F3j podpis`,
      heading: "Przypomnienie o podpisie",
      body: (docTitle) => `"${docTitle}" nadal czeka na Tw\u00F3j podpis.`,
      button: "PRZEJRZYJ DOKUMENT",
    },
    footer: {
      doNotShare: "Nie udost\u0119pniaj tego e-maila",
      doNotShareBody: "Ten e-mail zawiera bezpieczny link do Hundredth Sign. Nie udost\u0119pniaj tego e-maila, linku ani kodu dost\u0119pu.",
      aboutHundredthSign: "O Hundredth Sign",
      aboutHundredthSignBody: "Podpisuj dokumenty elektronicznie w kilka minut. Bezpiecznie i prawnie wi\u0105\u017C\u0105ce.",
      questions: "Pytania dotycz\u0105ce dokumentu?",
      questionsBody: "Je\u015Bli musisz zmodyfikowa\u0107 dokument lub masz pytania, skontaktuj si\u0119 bezpo\u015Brednio z nadawc\u0105.",
    },
    greeting: (name) => `Szanowna/y ${name},`,
    completeWith: (docTitle) => `Uko\u0144czono z Hundredth Sign: ${docTitle}`,
    thankYou: (name) => `Dzi\u0119kuj\u0119, ${name}`,
    ccNotification: {
      subjectPrefix: "Kopia",
      body: (senderName, docTitle) => `${senderName} wys\u0142a\u0142 "${docTitle}" do podpisu. Zosta\u0142e\u015B/\u0142a\u015B dodany/a jako odbiorca kopii (CC) i zostaniesz powiadomiony/a po z\u0142o\u017Ceniu wszystkich podpis\u00F3w.`,
      button: "Otw\u00F3rz panel",
    },
    plgBanner: {
      headline: "Inteligentniejsze umowy.",
      subtext: "Podpis elektroniczny i zarządzanie umowami w jednym. Zacznij za darmo.",
      cta: "Wypróbuj za darmo →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign: Zaproszenie do ${orgName}`,
      heading: "Zaproszenie do zespołu",
      body: (inviterName, orgName) => `${inviterName} zaprasza Cię do dołączenia do ${orgName} w Hundredth Sign.`,
      expiry: (date) => `To zaproszenie wygasa ${date}.`,
      button: "Zaakceptuj zaproszenie",
      ignore: "Jeśli nie spodziewałeś się tego zaproszenia, możesz zignorować ten e-mail.",
    },
  },

  // ==================== Swedish ====================
  sv: {
    signatureRequest: {
      subject: (sender, docTitle) => `Hundredth Sign: ${sender} har skickat "${docTitle}" f\u00F6r signering`,
      heading: (sender) => `${sender} har skickat ett dokument f\u00F6r granskning och signering.`,
      body: (docTitle) => `V\u00E4nligen granska och signera dokumentet "${docTitle}".`,
      button: "GRANSKA DOKUMENT",
      messagePreamble: "Meddelande fr\u00E5n avs\u00E4ndaren:",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `Signering klar: ${signer} har signerat "${docTitle}"`,
      heading: "Signering klar",
      body: (signer, docTitle) => `${signer} har signerat "${docTitle}".`,
      button: "Visa instrumentpanel",
    },
    allSigned: {
      subject: (docTitle) => `Alla signeringar klara: "${docTitle}"`,
      heading: "Alla signeringar klara",
      body: (docTitle) => `Alla undert
ecknare har signerat "${docTitle}".`,
      button: "Ladda ner signerad PDF",
    },
    declined: {
      subject: (signer, docTitle) => `Signering nekad: ${signer} nekade "${docTitle}"`,
      heading: "Signering nekad",
      body: (signer, docTitle) => `${signer} nekade att signera "${docTitle}".`,
      reasonLabel: "Anledning till nekande",
      button: "Visa instrumentpanel",
    },
    reminder: {
      subject: (docTitle) => `P\u00E5minnelse: "${docTitle}" v\u00E4ntar p\u00E5 din signering`,
      heading: "Signeringsp\u00E5minnelse",
      body: (docTitle) => `"${docTitle}" v\u00E4ntar fortfarande p\u00E5 din signering.`,
      button: "GRANSKA DOKUMENT",
    },
    footer: {
      doNotShare: "Dela inte detta e-postmeddelande",
      doNotShareBody: "Detta e-postmeddelande inneh\u00E5ller en s\u00E4ker l\u00E4nk till Hundredth Sign. Dela inte detta e-postmeddelande, l\u00E4nken eller \u00E5tkomstkoden.",
      aboutHundredthSign: "Om Hundredth Sign",
      aboutHundredthSignBody: "Signera dokument elektroniskt p\u00E5 n\u00E5gra minuter. S\u00E4kert och juridiskt bindande.",
      questions: "Fr\u00E5gor om dokumentet?",
      questionsBody: "Om du beh\u00F6ver \u00E4ndra dokumentet eller har fr\u00E5gor, kontakta avs\u00E4ndaren direkt.",
    },
    greeting: (name) => `Hej ${name},`,
    completeWith: (docTitle) => `Slutf\u00F6rt med Hundredth Sign: ${docTitle}`,
    thankYou: (name) => `Tack, ${name}`,
    ccNotification: {
      subjectPrefix: "Kopia",
      body: (senderName, docTitle) => `${senderName} har skickat "${docTitle}" f\u00F6r signering. Du har lagts till som CC-mottagare och kommer att f\u00E5 ett meddelande n\u00E4r alla signeringar \u00E4r klara.`,
      button: "\u00D6ppna instrumentpanel",
    },
    plgBanner: {
      headline: "Smartare avtal.",
      subtext: "Allt-i-ett e-signatur och avtalshantering. Börja gratis.",
      cta: "Prova gratis →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign: Inbjudan till ${orgName}`,
      heading: "Teaminbjudan",
      body: (inviterName, orgName) => `${inviterName} har bjudit in dig att gå med i ${orgName} på Hundredth Sign.`,
      expiry: (date) => `Den här inbjudan går ut den ${date}.`,
      button: "Acceptera inbjudan",
      ignore: "Om du inte förväntade dig den här inbjudan kan du ignorera det här e-postmeddelandet.",
    },
  },

  // ==================== Turkish ====================
  tr: {
    signatureRequest: {
      subject: (sender, docTitle) => `Hundredth Sign: ${sender} "${docTitle}" belgesini imzalaman\u0131z i\u00E7in g\u00F6nderdi`,
      heading: (sender) => `${sender} incelemeniz ve imzalaman\u0131z i\u00E7in bir belge g\u00F6nderdi.`,
      body: (docTitle) => `L\u00FCtfen "${docTitle}" belgesini inceleyin ve imzalay\u0131n.`,
      button: "BELGEYI \u0130NCELE",
      messagePreamble: "G\u00F6nderenin mesaj\u0131:",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `\u0130mza tamamland\u0131: ${signer} "${docTitle}" belgesini imzalad\u0131`,
      heading: "\u0130mza tamamland\u0131",
      body: (signer, docTitle) => `${signer} "${docTitle}" belgesini imzalad\u0131.`,
      button: "Paneli g\u00F6r\u00FCnt\u00FCle",
    },
    allSigned: {
      subject: (docTitle) => `T\u00FCm imzalar tamamland\u0131: "${docTitle}"`,
      heading: "T\u00FCm imzalar tamamland\u0131",
      body: (docTitle) => `T\u00FCm imzac\u0131lar "${docTitle}" belgesini imzalad\u0131.`,
      button: "\u0130mzal\u0131 PDF'yi indir",
    },
    declined: {
      subject: (signer, docTitle) => `\u0130mza reddedildi: ${signer} "${docTitle}" belgesini reddetti`,
      heading: "\u0130mza reddedildi",
      body: (signer, docTitle) => `${signer} "${docTitle}" belgesini imzalamay\u0131 reddetti.`,
      reasonLabel: "Ret nedeni",
      button: "Paneli g\u00F6r\u00FCnt\u00FCle",
    },
    reminder: {
      subject: (docTitle) => `Hat\u0131rlatma: "${docTitle}" imzan\u0131z\u0131 bekliyor`,
      heading: "\u0130mza hat\u0131rlatmas\u0131",
      body: (docTitle) => `"${docTitle}" hala imzan\u0131z\u0131 bekliyor.`,
      button: "BELGEYI \u0130NCELE",
    },
    footer: {
      doNotShare: "Bu e-postay\u0131 payla\u015Fmay\u0131n",
      doNotShareBody: "Bu e-posta Hundredth Sign'a g\u00FCvenli bir ba\u011Flant\u0131 i\u00E7ermektedir. Bu e-postay\u0131, ba\u011Flant\u0131y\u0131 veya eri\u015Fim kodunu payla\u015Fmay\u0131n.",
      aboutHundredthSign: "Hundredth Sign Hakk\u0131nda",
      aboutHundredthSignBody: "Belgeleri birka\u00E7 dakika i\u00E7inde elektronik olarak imzalay\u0131n. G\u00FCvenli ve yasal olarak ba\u011Flay\u0131c\u0131.",
      questions: "Belge hakk\u0131nda sorular\u0131n\u0131z m\u0131 var?",
      questionsBody: "Belgeyi de\u011Fi\u015Ftirmeniz gerekiyorsa veya sorular\u0131n\u0131z varsa, do\u011Frudan g\u00F6nderenle ileti\u015Fime ge\u00E7in.",
    },
    greeting: (name) => `Say\u0131n ${name},`,
    completeWith: (docTitle) => `Hundredth Sign ile tamamland\u0131: ${docTitle}`,
    thankYou: (name) => `Te\u015Fekk\u00FCrler, ${name}`,
    ccNotification: {
      subjectPrefix: "Kopya",
      body: (senderName, docTitle) => `${senderName} imzalanmas\u0131 i\u00E7in "${docTitle}" belgesini g\u00F6nderdi. Kopya (CC) al\u0131c\u0131s\u0131 olarak eklendi\u011Finiz ve t\u00FCm imzalar tamamland\u0131\u011F\u0131nda bildirim alacaks\u0131n\u0131z.`,
      button: "Panoyu a\u00E7",
    },
    plgBanner: {
      headline: "Daha akıllı sözleşmeler.",
      subtext: "Hepsi bir arada e-imza ve sözleşme yönetimi. Ücretsiz başlayın.",
      cta: "Ücretsiz deneyin →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign: ${orgName} ekibine davet`,
      heading: "Takım Daveti",
      body: (inviterName, orgName) => `${inviterName}, sizi Hundredth Sign'daki ${orgName} ekibine davet etti.`,
      expiry: (date) => `Bu davet ${date} tarihinde sona erecek.`,
      button: "Daveti kabul et",
      ignore: "Bu daveti beklemiyorsanız bu e-postayı görmezden gelebilirsiniz.",
    },
  },

  // ==================== Russian ====================
  ru: {
    signatureRequest: {
      subject: (sender, docTitle) => `Hundredth Sign: ${sender} \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u043B "${docTitle}" \u043D\u0430 \u043F\u043E\u0434\u043F\u0438\u0441\u044C`,
      heading: (sender) => `${sender} \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u043B \u0432\u0430\u043C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0438 \u043F\u043E\u0434\u043F\u0438\u0441\u0438.`,
      body: (docTitle) => `\u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u043F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435 \u0438 \u043F\u043E\u0434\u043F\u0438\u0448\u0438\u0442\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 "${docTitle}".`,
      button: "\u041F\u0420\u041E\u0421\u041C\u041E\u0422\u0420\u0415\u0422\u042C \u0414\u041E\u041A\u0423\u041C\u0415\u041D\u0422",
      messagePreamble: "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043E\u0442 \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u0435\u043B\u044F:",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `\u041F\u043E\u0434\u043F\u0438\u0441\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430: ${signer} \u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043B "${docTitle}"`,
      heading: "\u041F\u043E\u0434\u043F\u0438\u0441\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430",
      body: (signer, docTitle) => `${signer} \u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043B "${docTitle}".`,
      button: "\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u043D\u0430 \u043F\u0430\u043D\u0435\u043B\u044C",
    },
    allSigned: {
      subject: (docTitle) => `\u0412\u0441\u0435 \u043F\u043E\u0434\u043F\u0438\u0441\u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u044B: "${docTitle}"`,
      heading: "\u0412\u0441\u0435 \u043F\u043E\u0434\u043F\u0438\u0441\u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u044B",
      body: (docTitle) => `\u0412\u0441\u0435 \u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043D\u0442\u044B \u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043B\u0438 "${docTitle}".`,
      button: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043D\u043D\u044B\u0439 PDF",
    },
    declined: {
      subject: (signer, docTitle) => `\u041F\u043E\u0434\u043F\u0438\u0441\u044C \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0430: ${signer} \u043E\u0442\u043A\u043B\u043E\u043D\u0438\u043B "${docTitle}"`,
      heading: "\u041F\u043E\u0434\u043F\u0438\u0441\u044C \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0430",
      body: (signer, docTitle) => `${signer} \u043E\u0442\u043A\u043B\u043E\u043D\u0438\u043B \u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043D\u0438\u0435 "${docTitle}".`,
      reasonLabel: "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044F",
      button: "\u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u043D\u0430 \u043F\u0430\u043D\u0435\u043B\u044C",
    },
    reminder: {
      subject: (docTitle) => `\u041D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0435: "${docTitle}" \u043E\u0436\u0438\u0434\u0430\u0435\u0442 \u0432\u0430\u0448\u0443 \u043F\u043E\u0434\u043F\u0438\u0441\u044C`,
      heading: "\u041D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0435 \u043E \u043F\u043E\u0434\u043F\u0438\u0441\u0438",
      body: (docTitle) => `"${docTitle}" \u0432\u0441\u0435 \u0435\u0449\u0435 \u043E\u0436\u0438\u0434\u0430\u0435\u0442 \u0432\u0430\u0448\u0443 \u043F\u043E\u0434\u043F\u0438\u0441\u044C.`,
      button: "\u041F\u0420\u041E\u0421\u041C\u041E\u0422\u0420\u0415\u0422\u042C \u0414\u041E\u041A\u0423\u041C\u0415\u041D\u0422",
    },
    footer: {
      doNotShare: "\u041D\u0435 \u043F\u0435\u0440\u0435\u0441\u044B\u043B\u0430\u0439\u0442\u0435 \u044D\u0442\u043E \u043F\u0438\u0441\u044C\u043C\u043E",
      doNotShareBody: "\u042D\u0442\u043E \u043F\u0438\u0441\u044C\u043C\u043E \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0437\u0430\u0449\u0438\u0449\u0435\u043D\u043D\u0443\u044E \u0441\u0441\u044B\u043B\u043A\u0443 \u043D\u0430 Hundredth Sign. \u041D\u0435 \u043F\u0435\u0440\u0435\u0441\u044B\u043B\u0430\u0439\u0442\u0435 \u044D\u0442\u043E \u043F\u0438\u0441\u044C\u043C\u043E, \u0441\u0441\u044B\u043B\u043A\u0443 \u0438\u043B\u0438 \u043A\u043E\u0434 \u0434\u043E\u0441\u0442\u0443\u043F\u0430.",
      aboutHundredthSign: "\u041E Hundredth Sign",
      aboutHundredthSignBody: "\u041F\u043E\u0434\u043F\u0438\u0441\u044B\u0432\u0430\u0439\u0442\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u044D\u043B\u0435\u043A\u0442\u0440\u043E\u043D\u043D\u043E \u0437\u0430 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043C\u0438\u043D\u0443\u0442. \u0411\u0435\u0437\u043E\u043F\u0430\u0441\u043D\u043E \u0438 \u044E\u0440\u0438\u0434\u0438\u0447\u0435\u0441\u043A\u0438 \u043E\u0431\u044F\u0437\u044B\u0432\u0430\u044E\u0449\u0435.",
      questions: "\u0412\u043E\u043F\u0440\u043E\u0441\u044B \u043F\u043E \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0443?",
      questionsBody: "\u0415\u0441\u043B\u0438 \u043D\u0443\u0436\u043D\u043E \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0438\u043B\u0438 \u0435\u0441\u0442\u044C \u0432\u043E\u043F\u0440\u043E\u0441\u044B, \u0441\u0432\u044F\u0436\u0438\u0442\u0435\u0441\u044C \u043D\u0430\u043F\u0440\u044F\u043C\u0443\u044E \u0441 \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u0435\u043B\u0435\u043C.",
    },
    greeting: (name) => `\u0417\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435, ${name},`,
    completeWith: (docTitle) => `\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E \u0441 Hundredth Sign: ${docTitle}`,
    thankYou: (name) => `\u0421\u043F\u0430\u0441\u0438\u0431\u043E, ${name}`,
    ccNotification: {
      subjectPrefix: "\u041A\u043E\u043F\u0438\u044F",
      body: (senderName, docTitle) => `${senderName} \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u043B "${docTitle}" \u043D\u0430 \u043F\u043E\u0434\u043F\u0438\u0441\u044C. \u0412\u044B \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u044B \u043A\u0430\u043A \u043F\u043E\u043B\u0443\u0447\u0430\u0442\u0435\u043B\u044C \u043A\u043E\u043F\u0438\u0438 (CC) \u0438 \u0431\u0443\u0434\u0435\u0442\u0435 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u044B, \u043A\u043E\u0433\u0434\u0430 \u0432\u0441\u0435 \u043F\u043E\u0434\u043F\u0438\u0441\u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u044B.`,
      button: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u0430\u043D\u0435\u043B\u044C",
    },
    plgBanner: {
      headline: "Умные контракты.",
      subtext: "Электронная подпись и управление контрактами — всё в одном. Начните бесплатно.",
      cta: "Попробовать бесплатно →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign: Приглашение в ${orgName}`,
      heading: "Приглашение в команду",
      body: (inviterName, orgName) => `${inviterName} приглашает вас присоединиться к ${orgName} в Hundredth Sign.`,
      expiry: (date) => `Это приглашение действительно до ${date}.`,
      button: "Принять приглашение",
      ignore: "Если вы не ожидали этого приглашения, просто проигнорируйте это письмо.",
    },
  },

  // ==================== Arabic (RTL) ====================
  ar: {
    signatureRequest: {
      subject: (sender, docTitle) => `Hundredth Sign: ${sender} \u0623\u0631\u0633\u0644 "${docTitle}" \u0644\u0644\u062A\u0648\u0642\u064A\u0639`,
      heading: (sender) => `${sender} \u0623\u0631\u0633\u0644 \u0644\u0643 \u0645\u0633\u062A\u0646\u062F\u064B\u0627 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0648\u0627\u0644\u062A\u0648\u0642\u064A\u0639.`,
      body: (docTitle) => `\u064A\u0631\u062C\u0649 \u0645\u0631\u0627\u062C\u0639\u0629 \u0648\u062A\u0648\u0642\u064A\u0639 \u0627\u0644\u0645\u0633\u062A\u0646\u062F "${docTitle}".`,
      button: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0645\u0633\u062A\u0646\u062F",
      messagePreamble: "\u0631\u0633\u0627\u0644\u0629 \u0645\u0646 \u0627\u0644\u0645\u0631\u0633\u0644:",
    },
    signatureComplete: {
      subject: (signer, docTitle) => `\u0627\u0643\u062A\u0645\u0644 \u0627\u0644\u062A\u0648\u0642\u064A\u0639: ${signer} \u0648\u0642\u0651\u0639 "${docTitle}"`,
      heading: "\u0627\u0643\u062A\u0645\u0644 \u0627\u0644\u062A\u0648\u0642\u064A\u0639",
      body: (signer, docTitle) => `${signer} \u0648\u0642\u0651\u0639 "${docTitle}".`,
      button: "\u0639\u0631\u0636 \u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645",
    },
    allSigned: {
      subject: (docTitle) => `\u0627\u0643\u062A\u0645\u0644\u062A \u062C\u0645\u064A\u0639 \u0627\u0644\u062A\u0648\u0642\u064A\u0639\u0627\u062A: "${docTitle}"`,
      heading: "\u0627\u0643\u062A\u0645\u0644\u062A \u062C\u0645\u064A\u0639 \u0627\u0644\u062A\u0648\u0642\u064A\u0639\u0627\u062A",
      body: (docTitle) => `\u0648\u0642\u0651\u0639 \u062C\u0645\u064A\u0639 \u0627\u0644\u0645\u0648\u0642\u0639\u064A\u0646 \u0639\u0644\u0649 "${docTitle}".`,
      button: "\u062A\u0646\u0632\u064A\u0644 PDF \u0627\u0644\u0645\u0648\u0642\u0651\u0639",
    },
    declined: {
      subject: (signer, docTitle) => `\u0631\u0641\u0636 \u0627\u0644\u062A\u0648\u0642\u064A\u0639: ${signer} \u0631\u0641\u0636 "${docTitle}"`,
      heading: "\u062A\u0645 \u0631\u0641\u0636 \u0627\u0644\u062A\u0648\u0642\u064A\u0639",
      body: (signer, docTitle) => `${signer} \u0631\u0641\u0636 \u062A\u0648\u0642\u064A\u0639 "${docTitle}".`,
      reasonLabel: "\u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636",
      button: "\u0639\u0631\u0636 \u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645",
    },
    reminder: {
      subject: (docTitle) => `\u062A\u0630\u0643\u064A\u0631: "${docTitle}" \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0648\u0642\u064A\u0639\u0643`,
      heading: "\u062A\u0630\u0643\u064A\u0631 \u0628\u0627\u0644\u062A\u0648\u0642\u064A\u0639",
      body: (docTitle) => `"${docTitle}" \u0644\u0627 \u064A\u0632\u0627\u0644 \u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0648\u0642\u064A\u0639\u0643.`,
      button: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0645\u0633\u062A\u0646\u062F",
    },
    footer: {
      doNotShare: "\u0644\u0627 \u062A\u0634\u0627\u0631\u0643 \u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A",
      doNotShareBody: "\u064A\u062D\u062A\u0648\u064A \u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0639\u0644\u0649 \u0631\u0627\u0628\u0637 \u0622\u0645\u0646 \u0625\u0644\u0649 Hundredth Sign. \u0644\u0627 \u062A\u0634\u0627\u0631\u0643 \u0647\u0630\u0627 \u0627\u0644\u0628\u0631\u064A\u062F \u0623\u0648 \u0627\u0644\u0631\u0627\u0628\u0637 \u0623\u0648 \u0631\u0645\u0632 \u0627\u0644\u0648\u0635\u0648\u0644.",
      aboutHundredthSign: "\u062D\u0648\u0644 Hundredth Sign",
      aboutHundredthSignBody: "\u0648\u0642\u0651\u0639 \u0627\u0644\u0645\u0633\u062A\u0646\u062F\u0627\u062A \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u064B\u0627 \u0641\u064A \u062F\u0642\u0627\u0626\u0642. \u0622\u0645\u0646 \u0648\u0645\u0644\u0632\u0645 \u0642\u0627\u0646\u0648\u0646\u064A\u064B\u0627.",
      questions: "\u0623\u0633\u0626\u0644\u0629 \u062D\u0648\u0644 \u0627\u0644\u0645\u0633\u062A\u0646\u062F\u061F",
      questionsBody: "\u0625\u0630\u0627 \u0643\u0646\u062A \u0628\u062D\u0627\u062C\u0629 \u0644\u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u0646\u062F \u0623\u0648 \u0644\u062F\u064A\u0643 \u0623\u0633\u0626\u0644\u0629\u060C \u062A\u0648\u0627\u0635\u0644 \u0645\u0628\u0627\u0634\u0631\u0629 \u0645\u0639 \u0627\u0644\u0645\u0631\u0633\u0644.",
    },
    greeting: (name) => `\u0645\u0631\u062D\u0628\u064B\u0627 ${name}\u060C`,
    completeWith: (docTitle) => `\u0645\u0643\u062A\u0645\u0644 \u0645\u0639 Hundredth Sign: ${docTitle}`,
    thankYou: (name) => `\u0634\u0643\u0631\u064B\u0627\u060C ${name}`,
    ccNotification: {
      subjectPrefix: "\u0646\u0633\u062E\u0629",
      body: (senderName, docTitle) => `${senderName} \u0623\u0631\u0633\u0644 "${docTitle}" \u0644\u0644\u062A\u0648\u0642\u064A\u0639. \u062A\u0645\u062A \u0625\u0636\u0627\u0641\u062A\u0643 \u0643\u0645\u0633\u062A\u0644\u0645 \u0646\u0633\u062E\u0629 (CC) \u0648\u0633\u062A\u062A\u0644\u0642\u0649 \u0625\u0634\u0639\u0627\u0631\u064B\u0627 \u0639\u0646\u062F \u0627\u0643\u062A\u0645\u0627\u0644 \u062C\u0645\u064A\u0639 \u0627\u0644\u062A\u0648\u0642\u064A\u0639\u0627\u062A.`,
      button: "\u0641\u062A\u062D \u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645",
    },
    plgBanner: {
      headline: "عقود أكثر ذكاءً",
      subtext: "التوقيع الإلكتروني وإدارة العقود الشاملة. ابدأ مجانًا.",
      cta: "جرّب مجانًا →",
    },
    invitation: {
      subject: (orgName) => `Hundredth Sign: دعوة للانضمام إلى ${orgName}`,
      heading: "دعوة الفريق",
      body: (inviterName, orgName) => `${inviterName} يدعوك للانضمام إلى ${orgName} على Hundredth Sign.`,
      expiry: (date) => `تنتهي صلاحية هذه الدعوة في ${date}.`,
      button: "قبول الدعوة",
      ignore: "إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذا البريد الإلكتروني.",
    },
  },
};
