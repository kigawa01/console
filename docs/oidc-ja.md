# OpenID Connect (OIDC) 認証

## 概要

OpenID Connect (OIDC) は、OAuth 2.0 プロトコルの上に構築された認証レイヤーです。OpenShift Console は OIDC を使用してユーザー認証を実装しています。このドキュメントでは、OpenShift Console における OIDC 認証の仕組みと詳細な設定方法について説明します。

## 仕組み

OpenShift Console の OIDC 認証は以下のコンポーネントで構成されています：

1. **oidcAuth**: 認証ハンドラー
2. **oidcConfig**: OIDC 認証の設定
3. **セッション管理**: ユーザーセッションの作成、更新、削除
4. **トークン検証**: ID トークンの検証
5. **トークンリフレッシュ**: アクセストークンの更新

### 認証フロー

1. ユーザーがログインを開始すると、OIDC プロバイダーにリダイレクトされます
2. ユーザーが認証されると、OIDC プロバイダーはコードを返します
3. コードはアクセストークン、ID トークン、リフレッシュトークンと交換されます
4. トークンはセッションに保存され、ユーザーは認証されたとみなされます
5. セッションが期限切れになると、リフレッシュトークンを使用して新しいトークンを取得します

## 基本設定

OIDC 認証を設定するには、以下の必須パラメータを指定する必要があります：

- **issuerURL**: OIDC プロバイダーの発行者 URL
- **clientID**: OIDC クライアント ID
- **clientSecret**: OIDC クライアントシークレット
- **redirectURI**: 認証後のリダイレクト URI

### コマンドライン引数

```
./bin/bridge --user-auth="oidc" --oidc-issuer-url="https://example.com/auth/realms/master" --oidc-client-id="console" --oidc-client-secret="secret"
```

### 環境変数

```
BRIDGE_USER_AUTH="oidc"
BRIDGE_OIDC_ISSUER_URL="https://example.com/auth/realms/master"
BRIDGE_OIDC_CLIENT_ID="console"
BRIDGE_OIDC_CLIENT_SECRET="secret"
```

### 設定ファイル

YAML形式の設定ファイルを使用することもできます：

```yaml
apiVersion: console.openshift.io/v1beta1
kind: ConsoleConfig
servingInfo:
  bindAddress: http://0.0.0.0:9000
clusterInfo:
  consoleBaseAddress: http://localhost:9000
  masterPublicURL: https://127.0.0.1:8443
auth:
  clientID: console-oauth-client
  clientSecretFile: /path/to/client-secret
  issuerURL: https://oidc.example.com/auth/realms/master
```

## 詳細設定オプション

基本設定に加えて、以下の詳細オプションを設定できます：

### セキュリティ設定

- **oidc-ca-file**: OIDC プロバイダーへの接続に使用する CA 証明書ファイル
  ```
  --user-auth-oidc-ca-file=/path/to/ca.crt
  ```

- **cookie-secure**: セキュアクッキーを使用するかどうか（HTTPS環境では true に設定）
  ```
  --cookie-secure=true
  ```

- **cookie-path**: クッキーのパス
  ```
  --cookie-path=/console
  ```

### ログアウト設定

- **user-auth-logout-redirect**: ログアウト後のリダイレクト先 URL
  ```
  --user-auth-logout-redirect="https://example.com/logout"
  ```

### スコープ設定

- **user-auth-oidc-scopes**: 要求するスコープ（カンマ区切り）
  ```
  --user-auth-oidc-scopes="openid,profile,email,groups"
  ```

## 主要なOIDCプロバイダーの設定例

### Keycloak

```
./bin/bridge \
  --user-auth="oidc" \
  --oidc-issuer-url="https://keycloak.example.com/auth/realms/master" \
  --oidc-client-id="console" \
  --oidc-client-secret="your-client-secret" \
  --user-auth-oidc-ca-file=/path/to/ca.crt \
  --user-auth-oidc-scopes="openid,profile,email,groups"
```

### Azure Active Directory

```
./bin/bridge \
  --user-auth="oidc" \
  --oidc-issuer-url="https://login.microsoftonline.com/<tenant-id>/v2.0" \
  --oidc-client-id="<application-id>" \
  --oidc-client-secret="<client-secret>" \
  --user-auth-oidc-scopes="openid,profile,email"
```

### Google

