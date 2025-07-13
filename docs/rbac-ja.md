# ロールベースアクセス制御 (RBAC)

## 概要

ロールベースアクセス制御 (RBAC) は、OpenShift と Kubernetes のセキュリティ機能で、ユーザーやサービスアカウントが実行できるアクションを制限します。OpenShift Console は RBAC を使用して、ユーザーが特定のリソースにアクセスできるかどうかを判断します。

## 仕組み

OpenShift の RBAC システムは以下のコンポーネントで構成されています：

1. **ロール**: 許可されたアクションのセット（ポリシールール）を定義します
2. **ロールバインディング**: ロールをユーザーやグループに関連付けます
3. **クラスターロール**: クラスター全体に適用されるロール
4. **クラスターロールバインディング**: クラスターロールをユーザーやグループに関連付けます

### ポリシールール

ポリシールールは以下の要素で構成されます：

- **APIグループ**: リソースが属する API グループ（例: `apps`、`rbac.authorization.k8s.io`）
- **リソース**: アクセスするリソースの種類（例: `pods`、`deployments`）
- **動詞**: 許可されるアクション（例: `get`、`list`、`create`、`update`、`delete`）

## OpenShift Console での RBAC

OpenShift Console は RBAC を使用して、UI 要素の表示/非表示を制御し、ユーザーが実行できるアクションを制限します。

### フロントエンドでの RBAC チェック

Console のフロントエンドは、以下の関数を使用して RBAC チェックを実行します：

1. **useAccessReview**: 単一のリソースに対するアクセス権をチェックします
2. **useMultipleAccessReviews**: 複数のリソースに対するアクセス権をチェックします
3. **RequireCreatePermission**: 特定のリソースを作成する権限がある場合のみ子コンポーネントをレンダリングします

例：

```tsx
const canCreateDeployment = useAccessReview({
  group: 'apps',
  resource: 'deployments',
  verb: 'create',
  namespace: 'default'
});

return canCreateDeployment ? <CreateButton /> : null;
```

### バックエンドでの RBAC チェック

バックエンドでは、Kubernetes の `SelfSubjectAccessReview` API を使用して、現在のユーザーが特定のアクションを実行できるかどうかを判断します。

## 一般的なロール

OpenShift には以下の一般的なロールが含まれています：

1. **cluster-admin**: クラスター全体の管理者権限
2. **admin**: プロジェクト内の管理者権限
3. **edit**: プロジェクト内のリソースを編集する権限
4. **view**: プロジェクト内のリソースを表示する権限（読み取り専用）

## RBAC の設定

### ロールの作成

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: default
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
```

### ロールバインディングの作成

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: read-pods
  namespace: default
subjects:
- kind: User
  name: jane
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

## トラブルシューティング

### アクセス拒否エラー

アクセス拒否エラーが発生した場合は、以下を確認してください：

1. ユーザーに適切なロールが割り当てられているか
2. ロールに必要な権限が含まれているか
3. ロールバインディングが正しいネームスペースに作成されているか

### 権限の確認

ユーザーが特定のアクションを実行できるかどうかを確認するには：

```
oc auth can-i create deployments --namespace=default
```

## 参考資料

- [Kubernetes RBAC ドキュメント](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
- [OpenShift RBAC ドキュメント](https://docs.openshift.com/container-platform/latest/authentication/using-rbac.html)