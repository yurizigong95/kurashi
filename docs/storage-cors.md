# Firebase Storage の CORS に Vercel の URL を足す手順（#148）

写真の同期は Firebase Storage（バケット `kurashi-59562.firebasestorage.app`）を使っています。
ブラウザから直接読みに行くため、バケット側の CORS 設定に「読み取りを許可するサイト（origin）」を
登録しておく必要があります。いまは GitHub Pages の origin だけが入っている想定なので、
Vercel 版の origin を**追加**してください（上書きではなく追加です）。

> これはコードでは変更できません。Firebase / Google Cloud 側の設定作業です（手作業が残ります）。

## 許可する origin

- `https://yurizigong95.github.io`（既存。消さないこと）
- `https://kurashi-rust.vercel.app`（今回追加する Vercel 本番）

## 手順（gsutil）

Google Cloud SDK（`gsutil`）が使える環境で、次のファイル `cors.json` を作ります：

```json
[
  {
    "origin": ["https://yurizigong95.github.io", "https://kurashi-rust.vercel.app"],
    "method": ["GET"],
    "maxAgeSeconds": 3600
  }
]
```

適用：

```sh
gsutil cors set cors.json gs://kurashi-59562.firebasestorage.app
```

確認：

```sh
gsutil cors get gs://kurashi-59562.firebasestorage.app
```

アプリ内にも同じ案内があります（js/sync.js の `storageCorsCommand()`。
現状は GitHub Pages の origin だけのコマンドを返すので、Vercel の origin はこのドキュメントの
cors.json のように足して使ってください）。

## 適用後に確かめること

1. Vercel 版（https://kurashi-rust.vercel.app）を開き、写真の同期がエラーなく終わること。
2. GitHub Pages 版でも写真が今までどおり読めること（origin を消していないこと）。
