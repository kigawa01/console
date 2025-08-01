# エラーの対処法 Q&A

## 概要

このドキュメントでは、OpenShift Consoleを使用する際に発生する可能性のある一般的なエラーとその解決方法をQ&A形式で説明します。各セクションは特定のカテゴリのエラーに焦点を当てています。

## 目次

- [認証関連のエラー](#認証関連のエラー)
- [デプロイメント関連のエラー](#デプロイメント関連のエラー)
- [接続関連のエラー](#接続関連のエラー)
- [パフォーマンス関連の問題](#パフォーマンス関連の問題)
- [ユーザーインターフェース関連の問題](#ユーザーインターフェース関連の問題)
- [プラグイン関連のエラー](#プラグイン関連のエラー)
- [ログとデバッグ](#ログとデバッグ)

## 認証関連のエラー

### Q: ログイン画面が表示されず、「認証エラー」というメッセージが表示されます

**A**: 以下を確認してください：

1. 認証プロバイダーの設定が正しいか確認します
2. 環境変数 `BRIDGE_USER_AUTH` が正しく設定されているか確認します
3. OIDC を使用している場合は、クライアント ID とシークレットが正しいか確認します

```bash
# 設定を確認
echo $BRIDGE_USER_AUTH
echo $BRIDGE_OIDC_CLIENT_ID
```

### Q: 「トークンの有効期限が切れています」というエラーが表示されます

**A**: リフレッシュトークンが正しく機能していない可能性があります。以下を試してください：

1. 再度ログインしてください
2. OIDC プロバイダーの設定でリフレッシュトークンが有効になっているか確認してください
3. セッションの有効期限が適切に設定されているか確認してください

### Q: 「アクセス権限がありません」というエラーが表示されます

**A**: ユーザーに必要な権限がない可能性があります。以下を確認してください：

1. ユーザーに適切なロールが割り当てられているか確認します
2. 以下のコマンドを使用して、特定のリソースに対するアクセス権を確認します：

```bash
oc auth can-i get pods --namespace=default
```

3. 必要に応じて、適切なロールバインディングを作成します：

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: pod-reader
  namespace: default
subjects:
- kind: User
  name: username
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

## デプロイメント関連のエラー

### Q: コンソールポッドが起動しません

**A**: 以下を確認してください：

1. ポッドのステータスと詳細を確認します：

```bash
kubectl -n console get pods
kubectl -n console describe pod <ポッド名>
kubectl -n console logs <ポッド名>
```

2. リソース制限に問題がないか確認します（メモリ不足など）
3. イメージが正しく指定されているか確認します
4. 必要な環境変数がすべて設定されているか確認します

### Q: 「イメージのプルに失敗しました」というエラーが表示されます

**A**: 以下を確認してください：

1. イメージ名とタグが正しいか確認します
2. イメージレジストリにアクセスできるか確認します
3. プライベートレジストリを使用している場合は、認証情報が正しく設定されているか確認します：

```bash
kubectl create secret docker-registry regcred \
  --docker-server=<レジストリURL> \
  --docker-username=<ユーザー名> \
  --docker-password=<パスワード> \
  --docker-email=<メールアドレス>
```

4. デプロイメントにイメージプルシークレットを追加します：

```yaml
spec:
  imagePullSecrets:
  - name: regcred
```

### Q: 「CrashLoopBackOff」エラーが発生します

**A**: ポッドが繰り返し再起動している状態です。以下を確認してください：

1. ログを確認して根本的な原因を特定します：

```bash
kubectl -n console logs <ポッド名> --previous
```

2. 必要な環境変数がすべて設定されているか確認します
3. リソース制限が適切か確認します
4. 設定ファイルに構文エラーがないか確認します

## 接続関連のエラー

### Q: コンソールにアクセスできません

**A**: 以下を確認してください：

1. サービスとルート/イングレスが正しく設定されているか確認します：

```bash
kubectl -n console get svc
kubectl -n console get ingress  # または `oc -n console get route`
```

2. ファイアウォールやネットワークポリシーがアクセスをブロックしていないか確認します
3. ブラウザのコンソールでネットワークエラーを確認します

### Q: 「Kubernetes API に接続できません」というエラーが表示されます

**A**: 以下を確認してください：

1. Kubernetes API サーバーが実行中であることを確認します
2. コンソールポッドに API サーバーへのネットワークアクセスがあることを確認します
3. サービスアカウントトークンが有効であることを確認します
4. オフクラスターモードの場合は、以下の環境変数が正しく設定されているか確認します：

```bash
echo $BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT
echo $BRIDGE_K8S_AUTH_BEARER_TOKEN
```

### Q: WebSocket 接続エラーが発生します

**A**: WebSocket 接続に問題がある場合は、以下を確認してください：

1. プロキシやロードバランサーが WebSocket 接続をサポートしているか確認します
2. タイムアウト設定が適切か確認します
3. CORS 設定が正しいか確認します

## パフォーマンス関連の問題

### Q: コンソールの読み込みが遅いです

**A**: 以下を確認してください：

1. ブラウザの開発者ツールを使用してパフォーマンスのボトルネックを特定します
2. コンソールポッドに十分なリソース（CPU/メモリ）が割り当てられているか確認します
3. 多数のリソースを持つ大規模なクラスターの場合は、ページネーションとフィルタリングを使用してください
4. ブラウザのキャッシュをクリアしてみてください

### Q: メモリ使用量が時間とともに増加します

**A**: メモリリークの可能性があります。以下を試してください：

1. 定期的にコンソールポッドを再起動するようにスケジュールします
2. 最新バージョンのコンソールイメージを使用しているか確認します
3. メモリ使用量を監視し、パターンを特定します

## ユーザーインターフェース関連の問題

### Q: 一部のUI要素が表示されないか、正しく機能しません

**A**: 以下を確認してください：

1. ブラウザのコンソールでJavaScriptエラーを確認します
2. サポートされているブラウザバージョンを使用しているか確認します（IE11はサポートされていません）
3. ブラウザのキャッシュとクッキーをクリアしてみてください
4. 別のブラウザで試してみてください

### Q: 日本語のテキストが正しく表示されません

**A**: 以下を確認してください：

1. ブラウザが日本語フォントをサポートしているか確認します
2. ブラウザの言語設定が正しく設定されているか確認します
3. コンソールの言語設定を確認します

### Q: テーブルやリストのフィルタリングが機能しません

**A**: 以下を確認してください：

1. 正しい構文でフィルタリングしているか確認します
2. ブラウザのコンソールでエラーを確認します
3. フィルタリングに使用しているフィールドが実際にリソースに存在するか確認します

## プラグイン関連のエラー

### Q: プラグインが読み込まれません

**A**: 以下を確認してください：

1. プラグインが正しくデプロイされているか確認します
2. コンソールがプラグインを検出できるように設定されているか確認します：

```bash
# 環境変数を確認
echo $BRIDGE_PLUGINS
```

3. コンテンツセキュリティポリシー（CSP）の設定を確認します：

```bash
# CSP設定を追加
./bin/bridge --content-security-policy script-src='plugin-host.example.com'
```

### Q: プラグインでコンテンツセキュリティポリシー違反が発生します

**A**: 以下を確認してください：

1. プラグインのホストがCSP設定に含まれているか確認します
2. 必要なCSPディレクティブをすべて追加します：

```bash
./bin/bridge --content-security-policy script-src='plugin-host.example.com',font-src='plugin-host.example.com'
```

3. プラグインが安全なコンテンツのみを読み込んでいるか確認します

## ログとデバッグ

### Q: 詳細なログを有効にするにはどうすればよいですか？

**A**: 詳細レベルを上げてコンソールを実行します：

```bash
./bin/bridge --v=5  # 詳細レベルを5に設定
```

詳細レベルは1〜10の範囲で設定でき、数値が大きいほど詳細なログが出力されます。

### Q: 認証関連のデバッグログを確認するにはどうすればよいですか？

**A**: 認証関連のログは通常、詳細レベル4で出力されます：

```bash
./bin/bridge --v=4
```

特に `pkg/auth/metrics.go` の関数 `canGetNamespaces()` と `isKubeAdmin()` のログを確認してください。

### Q: "Error in auth.metrics isKubeAdmin: Unauthorized" というエラーが表示されます

**A**: このエラーメッセージは正常な動作の一部です。認証メトリクスコードがユーザーロールを確認する際に、ユーザーが `user.openshift.io` APIにアクセスする権限がない場合に発生します。

このエラーは詳細レベル4（`klog.V(4).Infof`）でログに記録されるため、通常のログ出力では表示されません。詳細なログを有効にしている場合（`--v=4` 以上）にのみ表示されます。

これは実際の問題ではなく、予想される動作です。ログのノイズを減らすため、これらの予想されるエラーは高い詳細レベルでのみログに記録されます。

### Q: フロントエンドのエラーをデバッグするにはどうすればよいですか？

**A**: ブラウザの開発者ツールを使用します：

1. F12キーを押すか、ブラウザのメニューから「開発者ツール」を開きます
2. 「Console」タブでJavaScriptエラーを確認します
3. 「Network」タブでネットワークリクエストとレスポンスを確認します
4. 「Application」タブでローカルストレージとセッションストレージを確認します

### Q: APIリクエストの詳細を確認するにはどうすればよいですか？

**A**: ブラウザの開発者ツールの「Network」タブを使用します：

1. 「Network」タブを開きます
2. 「XHR」または「Fetch」フィルターを選択します
3. 問題のあるリクエストを見つけて、詳細（ヘッダー、ペイロード、レスポンス）を確認します

## 参考資料

- [OpenShift Console GitHub](https://github.com/openshift/console)
- [OpenShift ドキュメント](https://docs.openshift.com/)
- [Kubernetes トラブルシューティングガイド](https://kubernetes.io/docs/tasks/debug-application-cluster/troubleshooting/)
- [OIDC トラブルシューティング](https://openid.net/specs/openid-connect-core-1_0.html)
