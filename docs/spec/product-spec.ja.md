# Hundredth Sign 統合プロダクト仕様書

最終確認日: 2026-05-14

この文書は、現在の source-available + PolyForm Noncommercial セルフホスト版
Hundredth Sign の「人間が読むための」統合仕様書です。機能別・修正別の詳細仕様は
`docs/spec/` 配下に残していますが、プロダクト全体を把握したい場合はまずこの文書を
読んでください。

## 1. このプロダクトは何か

Hundredth Sign は、1つの社内ワークスペースで使うセルフホスト型の電子契約・
電子署名システムです。日本の契約業務を主対象にしつつ、外部署名者向けには
多言語メールとトークンリンクによる署名画面を提供します。

現在の source-available 版は、複数テナントを切り替える商用 SaaS ではありません。
非商用利用のみ許可され、商用利用には別途ライセンス契約が必要です。請求、プラン、
送信上限、外部顧客アカウント、テナント切替、汎用メールボックスは対象外です。

中核機能は次のとおりです。

- 社内スタッフが PDF 契約書を作成・送信・承認・署名・保管できる。
- 外部署名者はアカウント登録なしで、メールリンクから署名・辞退・委任・閲覧・
  ダウンロードできる。
- 管理者はスタッフ、インスタンス設定、API 連携キー、監査ログを管理できる。
- 電帳法対応を意識し、通常活動ログ、ハッシュチェーン付き WORM 監査ログ、
  WORM 署名済み PDF 保管を行う。
- 外部システム、CI、AI エージェントは REST API と `signctl` から安全に操作できる。

## 2. 仕様の根拠

この仕様は、次の実装ファイルを読んで整理したものです。

- 画面ルート: `client/src/App.tsx`
- ダッシュボード共通 UI: `client/src/components/DashboardLayout.tsx`
- 設定画面: `client/src/pages/OrganizationSettings.tsx`
- 文書作成: `client/src/pages/DocumentNew.tsx`
- 文書一覧・詳細: `client/src/pages/Documents.tsx`,
  `client/src/pages/DocumentDetail.tsx`
- 署名・閲覧・承認ページ: `client/src/pages/SignDocument.tsx`,
  `client/src/pages/DocumentView.tsx`, `client/src/pages/ApprovePage.tsx`
- Inbox: `client/src/pages/InboxPage.tsx`, `client/src/pages/InboxDetailPage.tsx`
- テンプレート・連絡先: `client/src/pages/Templates.tsx`,
  `client/src/pages/Contacts.tsx`
- tRPC API: `server/routers/index.ts`, `server/_core/trpc.ts`
- 外部連携 REST API: `server/integrations.ts`
- DB スキーマ: `drizzle/schema.ts`, `drizzle/*.sql`
- PDF・メール・監査・WORM: `server/pdf.ts`, `server/email.ts`,
  `server/auditLog.ts`, `server/wormStorage.ts`, `server/storage.ts`
- スケジューラー: `server/scheduler.ts`
- PDF プロキシ: `server/pdfProxy.ts`
- 共通バリデーション・ロケール: `shared/validation.ts`, `shared/locales.ts`
- CLI: `scripts/signctl.mjs`
- テスト・運用コマンド: `package.json`, `server/**/*.test.ts`,
  `client/src/**/*.test.tsx`, `e2e/*.spec.ts`

関連文書:

- 全体構成: `docs/architecture.md`
- 業務ルール: `docs/domain/business-model.md`
- データモデル: `docs/domain/data-model.md`
- 機能別仕様: `docs/spec/*.md`
- TODO: `docs/todo.md`

## 3. 利用者と権限

