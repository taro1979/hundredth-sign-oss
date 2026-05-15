import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function formatDate(value?: Date | string | number | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function copyText(value: string) {
  navigator.clipboard?.writeText(value).then(
    () => toast.success("コピーしました"),
    () => toast.error("コピーできませんでした"),
  );
}

const INTEGRATION_SCOPES = [
  "documents:read",
  "documents:write",
  "documents:send",
  "documents:download",
  "webhooks:manage",
  "api_keys:manage",
] as const;

type IntegrationScope = (typeof INTEGRATION_SCOPES)[number];

const INTEGRATION_SCOPE_LABELS: Record<IntegrationScope, string> = {
  "documents:read": "文書の参照",
  "documents:write": "文書の作成・更新",
  "documents:send": "署名依頼の送信",
  "documents:download": "署名済みPDFの取得",
  "webhooks:manage": "Webhook管理",
  "api_keys:manage": "APIキー管理",
};

const AUDIT_EVENT_LABELS: Record<string, string> = {
  "document.created": "文書を作成しました",
  "document.uploaded": "PDFをアップロードしました",
  "document.sent": "署名依頼を送信しました",
  "document.viewed": "文書を閲覧しました",
  "document.completed": "署名が完了しました",
  "document.voided": "文書を無効化しました",
  "document.deleted": "文書を削除しました",
  "signature.viewed": "署名ページを閲覧しました",
  "signature.signed": "署名が完了しました",
  "signature.declined": "署名を拒否しました",
  "signature.reminded": "リマインダーを送信しました",
  "auth.email_verified": "メール認証が完了しました",
  "auth.access_code_verified": "アクセスコード認証が完了しました",
  "pdf.signed": "PDFに署名しました",
  "pdf.stored_worm": "PDFを改ざん防止保管しました",
  "pdf.certificate_appended": "証明書を付与しました",
  "org.created": "組織を作成しました",
  "org.updated": "組織を更新しました",
  "approval.requested": "承認を依頼しました",
  "approval.approved": "承認しました",
  "approval.rejected": "承認を拒否しました",
  "integration.api_key.created": "APIキーを作成しました",
  "integration.api_key.revoked": "APIキーを失効しました",
  "integration.webhook.created": "Webhookを作成しました",
  "integration.webhook.tested": "Webhookをテストしました",
  "integrity.chain_broken": "監査ログの改ざんが検出されました",
};

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  document: "文書",
  signature_request: "署名依頼",
  internal_approval: "社内承認",
  user: "ユーザー",
  organization: "組織",
  template: "テンプレート",
  worm_record: "WORMレコード",
  integration_api_key: "APIキー",
  integration_webhook: "Webhook",
};

function formatAuditEvent(eventType: string | null | undefined) {
  if (!eventType) return "記録なし";
  return AUDIT_EVENT_LABELS[eventType] ?? `未分類の操作: ${eventType}`;
}

function formatAuditEntity(entityType: string | null | undefined, entityId: number | null | undefined) {
  if (!entityType) return "記録なし";
  const label = AUDIT_ENTITY_LABELS[entityType] ?? entityType;
  return entityId ? `${label} #${entityId}` : label;
}

function formatAuditActor(actorEmail: string | null | undefined, actorUserId: number | null | undefined) {
  if (actorEmail) return actorEmail;
  if (actorUserId) return `ユーザー #${actorUserId}`;
  return "記録なし";
}

function formatAuditIp(ipAddress: string | null | undefined) {
  return ipAddress || "記録なし";
}

