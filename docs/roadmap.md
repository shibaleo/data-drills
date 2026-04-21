# Roadmap

## Next.js → Vite + TanStack Router 移行

Next.js をルーターとビルドツールとしてしか使っていないため、段階的に Vite + TanStack Router に移行する。
API は既に Hono で実装済み。デプロイ先は引き続き Vercel。

### ステップ

1. **Next.js 固有 import の抽象化** — `next/link`, `next/navigation` を `src/lib/router.tsx` ラッパーに置換
2. **Google OAuth/Drive API routes を Hono に移行** — `next/server` 依存を除去
3. **`@clerk/nextjs` → `@clerk/clerk-react`** — Next.js 非依存の Clerk SDK に切替
4. **TanStack Router 導入** — ファイルベースルーティングを移行
5. **Vite ビルドに切替** — `next.config.ts` → `vite.config.ts`, `"use client"` 除去
6. **Hono API を独立エントリポイントに** — Vercel Serverless Function として直接デプロイ

### 現在の Next.js 依存

- `next/navigation` (3ファイル): useRouter, usePathname, redirect
- `next/link` (1ファイル): sidebar
- `next/dynamic` (1ファイル): problem-pdf-link
- `next/server` (8ファイル): Google OAuth/Drive API routes
- `@clerk/nextjs` (5ファイル): 認証
- `Metadata` (1ファイル): root layout

---

## Markdown入力UXの向上（CodeMirror）

現在CodeMirrorベースのエディタを導入済みだが、NotionやObsidianのような書き心地にはまだ遠い。

### 参考にすべきテックブログ

- **Notion** — ブロックベースエディタ。スラッシュコマンド、インラインメニュー、ドラッグ&ドロップによるブロック移動
- **Obsidian** — Live Preview方式。Markdownソースとレンダリング結果をシームレスに切り替え。vim keybindings対応

### 改善候補

- スラッシュコマンド（`/heading`, `/list`, `/math` など）
- ツールバー（太字・リスト・リンクのボタン）
- Live Preview の精度向上（現在のlivePreviewPluginの拡張）
- テーブル編集のWYSIWYG化（Tab移動、行列追加）
- 画像のペースト挿入
- KaTeX数式のインラインプレビュー改善