| 利用者 | 認証方法 | できること | 備考 |
| --- | --- | --- | --- |
| 初期管理者 | `/setup` | 最初の管理者とワークスペースを作る | ユーザーが1人もいない時だけ利用可能。 |
| 管理者 | `/login` | スタッフ管理、設定、監査ログ、API キー、文書操作 | UI 上は administrator。内部的には `users.staffRole = admin`。 |
| メンバー | `/login` | 文書、テンプレート、連絡先、Inbox、署名業務 | UI 上は member。 |
| 署名者 | メールのトークンリンク | 署名、辞退、委任、署名済み PDF の閲覧/取得 | アカウント不要。 |
| CC 受信者 | メールのトークンリンク | 文書閲覧、完了通知の受信 | アカウント不要。 |
| 社内承認者 | メールのトークンリンク | 外部署名送信前の承認・却下 | 承認順序あり。 |
| 外部連携クライアント | API キー | スコープに応じた REST API 操作 | 外部システム、CI、AI 用。 |

ユーザーに見せるスタッフ権限は「管理者」と「メンバー」の2種類です。
`memberships.role` の `owner` / `manager` / `member` は、過去互換と内部認可のための
実装詳細です。

## 4. 対象範囲

### 含まれるもの

- 1つのセルフホストワークスペース。
- ローカルメールアドレス・パスワード認証。
- 初期管理者セットアップ。
- スタッフの作成、停止、権限変更、パスワードリセット。
- PDF アップロード、PDF 検証、署名フィールド配置。
- 複数署名者、CC、順次署名ルーティング。
- 署名者ごとの任意アクセスコード。
- 署名依頼の委任。
- 外部署名前の社内承認フロー。
- 署名、日付、氏名、イニシャル、印影フィールド。
- 印影画像生成。
- 完了証明書付き署名済み PDF の生成。
- WORM 署名済み PDF 保管。
- ハッシュチェーン付き WORM 監査ログ。
- ワークフロー行から生成するスタッフ Inbox。
- テンプレート、連絡先、カテゴリ、グループ。
- 公開マニュアル、利用規約、プライバシー、問い合わせページ。
- 外部連携 REST API、Webhook、冪等性キー、`signctl` CLI。
- リマインド、期限切れ、Webhook 再送、監査整合性チェックのスケジューラー。

### 含まれないもの

- 商用 SaaS のテナント切替。
- 外部顧客アカウント。
- 請求、プラン、送信数上限、利用量課金。
- 任意メール送信機能やメール本文を保存する受信箱。
- 外部システムによる DB 直接書き込み。
- WORM レコードや WORM 監査ログの物理削除。

## 5. 画面一覧

### 公開画面

| URL | 内容 |
| --- | --- |
| `/` | ランディングページ。 |
| `/login` | スタッフログイン。 |
| `/setup` | 初期管理者作成。 |
| `/forgot-password` | パスワード再設定依頼。 |
| `/reset-password` | トークンによるパスワード再設定。 |
| `/sign/:token` | 署名者向け署名画面。 |
| `/document-view/:token` | トークンによる文書閲覧・ダウンロード。 |
| `/approve/:token` | 社内承認者向け承認・却下画面。 |
| `/terms` | 利用規約。 |
| `/privacy` | プライバシーポリシー。 |
| `/manual` | マニュアル。 |
| `/manual/:chapter` | マニュアル各章。 |
| `/manual/terms` | source-available 版向け利用条件。 |
| `/manual/disclaimer` | 免責事項。 |
| `/contact` | カスタマイズ相談ページ。 |
| `/404` | Not Found。 |

### ログイン後画面

| URL | 内容 |
| --- | --- |
| `/dashboard` | 統計と最近の活動。 |
| `/dashboard/documents` | 文書一覧、絞り込み、リマインド、各種操作。 |
| `/dashboard/documents/new` | 文書作成、PDF アップロード、フィールド配置、送信。 |
| `/dashboard/documents/:id` | 文書詳細、署名者、活動ログ、署名済み PDF、無効化。 |
| `/dashboard/inbox` | スタッフ向け疑似 Inbox。 |
| `/dashboard/inbox/:kind/:id` | Inbox の詳細表示。 |
| `/dashboard/contacts` | 連絡先、カテゴリ、グループ管理。 |
| `/dashboard/templates` | テンプレート管理。 |
| `/dashboard/settings` | プロフィール、パスワード、インスタンス、スタッフ、API 連携、監査ログ。 |
| `/dashboard/organization` | 設定画面への別名。 |
| `/dashboard/audit-log` | 監査ログタブへの別名。 |

