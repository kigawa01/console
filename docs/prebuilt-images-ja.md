# ビルド済みイメージの利用

## 概要

このドキュメントでは、OpenShift Consoleのビルド済みイメージを利用する方法について説明します。ソースコードからビルドする代わりに、公式のビルド済みイメージを使用することで、デプロイプロセスを簡素化できます。

## 公式イメージ

OpenShift Consoleの公式ビルド済みイメージは、以下のリポジトリで提供されています：

- [quay.io/openshift/origin-console](https://quay.io/repository/openshift/origin-console?tab=tags)

このリポジトリには、様々なバージョンのOpenShift Consoleイメージがタグ付けされています。

## イメージの選択

イメージを選択する際は、以下の点を考慮してください：

1. **バージョン互換性**: OpenShiftクラスターのバージョンと互換性のあるコンソールイメージを選択してください
2. **タグの種類**:
   - `latest`: 最新のビルド（開発環境向け）
   - `4.x.y`: 特定のバージョン（本番環境向け）
   - `4.x`: マイナーバージョンの最新ビルド

## イメージの使用方法

### Kubernetesクラスターでの使用

Kubernetesクラスターでビルド済みイメージを使用するには、デプロイメントマニフェストで公式イメージを指定します：

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
      serviceAccountName: console
      containers:
      - name: console
        image: quay.io/openshift/origin-console:latest  # 公式イメージを使用
        ports:
        - containerPort: 9000
        env:
        - name: BRIDGE_USER_AUTH
          value: "disabled"
        - name: BRIDGE_K8S_MODE
          value: "in-cluster"
        - name: BRIDGE_LISTEN
          value: "http://0.0.0.0:9000"
```

特定のバージョンを使用する場合は、タグを変更します：

```yaml
image: quay.io/openshift/origin-console:4.12.0
```

### OpenShiftクラスターでの使用

OpenShiftクラスターでは、コンソールオペレーターを使用して公式イメージを指定できます：

1. コンソールオペレーターを非管理状態に設定：

```bash
oc patch consoles.operator.openshift.io cluster --patch '{ "spec": { "managementState": "Unmanaged" } }' --type=merge
```

2. コンソールデプロイメントを公式イメージで更新：

```bash
oc set image deploy console console=quay.io/openshift/origin-console:4.12.0 -n openshift-console
```

3. 変更が適用されるのを待ちます：

```bash
oc rollout status -w deploy/console -n openshift-console
```

### Dockerでの実行

ローカル環境でDockerを使用して公式イメージを実行することもできます：

```bash
docker run -p 9000:9000 \
  -e BRIDGE_USER_AUTH=disabled \
  -e BRIDGE_K8S_MODE=off-cluster \
  -e BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT=<Kubernetes API URL> \
  -e BRIDGE_K8S_MODE_OFF_CLUSTER_SKIP_VERIFY_TLS=true \
  -e BRIDGE_K8S_AUTH_BEARER_TOKEN=<Bearer Token> \
  quay.io/openshift/origin-console:latest
```

## 環境変数の設定

ビルド済みイメージを使用する場合も、必要な環境変数を設定する必要があります：

- `BRIDGE_USER_AUTH`: 認証モード（"disabled"、"openshift"、"oidc"など）
- `BRIDGE_K8S_MODE`: Kubernetesモード（"in-cluster"または"off-cluster"）
- `BRIDGE_LISTEN`: リッスンアドレス（例: "http://0.0.0.0:9000"）

詳細な設定オプションについては、[バニラKubernetesへのデプロイ方法](./kubernetes-deploy-ja.md)を参照してください。

## イメージのプル

プライベートネットワークやエアギャップ環境では、イメージをプルして内部レジストリに保存する必要がある場合があります：

```bash
# イメージをプル
docker pull quay.io/openshift/origin-console:4.12.0

# タグを変更して内部レジストリにプッシュ
docker tag quay.io/openshift/origin-console:4.12.0 internal-registry.example.com/openshift/console:4.12.0
docker push internal-registry.example.com/openshift/console:4.12.0
```

## トラブルシューティング

### イメージのプルに失敗する

イメージのプルに失敗する場合は、以下を確認してください：

1. インターネット接続が利用可能か
2. quay.ioにアクセスできるか
3. イメージタグが存在するか

### コンテナの起動に失敗する

コンテナの起動に失敗する場合は、以下を確認してください：

1. 必要な環境変数がすべて設定されているか
2. Kubernetes APIエンドポイントにアクセスできるか
3. 認証トークンが有効か

## 参考資料

- [OpenShift Console GitHub](https://github.com/openshift/console)
- [Quay.io OpenShift リポジトリ](https://quay.io/organization/openshift)
- [OpenShift ドキュメント](https://docs.openshift.com/)