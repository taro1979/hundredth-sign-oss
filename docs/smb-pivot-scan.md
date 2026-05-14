# SMBピボット スキャン結果

## 削除対象コンポーネント（架空実績・ダミーロゴ）
- TrustSection.tsx: 「10億人以上」「160万社」「稼働率99.99%」「ダウンタイムゼロ」→ 全削除
- CaseStudies.tsx: 「日経225社の80%」架空事例 → 全削除
- CLMSection.tsx: DocuSign CLM宣伝 → 全削除
- CTASection.tsx: DocuSign IAM宣伝 → 全削除
- WhyDocusign.tsx: DocuSign名称 → リライト or 削除
- SolutionsSection.tsx: DocuSignソリューション → リライト or 削除

## DocuSign残存箇所
- Header.tsx: 営業導線、電話番号
- Footer.tsx: © Docusign, Inc. 2026
- HeroSection.tsx: 確認要
- email.ts: DocuSign JP → Hundredth Sign
- 20言語のlocalesファイル: whyDocusign等のキー
- ApprovePage.tsx, DocumentView.tsx, SignDocument.tsx: Docusignブランド名
- lib/images.ts, lib/i18n.ts: DocuSign JPコメント

## 営業導線削除対象
- Header.tsx: 「購入のお問い合わせ 03-4588-5476」「営業に問い合わせる」

## ダッシュボード実在機能
- /dashboard: ダッシュボード
- /dashboard/documents: 文書一覧
- /dashboard/documents/new: 新規文書作成
- /dashboard/contacts: 連絡先
- /dashboard/templates: テンプレート
- /dashboard/organization: 法人管理
- /dashboard/audit-log: 監査ログ