## 6. 認証とセッション

- スタッフ認証は DB に保存されたメールアドレス・パスワードで行う。
- セッション Cookie 名は `app_session_id`。
- セッション有効期限は 24 時間。
- `/setup` はユーザーが存在しない初期状態のみ有効。
- 初期管理者作成時に、最初のユーザー、ワークスペース、内部 membership を作る。
- パスワードはハッシュ化して保存する。
- パスワードリセットトークンはハッシュ化し、有効期限と使用済み日時を管理する。
- 無効化されたスタッフはログインできない。
- 管理者専用 API は `staffRole = admin` または `isSuperAdmin` を要求する。
- ワークスペーススコープ API は membership と任意の IP 制限を確認する。

## 7. 文書ワークフロー

### 文書ステータス

```text
draft -> pending_internal_approval -> sent -> completed
draft -> sent -> declined | voided | expired
```

### 署名依頼ステータス

```text
pending -> sent -> viewed -> signed
pending -> sent -> viewed -> declined
pending -> sent -> expired
```

### 社内承認ステータス

```text
pending -> approved
pending -> rejected
```

## 8. 文書作成と送信

文書は直接作成するか、テンプレートから作成できます。

PDF アップロード条件:

- MIME type は `application/pdf`。
- ファイル名は `.pdf`。
- 最大 20 MB。
- サーバー側で `%PDF-` マジックナンバーを確認する。
- サーバー側で PDF として読み込めること、ページ数を確認する。

署名フィールド:

- 座標はページに対する割合で保存する。
- `page` は 0 始まり。
- `signerIndex` で署名者に紐づける。
- 種類は `signature`, `date`, `name`, `initials`, `stamp`。
- 送信前に、署名が必要な署名者それぞれにフィールドが必要。

送信時の流れ:

1. 署名者・CC の `signatureRequests` を作る。
2. 社内承認がなければ文書を `sent` にする。
3. 順次署名が無効なら全署名者に送信する。
4. 順次署名が有効なら最初の署名者と CC に送信する。
5. 社内承認がある場合は文書を `pending_internal_approval` にし、最初の承認者へ送る。
6. 活動ログと WORM 監査ログを記録する。

## 9. 署名・辞退・委任

署名者は `/sign/:token` から文書を開きます。

署名時:

- トークンから署名依頼と文書を解決する。
- 必要ならアクセスコードを確認する。
- 閲覧時にステータスを `viewed` にする。
- 手書き署名、タイプ署名、印影を受け付ける。
- IP アドレス、User-Agent、署名日時、署名データ、印影データを記録する。
- 活動ログ、WORM 監査ログ、外部連携イベントを記録する。

全署名完了時:

1. 文書を `completed` にする。
2. PDF に署名、日付、氏名、イニシャル、印影を埋め込む。
3. 完了証明書ページを追加する。
4. 必要に応じてプラットフォーム署名と PDF 権限制限を適用する。
5. 最終 PDF を WORM ストレージに保存する。
6. 文書に署名済み PDF の情報を保存する。
7. 署名者と CC に完了メールを送る。

辞退時:

- 辞退理由は必須。
- 署名依頼を `declined`、文書を `declined` にする。
- 通知メール、活動ログ、WORM 監査ログ、外部連携イベントを記録する。

委任時:

- 署名者は別のメールアドレス・名前へ依頼を委任できる。
- 委任先、委任日時を記録する。
- 委任先へメールリンクを送る。
- 委任は監査ログに残す。

## 10. 社内承認

社内承認は、外部署名に進む前の順序付き承認フローです。

