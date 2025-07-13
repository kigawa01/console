# プロジェクト構造

## ドキュメント構造

OpenShift Console プロジェクトのドキュメントは以下のように構成されています：

### ルートディレクトリのドキュメント

- `README.md` - プロジェクトの概要と開発ガイド
- `CONTRIBUTING.md` - コントリビューションガイドライン
- `INTERNATIONALIZATION.md` - 国際化に関するガイドライン
- `STYLEGUIDE.md` - コーディングスタイルガイド
- `todo.md` - 今後のタスクリスト
- `structure.md` - プロジェクト構造の説明（このファイル）

### 言語別ドキュメント

- `docs/oidc-ja.md` - OpenID Connect 認証と詳細な設定方法の日本語ドキュメント
- `docs/rbac-ja.md` - ロールベースアクセス制御 (RBAC) の日本語ドキュメント
- `docs/kubernetes-deploy-ja.md` - バニラKubernetesへのデプロイ方法の日本語ドキュメント
- `docs/prebuilt-images-ja.md` - ビルド済みイメージを利用する方法の日本語ドキュメント
- `docs/troubleshooting-qa-ja.md` - エラーの対処法 Q&A の日本語ドキュメント

### 機能別ドキュメント

- `docs/helm/` - Helm 関連のドキュメント

### パッケージ別ドキュメント

- `frontend/packages/console-dynamic-plugin-sdk/README.md` - コンソールダイナミックプラグインSDKのドキュメント
- `frontend/packages/console-plugin-shared/README.md` - コンソールプラグイン共有ライブラリのドキュメント
- `frontend/packages/dev-console/README.md` - 開発コンソールのドキュメント
- `frontend/packages/eslint-plugin-console/README.md` - ESLintプラグインのドキュメント
- `frontend/packages/integration-tests-cypress/README.md` - Cypressテストのドキュメント
- `frontend/packages/knative-plugin/README.md` - Knativeプラグインのドキュメント

## ソースコード構造

### バックエンド

- `pkg/auth/` - 認証関連のコード
  - `pkg/auth/oauth2/` - OAuth2認証
    - `pkg/auth/oauth2/auth_oidc.go` - OIDC認証の実装
    - `pkg/auth/oauth2/auth_oidc_test.go` - OIDC認証のテスト

### フロントエンド

- `frontend/` - フロントエンドのコード
  - `frontend/public/` - 公開アセット
  - `frontend/packages/` - フロントエンドパッケージ
  - `frontend/i18n-scripts/` - 国際化スクリプト
