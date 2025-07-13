# バニラKubernetesへのデプロイ方法

## 概要

このドキュメントでは、OpenShift Consoleをバニラ（標準）Kubernetesクラスターにデプロイする方法について説明します。OpenShift Consoleは主にOpenShiftクラスター用に設計されていますが、標準のKubernetesクラスターでも動作させることができます。

## 前提条件

1. [node.js](https://nodejs.org/) >= 22 & [yarn classic](https://classic.yarnpkg.com/en/docs/install) >= 1.20
2. [go](https://golang.org/) >= 1.22+
3. [kubectl](https://kubernetes.io/docs/tasks/tools/install-kubectl/) と動作するKubernetesクラスター
4. [jq](https://stedolan.github.io/jq/download/) (`contrib/environment.sh`スクリプトに必要)
5. [Docker](https://docs.docker.com/get-docker/) v17.05以上（マルチステージビルド用）

## ローカル開発環境でのデプロイ

### ビルド

プロジェクトをクローンし、ビルドします：

```bash
# GOPATHの外でクローンすることを推奨
git clone https://github.com/openshift/console.git
cd console

# フロントエンドとバックエンドの両方をビルド
./build.sh
```

バックエンドのバイナリは`./bin`ディレクトリに出力されます。

### 環境設定

Kubernetesクラスターに接続するための環境変数を設定します。提供されている`contrib/environment.sh`スクリプトを使用すると、必要な環境変数が自動的に設定されます：

```bash
export KUBECONFIG=/path/to/kubeconfig
source ./contrib/environment.sh
```

このスクリプトは以下の処理を行います：
- ユーザー認証を無効化 (`BRIDGE_USER_AUTH="disabled"`)
- オフクラスターモードを設定 (`BRIDGE_K8S_MODE="off-cluster"`)
- kubectlを使用してKubernetes APIエンドポイントを取得
- TLS検証をスキップするように設定
- kube-systemネームスペースのデフォルトサービスアカウントからベアラートークンを取得

### コンソールの起動

環境変数を設定した後、コンソールを起動します：

```bash
./bin/bridge
```

コンソールは[localhost:9000](http://localhost:9000)で実行されます。

### 手動での環境設定

`environment.sh`スクリプトが動作しない場合や、より詳細な設定が必要な場合は、以下の手順で手動で環境を設定できます：

1. `kubernetes.io/service-account-token`タイプのシークレットIDを取得します：

```bash
kubectl get secrets
```

2. シークレットの内容を取得します：

```bash
kubectl describe secrets/<前の手順で取得したシークレットID>
```

3. 取得したトークン値を使用して環境変数を設定します：

```bash
export BRIDGE_USER_AUTH="disabled"
export BRIDGE_K8S_MODE="off-cluster"
export BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT=$(kubectl config view -o json | jq -r '.clusters[0].cluster.server')
export BRIDGE_K8S_MODE_OFF_CLUSTER_SKIP_VERIFY_TLS=true
export BRIDGE_K8S_AUTH_BEARER_TOKEN=<取得したトークン値>
```

4. コンソールを起動します：

```bash
./bin/bridge
```

## Kubernetesクラスターへのデプロイ

実際のKubernetesクラスターにOpenShift Consoleをデプロイするには、Dockerイメージをビルドしてデプロイする必要があります。

### Dockerイメージのビルドとプッシュ

1. イメージレジストリ（[quay.io](https://quay.io/signin/)や[Docker Hub](https://hub.docker.com/)など）にリポジトリを作成します。

2. イメージをビルドします：

```bash
docker build -t <あなたのイメージ名> .

# 例：
docker build -t quay.io/myaccount/console:latest .
```

3. イメージをレジストリにプッシュします（事前にイメージレジストリにログインしておいてください）：

```bash
docker push <あなたのイメージ名>

# 例：
docker push quay.io/myaccount/console:latest
```

### Kubernetesマニフェストの作成

以下のYAMLファイルを作成して、コンソールをデプロイします：

#### console-namespace.yaml

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: console
```

#### console-service-account.yaml

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: console
  namespace: console
```

#### console-role.yaml

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: console-role
rules:
- apiGroups: ["*"]
  resources: ["*"]
  verbs: ["*"]
```

#### console-rolebinding.yaml

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: console-rolebinding
subjects:
- kind: ServiceAccount
  name: console
  namespace: console
roleRef:
  kind: ClusterRole
  name: console-role
  apiGroup: rbac.authorization.k8s.io
```

#### console-deployment.yaml

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
        image: quay.io/myaccount/console:latest  # あなたのイメージ名に変更してください
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

#### console-service.yaml

```yaml
apiVersion: v1
kind: Service
metadata:
  name: console
  namespace: console
spec:
  selector:
    app: console
  ports:
  - port: 80
    targetPort: 9000
  type: ClusterIP
```

#### console-ingress.yaml

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: console
  namespace: console
spec:
  rules:
  - host: console.example.com  # あなたのドメインに変更してください
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: console
            port:
              number: 80
```

### マニフェストの適用

作成したマニフェストを適用します：

```bash
kubectl apply -f console-namespace.yaml
kubectl apply -f console-service-account.yaml
kubectl apply -f console-role.yaml
kubectl apply -f console-rolebinding.yaml
kubectl apply -f console-deployment.yaml
kubectl apply -f console-service.yaml
kubectl apply -f console-ingress.yaml
```

これにより、コンソールがKubernetesクラスターにデプロイされ、設定したIngressを通じてアクセスできるようになります。

## トラブルシューティング

### ポッドが起動しない

コンソールポッドが起動しない場合は、以下を確認してください：

```bash
kubectl -n console get pods
kubectl -n console describe pod <ポッド名>
kubectl -n console logs <ポッド名>
```

### 認証エラー

認証エラーが発生する場合は、サービスアカウントに適切な権限が付与されているか確認してください：

```bash
kubectl get clusterrolebinding console-rolebinding
```

### 接続エラー

コンソールに接続できない場合は、サービスとIngressが正しく設定されているか確認してください：

```bash
kubectl -n console get svc
kubectl -n console get ingress
```

## 参考資料

- [Kubernetes公式ドキュメント](https://kubernetes.io/docs/)
- [OpenShift Console GitHub](https://github.com/openshift/console)