- 文書送信前に承認者を設定できる。
- 承認者にはトークンリンクを送る。
- 承認すると次の承認者へ進む。
- 全員承認すると外部署名者への送信が始まる。
- 却下すると承認行は `rejected`、文書は `draft` に戻る。
- 却下理由はコメントとして保存する。
- 承認 URL には `?lng=<locale>` を付ける。

## 11. スタッフ Inbox

Inbox はメールボックスではありません。既存のワークフロー行から作る疑似 Inbox です。

元データ:

- `signatureRequests`
- `internalApprovals`

できること:

- 自分宛の署名依頼、CC 通知、社内承認を一覧できる。
- 対応が必要な件数を表示できる。
- 詳細画面から署名、文書閲覧、承認画面へ移動できる。

できないこと:

- 任意メール作成。
- 既読/未読管理。
- メール HTML 本文の保存。
- 外部署名者向けアカウント Inbox。

## 12. テンプレート

テンプレートは、PDF と署名フィールド定義を再利用するための機能です。

- テンプレートの作成、編集、削除、一覧表示ができる。
- PDF アップロードは文書と同じ検証を受ける。
- フィールド座標は割合で保存する。
- テンプレートから文書を作ると、フィールド定義を文書へコピーする。
- 利用回数を記録する。
- 署名者数、カテゴリ、デフォルト期限、リマインド日数を持てる。

## 13. 連絡先

連絡先はワークスペース共通のアドレス帳です。

- 連絡先の作成、編集、削除、一覧表示ができる。
- 名前、メール、会社、部署、電話、メモ、カテゴリを保存する。
- カテゴリを作成、編集、削除できる。
- グループを作成、編集、削除できる。
- 連絡先は複数グループに所属できる。

## 14. 監査・WORM・電帳法対応

### 通常活動ログ

`activityLogs` は文書操作の通常履歴です。文書詳細やダッシュボードで使います。

### WORM 監査ログ

`systemAuditLogs` は改ざん検知用のハッシュチェーン付き監査ログです。

記録する主な情報:

- イベント種別
- 対象エンティティ
- ワークスペース
- 実行者
- IP アドレス
- User-Agent
- メタデータ
- 前レコードのハッシュ
- 自レコードのハッシュ
- サーバー時刻

### WORM 署名済み PDF

`worm_records` は署名済み PDF の不変保管レジストリです。

- ストレージキーは一意。
- 内容ハッシュとファイルサイズを記録する。
- 上書きと削除は禁止。
- AES-256-GCM による保存時暗号化を任意で利用できる。
- 暗号化 PDF は `/api/pdf-proxy/:encodedKey?token=<hmac>` から短命トークンで配信する。

## 15. メールと言語

メール種別:

- 署名依頼
- 署名完了
- 全員署名完了
- 辞退通知
- リマインド
- パスワード再設定
- スタッフ招待

言語仕様:

- スタッフの UI 言語は `users.locale`。
- 署名者のメール/ページ言語は `signatureRequests.locale`。
- 承認者のメール/ページ言語は `internalApprovals.locale`。
- 署名・承認 URL には `?lng=<locale>` を付ける。
- 署名/承認ページは URL の `?lng` を最優先する。
- UI 翻訳ファイルは `client/public/locales` にある。
- 対応ロケールは `shared/locales.ts` で管理する。

メール送信:

- AWS SES を利用できる。
- SMTP を利用できる。
- 送信結果は `emailLogs` に記録する。

## 16. 外部連携 API

外部システムが Sign を操作する正式な境界は REST API です。
外部システムが DB を直接更新してはいけません。

認証:

- API は `/api/integrations/*` 配下。
- `Authorization: Bearer <api key>` が必須。
- API キーは `hsign_sk_` で始まる。
- DB にはハッシュだけを保存する。
- キーにはスコープ、有効期限、失効状態がある。
- デフォルト有効期限は 90 日、最大 365 日。

