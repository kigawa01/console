# OpenID Connect (OIDC) 認証

## 概要

OpenID Connect (OIDC) は、OAuth 2.0 プロトコルの上に構築された認証レイヤーです。OpenShift Console は OIDC を使用してユーザー認証を実装しています。このドキュメントでは、OpenShift Console における OIDC 認証の仕組みと設定方法について説明します。

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

## 設定

OIDC 認証を設定するには、以下のパラメータを指定する必要があります：

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

## セキュリティ考慮事項

OIDC 認証を使用する際は、以下のセキュリティ考慮事項に注意してください：

1. **クライアントシークレットの保護**: クライアントシークレットは安全に保管し、公開リポジトリにコミットしないでください
2. **HTTPS の使用**: すべての通信は HTTPS で暗号化する必要があります
3. **トークンの検証**: ID トークンは必ず検証し、発行者、対象者、有効期限を確認してください
4. **スコープの制限**: 必要最小限のスコープのみを要求してください

## トラブルシューティング

### 一般的な問題

1. **認証エラー**: OIDC プロバイダーの設定が正しいことを確認してください
2. **トークンの期限切れ**: リフレッシュトークンが正しく機能していることを確認してください
3. **リダイレクトエラー**: リダイレクト URI が OIDC プロバイダーに登録されていることを確認してください

### ログ

認証問題のデバッグには、詳細なログを有効にしてください：

```
./bin/bridge --v=5
```

## 参考資料

- [OpenID Connect 仕様](https://openid.net/specs/openid-connect-core-1_0.html)
- [OAuth 2.0 仕様](https://oauth.net/2/)
- [go-oidc ライブラリ](https://github.com/coreos/go-oidc)