export default function OrganizationSettings() {
  const { user, refresh } = useAuth();
  const utils = trpc.useUtils();
  const [auditPage, setAuditPage] = useState(1);

  const isAdmin = Boolean(user?.isSuperAdmin || user?.staffRole === "admin");

  const { data: orgs } = trpc.organization.list.useQuery(undefined, { retry: false });
  const org = orgs?.[0]?.org;

  const { data: staff = [], isLoading: staffLoading } = trpc.user.listStaff.useQuery(undefined, {
    enabled: isAdmin,
  });

  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = trpc.auditLog.list.useQuery(
    { page: auditPage, pageSize: 12 },
    { enabled: isAdmin },
  );
  const { data: auditCount } = trpc.auditLog.count.useQuery(undefined, { enabled: isAdmin });
  const { data: certificateInfo } = trpc.auditLog.certificateInfo.useQuery(undefined, {
    enabled: isAdmin,
  });
  const { data: integrationApiKeys = [], isLoading: integrationKeysLoading } =
    trpc.organization.listIntegrationApiKeys.useQuery(undefined, { enabled: isAdmin });

  const totalAuditPages = Math.max(1, Math.ceil((auditData?.total ?? 0) / 12));

  const verifyAudit = trpc.auditLog.verifyIntegrity.useMutation({
    onSuccess: (result) => {
      if (result.isIntact) {
        toast.success(`監査ログの整合性を確認しました。検証済み: ${result.verifiedRecords}件`);
      } else {
        toast.error(`監査ログのハッシュチェーンが破損しています。ID: ${result.brokenAt}`);
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const [profileName, setProfileName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [instanceName, setInstanceName] = useState(org?.name ?? "Hundredth Sign");
  const [integrationKeyName, setIntegrationKeyName] = useState("");
  const [integrationKeyScopes, setIntegrationKeyScopes] = useState<IntegrationScope[]>([
    "documents:read",
    "documents:write",
    "documents:send",
    "documents:download",
  ]);
  const [integrationKeyExpiresInDays, setIntegrationKeyExpiresInDays] = useState(90);
  const [newIntegrationKey, setNewIntegrationKey] = useState<string | null>(null);

  useEffect(() => {
    setProfileName(user?.name ?? "");
  }, [user?.id, user?.name]);

  useEffect(() => {
    setInstanceName(org?.name ?? "Hundredth Sign");
  }, [org?.id, org?.name]);

  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: async () => {
      toast.success("プロフィールを更新しました");
      await refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const changePassword = trpc.user.changePassword.useMutation({
    onSuccess: () => {
      toast.success("パスワードを変更しました");
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateInstance = trpc.organization.update.useMutation({
    onSuccess: async () => {
      toast.success("アプリ設定を更新しました");
      await utils.organization.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const createIntegrationApiKey = trpc.organization.createIntegrationApiKey.useMutation({
    onSuccess: async (result) => {
      setNewIntegrationKey(result.apiKey);
      setIntegrationKeyName("");
      toast.success("APIキーを作成しました");
      await utils.organization.listIntegrationApiKeys.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const revokeIntegrationApiKey = trpc.organization.revokeIntegrationApiKey.useMutation({
    onSuccess: async () => {
      toast.success("APIキーを失効しました");
      await utils.organization.listIntegrationApiKeys.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const toggleIntegrationScope = (scope: IntegrationScope, checked: boolean) => {
    setIntegrationKeyScopes((current) => {
      if (checked) return current.includes(scope) ? current : [...current, scope];
      return current.filter((item) => item !== scope);
    });
  };

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">設定</h1>
          <p className="text-sm text-slate-500">
            セルフホスト版 Hundredth Sign のアカウント、スタッフ、監査ログを管理します。
          </p>
        </div>

        <Tabs defaultValue="profile" className="gap-4">
          <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
            <TabsTrigger value="profile">アカウント</TabsTrigger>
            <TabsTrigger value="users">ユーザー管理</TabsTrigger>
            <TabsTrigger value="app">アプリ設定</TabsTrigger>
            <TabsTrigger value="integrations">API連携</TabsTrigger>
            <TabsTrigger value="audit">監査ログ</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserCog className="h-5 w-5 text-emerald-600" />
                  プロフィール
                </CardTitle>
                <CardDescription>
                  文書送信者として表示される名前と、ログインパスワードを管理します。
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-2">
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    updateProfile.mutate({ name: profileName });
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="profile-name">表示名</Label>
                    <Input
                      id="profile-name"
                      value={profileName}
                      onChange={(event) => setProfileName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>メールアドレス</Label>
                    <Input value={user?.email ?? ""} disabled />
                  </div>
                  <Button type="submit" disabled={updateProfile.isPending || !profileName.trim()}>
                    {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    保存
                  </Button>
                </form>

                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    changePassword.mutate({ currentPassword, newPassword });
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="current-password">現在のパスワード</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">新しいパスワード</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-slate-500">10文字以上で設定してください。</p>
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={changePassword.isPending || !currentPassword || newPassword.length < 10}
                  >
                    {changePassword.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    パスワード変更
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <UserManagement
              staff={staff}
              currentUserId={user?.id}
              isAdmin={isAdmin}
              isLoading={staffLoading}
            />
          </TabsContent>

          <TabsContent value="app">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  アプリ設定
                </CardTitle>
                <CardDescription>
                  source-available 版では単一ワークスペースとして動作します。ここではこのインスタンスの表示名だけを管理します。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="max-w-xl space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    updateInstance.mutate({ name: instanceName });
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="instance-name">インスタンス名</Label>
                    <Input
                      id="instance-name"
                      value={instanceName}
                      onChange={(event) => setInstanceName(event.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={!isAdmin || updateInstance.isPending || !instanceName.trim()}>
                    {updateInstance.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    保存
                  </Button>
                  {!isAdmin && (
                    <p className="text-sm text-slate-500">管理者のみ変更できます。</p>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <KeyRound className="h-5 w-5 text-emerald-600" />
                      API連携
                    </CardTitle>
                    <CardDescription>
                      外部システムやCLIから Hundredth Sign を操作するための期限付きAPIキーを管理します。
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => utils.organization.listIntegrationApiKeys.invalidate()} disabled={!isAdmin || integrationKeysLoading}>
                    <RefreshCw className={`h-4 w-4 ${integrationKeysLoading ? "animate-spin" : ""}`} />
                    更新
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {!isAdmin ? (
                  <p className="text-sm text-slate-500">API連携は管理者のみ利用できます。</p>
                ) : (
                  <>
                    {newIntegrationKey && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                          <div className="flex-1 space-y-2">
                            <Label htmlFor="new-integration-key">作成されたAPIキー</Label>
                            <Input id="new-integration-key" value={newIntegrationKey} readOnly className="font-mono text-xs" />
                            <p className="text-xs text-emerald-700">この値は再表示できません。必要な場所へ登録してください。</p>
                          </div>
                          <Button type="button" variant="outline" onClick={() => copyText(newIntegrationKey)}>
                            <Copy className="h-4 w-4" />
                            コピー
                          </Button>
                        </div>
                      </div>
                    )}

                    <form
                      className="grid gap-4 lg:grid-cols-[1fr_160px_auto]"
                      onSubmit={(event) => {
                        event.preventDefault();
                        createIntegrationApiKey.mutate({
                          name: integrationKeyName,
                          scopes: integrationKeyScopes,
                          expiresInDays: integrationKeyExpiresInDays,
                        });
                      }}
                    >
                      <div className="space-y-2">
                        <Label htmlFor="integration-key-name">キー名</Label>
                        <Input
                          id="integration-key-name"
                          value={integrationKeyName}
                          onChange={(event) => setIntegrationKeyName(event.target.value)}
                          placeholder="leaseback-automation"
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="integration-key-expiry">有効日数</Label>
                        <Input
                          id="integration-key-expiry"
                          type="number"
                          min={1}
                          max={365}
                          value={integrationKeyExpiresInDays}
                          onChange={(event) => setIntegrationKeyExpiresInDays(Number(event.target.value))}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="submit"
                          disabled={createIntegrationApiKey.isPending || !integrationKeyName.trim() || integrationKeyScopes.length === 0}
                          className="w-full"
                        >
                          {createIntegrationApiKey.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                          作成
                        </Button>
                      </div>
                      <div className="lg:col-span-3">
                        <Label>権限スコープ</Label>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {INTEGRATION_SCOPES.map((scope) => (
                            <label key={scope} className="flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                              <Checkbox
                                checked={integrationKeyScopes.includes(scope)}
                                onCheckedChange={(checked) => toggleIntegrationScope(scope, checked === true)}
                              />
                              <span>{INTEGRATION_SCOPE_LABELS[scope]}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </form>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>名前</TableHead>
                          <TableHead>プレフィックス</TableHead>
                          <TableHead>権限</TableHead>
                          <TableHead>有効期限</TableHead>
                          <TableHead>最終利用</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {integrationKeysLoading && (
                          <TableRow>
                            <TableCell colSpan={6}>
                              <div className="flex items-center gap-2 py-6 text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                読み込み中
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        {!integrationKeysLoading && integrationApiKeys.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="py-6 text-slate-500">
                              APIキーはまだありません。
                            </TableCell>
                          </TableRow>
                        )}
                        {integrationApiKeys.map((apiKey) => (
                          <TableRow key={apiKey.id}>
                            <TableCell className="font-medium">{apiKey.name}</TableCell>
                            <TableCell className="font-mono text-xs">{apiKey.keyPrefix}</TableCell>
                            <TableCell>
                              <div className="flex max-w-md flex-wrap gap-1">
                                {apiKey.scopes.map((scope) => (
                                  <Badge key={scope} variant="secondary">{scope}</Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(apiKey.expiresAt)}</TableCell>
                            <TableCell>{formatDate(apiKey.lastUsedAt)}</TableCell>
                            <TableCell className="text-right">
                              {apiKey.revokedAt ? (
                                <Badge variant="outline">失効済み</Badge>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => revokeIntegrationApiKey.mutate({ id: apiKey.id, confirm: true })}
                                  disabled={revokeIntegrationApiKey.isPending}
                                >
                                  失効
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Activity className="h-5 w-5 text-emerald-600" />
                      監査ログ
                    </CardTitle>
                    <CardDescription>
                      文書・署名・認証に関する WORM 監査ログを確認します。
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => refetchAudit()} disabled={!isAdmin || auditLoading}>
                      <RefreshCw className={`h-4 w-4 ${auditLoading ? "animate-spin" : ""}`} />
                      更新
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => verifyAudit.mutate()} disabled={!isAdmin || verifyAudit.isPending}>
                      {verifyAudit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      整合性確認
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isAdmin ? (
                  <p className="text-sm text-slate-500">監査ログは管理者のみ閲覧できます。</p>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border bg-white p-3">
                        <p className="text-xs text-slate-500">総件数</p>
                        <p className="mt-1 text-xl font-semibold">{auditCount?.count ?? 0}</p>
                      </div>
                      <div className="rounded-lg border bg-white p-3">
                        <p className="text-xs text-slate-500">証明書</p>
                        <p className="mt-1 truncate text-sm font-medium">{certificateInfo?.subject ?? "-"}</p>
                      </div>
                      <div className="rounded-lg border bg-white p-3">
                        <p className="text-xs text-slate-500">証明書種別</p>
                        <p className="mt-1 text-sm font-medium">
                          {certificateInfo?.isAutoGenerated ? "自己署名" : certificateInfo ? "外部CA" : "-"}
                        </p>
                      </div>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>日時</TableHead>
                          <TableHead>イベント</TableHead>
                          <TableHead>対象</TableHead>
                          <TableHead>実行者</TableHead>
                          <TableHead>IP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLoading && (
                          <TableRow>
                            <TableCell colSpan={5}>
                              <div className="flex items-center gap-2 py-6 text-slate-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                読み込み中
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        {!auditLoading && (auditData?.logs ?? []).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="py-6 text-slate-500">
                              監査ログはまだありません。
                            </TableCell>
                          </TableRow>
                        )}
                        {(auditData?.logs ?? []).map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell>{formatDate(log.serverTimestamp)}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{formatAuditEvent(log.eventType)}</Badge>
                            </TableCell>
                            <TableCell>{formatAuditEntity(log.entityType, log.entityId)}</TableCell>
                            <TableCell>{formatAuditActor(log.actorEmail, log.actorUserId)}</TableCell>
                            <TableCell className="font-mono text-xs">{formatAuditIp(log.ipAddress)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-500">
                        {auditPage} / {totalAuditPages} ページ
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={auditPage <= 1}
                          onClick={() => setAuditPage((page) => Math.max(1, page - 1))}
                        >
                          前へ
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={auditPage >= totalAuditPages}
                          onClick={() => setAuditPage((page) => Math.min(totalAuditPages, page + 1))}
                        >
                          次へ
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export function UserManagement({
  staff,
  currentUserId,
  isAdmin,
  isLoading,
}: {
  staff: Array<{
    id: number;
    email: string | null;
    name: string | null;
    staffRole: "admin" | "member";
    isActive: boolean;
    mustChangePassword: boolean;
    lastSignedIn: Date | string | null;
    createdAt: Date | string | null;
  }>;
  currentUserId?: number;
  isAdmin: boolean;
  isLoading: boolean;
}) {
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [staffRole, setStaffRole] = useState<"admin" | "member">("member");
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const createStaff = trpc.user.createStaff.useMutation({
    onSuccess: async (result) => {
      setTemporaryPassword(result.temporaryPassword);
      setEmail("");
      setName("");
      setStaffRole("member");
      toast.success("スタッフアカウントを作成しました");
      await utils.user.listStaff.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateStaff = trpc.user.updateStaff.useMutation({
    onSuccess: async () => {
      toast.success("ユーザーを更新しました");
      await utils.user.listStaff.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const resetPassword = trpc.user.resetStaffPassword.useMutation({
    onSuccess: async (result) => {
      setTemporaryPassword(result.temporaryPassword);
      toast.success("仮パスワードを再発行しました");
      await utils.user.listStaff.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const activeUsers = useMemo(() => staff.filter(user => user.isActive).length, [staff]);

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ユーザー管理</CardTitle>
          <CardDescription>ユーザー管理は管理者のみ利用できます。</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-emerald-600" />
                ユーザー管理
              </CardTitle>
              <CardDescription>
                スタッフのID/PASSを発行します。契約書を受け取るカスタマーはアカウント不要です。
              </CardDescription>
            </div>
            <Badge variant="outline">有効 {activeUsers} / 全 {staff.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            className="grid gap-3 lg:grid-cols-[1fr_1fr_160px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              createStaff.mutate({ email, name, staffRole });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="staff-email">メールアドレス</Label>
              <Input
                id="staff-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-name">名前</Label>
              <Input
                id="staff-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-role">権限</Label>
              <select
                id="staff-role"
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={staffRole}
                onChange={(event) => setStaffRole(event.target.value as "admin" | "member")}
              >
                <option value="member">メンバー</option>
                <option value="admin">管理者</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={createStaff.isPending || !email.trim() || !name.trim()}
                className="w-full"
              >
                {createStaff.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                発行
              </Button>
            </div>
          </form>

          {temporaryPassword && (
            <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-amber-950">仮パスワード</p>
                <p className="mt-1 font-mono text-sm text-amber-950">{temporaryPassword}</p>
                <p className="mt-1 text-xs text-amber-800">
                  メール送信設定が未完了でも、この値をスタッフへ共有すればログインできます。
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => copyText(temporaryPassword)}>
                <Copy className="h-4 w-4" />
                コピー
              </Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ユーザー</TableHead>
                <TableHead>権限</TableHead>
                <TableHead>状態</TableHead>
                <TableHead>最終ログイン</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="flex items-center gap-2 py-6 text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      読み込み中
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-slate-500">
                    ユーザーがまだありません。
                  </TableCell>
                </TableRow>
              )}
              {staff.map((staffUser) => (
                <TableRow key={staffUser.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{staffUser.name || "-"}</p>
                      <p className="text-xs text-slate-500">{staffUser.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <select
                      className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                      value={staffUser.staffRole}
                      onChange={(event) =>
                        updateStaff.mutate({
                          userId: staffUser.id,
                          staffRole: event.target.value as "admin" | "member",
                        })
                      }
                    >
                      <option value="member">メンバー</option>
                      <option value="admin">管理者</option>
                    </select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={staffUser.isActive}
                        disabled={staffUser.id === currentUserId || updateStaff.isPending}
                        onCheckedChange={(checked) =>
                          updateStaff.mutate({ userId: staffUser.id, isActive: checked })
                        }
                      />
                      <Badge variant={staffUser.isActive ? "secondary" : "outline"}>
                        {staffUser.isActive ? "有効" : "無効"}
                      </Badge>
                      {staffUser.mustChangePassword && (
                        <Badge
                          variant="outline"
                          title="仮パスワードで作成され、本人のパスワード変更が未完了です"
                        >
                          初回PW変更待ち
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(staffUser.lastSignedIn)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={resetPassword.isPending}
                      onClick={() => resetPassword.mutate({ userId: staffUser.id })}
                    >
                      仮PW再発行
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