スコープ:

- `documents:read`
- `documents:write`
- `documents:send`
- `documents:download`
- `webhooks:manage`
- `api_keys:manage`

主なエンドポイント:

| Endpoint | 用途 |
| --- | --- |
| `POST /api/integrations/documents` | 下書き文書を作成する。 |
| `POST /api/integrations/documents/:id/pdf` | PDF をアップロードする。 |
| `POST /api/integrations/documents/:id/template` | テンプレートを適用する。 |
| `POST /api/integrations/documents/:id/send` | 署名者・CC へ送信する。 |
| `GET /api/integrations/documents/:id` | 文書状態を取得する。 |
| `GET /api/integrations/documents/by-external/:system/:entityType/:entityId` | 外部参照から文書を探す。 |
| `POST /api/integrations/documents/:id/void` | 文書を無効化する。 |
| `GET /api/integrations/documents/:id/signed-download-url` | 完了後の署名済み PDF URL を取得する。 |
| `GET /api/integrations/api-keys` | API キー一覧を取得する。 |
| `POST /api/integrations/api-keys` | API キーを作成する。 |
| `POST /api/integrations/api-keys/:id/revoke` | API キーを失効する。 |
| `GET /api/integrations/webhooks` | Webhook 一覧を取得する。 |
| `POST /api/integrations/webhooks` | Webhook を作成する。 |
| `POST /api/integrations/webhooks/:id/test` | Webhook テスト送信を行う。 |

冪等性:

- 更新系 API は `Idempotency-Key` を受け付ける。
- 同じ API キー、メソッド、パス、本文なら保存済み 2xx レスポンスを再返却する。
- 同じキーで内容が違う場合は競合エラーにする。
- 保存期間は 7 日。

Webhook:

- JSON 本文でイベント種別、payload、配信時刻を送る。
- `x-hundredth-sign-event` と `x-hundredth-sign-signature` ヘッダーを付ける。
- 失敗した配信はスケジューラーが再送する。

## 17. CLI

`signctl` は運用者、CI、AI エージェント向けの CLI です。

主な環境変数:

- `SIGN_BASE_URL`
- `SIGN_API_KEY`
- `SIGN_OUTPUT`
- `DATABASE_URL`

主なコマンド:

- `documents create`
- `documents upload-pdf`
- `documents apply-template`
- `documents send`
- `documents status`
- `documents by-external`
- `documents void`
- `documents wait`
- `documents download-signed`
- `api-keys create`
- `api-keys list`
- `api-keys revoke`
- `webhooks create`
- `webhooks list`
- `webhooks test`

`--json` を使うと機械可読な出力になります。対応コマンドでは `--dry-run` で
実際に API を呼ばずにリクエスト内容を確認できます。

## 18. DB テーブル概要

正本は `drizzle/schema.ts` です。

| 領域 | テーブル |
| --- | --- |
| 認証 | `users`, `password_reset_tokens` |
| ワークスペース | `organizations`, `memberships`, `allowed_ips` |
| 文書 | `documents`, `signatureFields`, `signatureRequests`, `internalApprovals` |
| テンプレート | `templates`, `templateFields` |
| 連絡先 | `contacts`, `contact_categories`, `contact_groups`, `contact_group_members` |
| 運用 | `activityLogs`, `emailLogs`, `faqs`, `inquiries` |
| コンプライアンス | `system_audit_logs`, `worm_records` |
| 外部連携 | `integration_api_keys`, `integration_webhooks`, `integration_webhook_deliveries`, `integration_idempotency_keys` |

重要な一意制約:

- `users.email`
- `memberships(userId, organizationId)`
- `documents(organizationId, externalSystem, externalEntityType, externalEntityId)`
- `worm_records.storageKey`
- `integration_api_keys.keyHash`
- `integration_idempotency_keys(organizationId, apiKeyId, idempotencyKey)`
- `contact_group_members(contactId, groupId)`

