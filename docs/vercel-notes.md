# Vercel まわりの確認メモ（バッチD）

## サブドメイン分け（#118）— 設定不可・案のみ（partial）

現状は独自ドメインを持っていない（`kurashi-rust.vercel.app` は Vercel の共有ドメイン）ため、
`study.` のようなサブドメインは作れません。独自ドメインを取得してプロジェクトに割り当てた
あとなら、`vercel.json` にホスト条件のリライトを書いて、同じデプロイのまま
サブドメインごとに別アプリへ振り分けられます（案）：

```json
{
  "rewrites": [
    { "source": "/:path*", "has": [{ "type": "host", "value": "study.example.com" }], "destination": "/study/:path*" },
    { "source": "/:path*", "has": [{ "type": "host", "value": "game.example.com" }], "destination": "/game/:path*" }
  ]
}
```

独自ドメインの取得・割り当てが前提なので、現時点では未実施です。

## 表示まわりの確認（#92・#93・#96・#97）

- **#92 画像の自動最適化**: Vercel の Image Optimization は Next.js（`next/image` や
  `/_vercel/image`）前提の仕組みで、このアプリのような静的配信（プレーンな HTML/JS）には
  自動では効きません。アイコン類は既に PNG で配布され、アプリの Service Worker が
  キャッシュします。最適化が必要になれば、画像そのものの差し替え（WebP 化など）で対応します。
- **#93 先読み（プリフェッチ）**: アプリは Service Worker がファイル一式を先にキャッシュする
  設計（sw.js）で、ブラウザのプリフェッチより強い形で実現済みです。vercel.json への
  追加設定はしていません（SW のキャッシュ方針と競合させないため）。
- **#96 JS の分割配信**: アプリは最初から用途ごとの複数ファイル（js/*.js）に分かれていて、
  Service Worker が個別にキャッシュします。バンドルし直す予定はありません。
- **#97 フォントの最適化**: Web フォントは使っていません（css/app.css の font-family は
  Hiragino・Noto Sans JP・Yu Gothic などの端末側フォント指定）。ダウンロードする
  フォントが無いので、最適化の対象自体がありません。
- **圧縮（#94 関連）**: Vercel の静的配信・関数は既定で圧縮（gzip/Brotli）が有効です。
  追加設定は不要です。

## 表示速度の計測（#100）

Vercel 版でのみ、ページの読みこみ時間（TTFB・DOMContentLoaded・load）を1セッションに
1回だけ `/api/log`（level:'perf'）に送ります（js/core.js）。集計は `/api/log` の
GET で眺める形で、専用の集計画面はまだありません。