```
./bin/bridge \
  --user-auth="oidc" \
  --oidc-issuer-url="https://accounts.google.com" \
  --oidc-client-id="<client-id>.apps.googleusercontent.com" \
  --oidc-client-secret="<client-secret>" \
  --user-auth-oidc-scopes="openid,profile,email"
```

### Okta

```
./bin/bridge \
  --user-auth="oidc" \
  --oidc-issuer-url="https://<your-domain>.okta.com/oauth2/default" \
  --oidc-client-id="<client-id>" \
  --oidc-client-secret="<client-secret>" \
  --user-auth-oidc-scopes="openid,profile,email"
```

## Kubernetesマニフェストでの設定

Kubernetesクラスターにデプロイする場合は、以下のようなデプロイメントマニフェストを使用できます：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: console
  namespace: console
spec:
  replicas: 1
  selector:
    matchLabels:
      app: console
  template:
    metadata:
      labels:
        app: console
    spec:
      containers:
      - name: console
        image: quay.io/openshift/origin-console:latest
        ports:
        - containerPort: 9000
        env:
        - name: BRIDGE_USER_AUTH
          value: "oidc"
        - name: BRIDGE_OIDC_ISSUER_URL
          value: "https://oidc.example.com/auth/realms/master"
        - name: BRIDGE_OIDC_CLIENT_ID
          value: "console"
        - name: BRIDGE_OIDC_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: console-oidc-secret
              key: client-secret
        - name: BRIDGE_K8S_MODE
          value: "in-cluster"
        - name: BRIDGE_LISTEN
          value: "http://0.0.0.0:9000"
```

関連するシークレット：

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: console-oidc-secret
  namespace: console
type: Opaque
data:
  client-secret: <base64-encoded-client-secret>
```

## セキュリティ考慮事項

OIDC 認証を使用する際は、以下のセキュリティ考慮事項に注意してください：

1. **クライアントシークレットの保護**: クライアントシークレットは安全に保管し、公開リポジトリにコミットしないでください
2. **HTTPS の使用**: すべての通信は HTTPS で暗号化する必要があります
3. **トークンの検証**: ID トークンは必ず検証し、発行者、対象者、有効期限を確認してください
4. **スコープの制限**: 必要最小限のスコープのみを要求してください
5. **セッションタイムアウト**: 適切なセッションタイムアウトを設定してください
6. **CORS設定**: 適切なCORS（クロスオリジンリソース共有）設定を行ってください

## トラブルシューティング

### 一般的な問題

1. **認証エラー**: OIDC プロバイダーの設定が正しいことを確認してください
2. **トークンの期限切れ**: リフレッシュトークンが正しく機能していることを確認してください
3. **リダイレクトエラー**: リダイレクト URI が OIDC プロバイダーに登録されていることを確認してください

### プロバイダー別の問題

#### Keycloak

- クライアントの「アクセスタイプ」が「confidential」に設定されていることを確認
- 「有効なリダイレクトURI」にコンソールのURLが含まれていることを確認
- 「Webオリジン」にコンソールのURLが含まれていることを確認

#### Azure AD

- アプリケーション登録で「暗黙的フローを許可する」が有効になっていることを確認
- リダイレクトURIが正しく登録されていることを確認
- APIのアクセス許可が適切に設定されていることを確認

#### Google

- OAuth同意画面が設定されていることを確認
- 承認済みのリダイレクトURIが正しく設定されていることを確認

### ログ

認証問題のデバッグには、詳細なログを有効にしてください：

```
./bin/bridge --v=5
```

ログで以下のようなエラーを確認してください：

- OIDC Discovery エラー: プロバイダーのURLが正しいか確認
- トークン検証エラー: クライアントIDとシークレットが正しいか確認
- リダイレクトエラー: リダイレクトURIが正しく設定されているか確認

## 参考資料

- [OpenID Connect 仕様](https://openid.net/specs/openid-connect-core-1_0.html)
- [OAuth 2.0 仕様](https://oauth.net/2/)
- [go-oidc ライブラリ](https://github.com/coreos/go-oidc)
- [Keycloak ドキュメント](https://www.keycloak.org/documentation)
- [Azure AD OIDC ドキュメント](https://docs.microsoft.com/ja-jp/azure/active-directory/develop/v2-protocols-oidc)
- [Google OIDC ドキュメント](https://developers.google.com/identity/protocols/oauth2/openid-connect)