## 19. 実行環境

技術スタック:

- Frontend: React 19, Vite, Tailwind, Radix UI, Wouter, TanStack Query, tRPC
- Backend: Express, tRPC, Drizzle ORM
- Database: MySQL
- PDF: `pdf-lib`, fontkit, optional platform signing
- Storage: ローカル開発用保存先、外部オブジェクト/プロキシストレージ
- Email: AWS SES または SMTP
- Rate limit: インメモリまたは Redis

必須環境変数:

- `DATABASE_URL`
- 32 文字以上のランダムな `JWT_SECRET`
- HTTP(S) URL として妥当な `APP_URL` または `VITE_APP_URL`

重要な任意環境変数:

- `PORT`
- `DB_SSL`
- `TRUST_PROXY`
- `REDIS_URL`
- `AWS_SES_ACCESS_KEY_ID`
- `AWS_SES_SECRET_ACCESS_KEY`
- `AWS_SES_REGION`
- `SES_FROM_EMAIL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`
- `STORAGE_ENCRYPTION_KEY`
- `STORAGE_ENCRYPTION_KEY_PREV`
- `PII_ENCRYPTION_KEY`
- `PII_ENCRYPTION_KEY_PREV`
- `PLATFORM_SIGNING_P12`
- `PLATFORM_SIGNING_PASSPHRASE`
- `MAINTENANCE_MODE`
- `MAINTENANCE_BYPASS_SECRET`
- `MAINTENANCE_ALLOWED_IPS`
- `MAINTENANCE_RETRY_AFTER`
- `SIGN_BASE_URL`
- `SIGN_API_KEY`
- `SIGN_OUTPUT`

起動時:

- `checkMigrations()` が先に走る。
- 未適用 migration やハッシュ不一致があると起動しない。
- 開発環境では Vite middleware を使う。
- 本番環境ではビルド済み静的ファイルを配信する。
- デフォルトポートは 3000。空いていなければ後続ポートを使う。

## 20. 完了確認

通常の変更完了前に実行する標準コマンド:

```bash
pnpm test
pnpm check
```

変更種別ごとの追加確認:

| 変更種別 | 追加確認 |
| --- | --- |
| DB / migration | `pnpm db:push` または対象 DB への migration 実行。`docs/domain/data-model.md` も更新。 |
| PDF / 署名 | `server/pdf*.test.ts`, `server/routers*.test.ts`, 署名 E2E。 |
| 署名/承認 UI | `/sign/:token`, `/document-view/:token`, `/approve/:token` のブラウザ確認。 |
| i18n / メール | `server/email*.test.ts`, `server/shared-locales.test.ts`。 |
| 外部連携 / CLI | `pnpm signctl -- --help --json`, `server/integrations.test.ts`。 |
| 監査 / WORM | `server/auditLog*.test.ts`, `server/wormStorage.test.ts`。 |
| E2E | Docker と `.env.e2e` がある場合に `pnpm test:e2e:*`。 |

## 21. 今後のドキュメント注意点

- 新規文書は UTF-8 の正しい日本語または英語で書いてください。
- `docs/spec/product-spec.md` は実装参照向けの英語版です。
- この `docs/spec/product-spec.ja.md` は人間向けの日本語版です。
- 運用者向けセットアップガイドは `docs/setup.md`、日々の開発手順は `docs/local-dev.md` を参照してください。

## 22. 変更ルール

- 実装前に `docs/architecture.md` と関連する `docs/spec/*.md` を読む。
- `drizzle/schema.ts` を変更したら `docs/domain/data-model.md` も更新する。
- プロダクト全体の挙動、画面、API、運用、監査に影響する変更はこの文書も更新する。
- `activityLogs` / `systemAuditLogs` への記録を削除しない。
- source-available 版の境界を変更しない限り、請求、テナント切替、外部顧客アカウントを戻さない。
- 外部システムを DB に直結させず、API、Webhook、CLI を使う。
