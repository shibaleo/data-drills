# Data Drills

問題演習の学習記録・復習管理アプリ。問題を登録し、解答の履歴・所要時間・反省を記録して、忘却曲線に基づいた復習タイミングを可視化する。

## 主な機能

- **Timeline** — 問題カード一覧。保持率バー・所要時間スパークライン付き
- **Problems** — 問題マスタの管理（科目・レベル・チェックポイント）
- **Answers** — 解答履歴の一覧。ステータス・所要時間を記録
- **Flashcards** — フラッシュカード形式での暗記学習
- **Notes** — Markdown ノート（ライブプレビュー・数式・テーブル対応）
- **Masters** — 科目・レベル・トピック・タグ・ステータスの管理
- **Google Drive 連携** — 問題 PDF のリンク・閲覧

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| バックエンド API | Hono (Vercel Serverless) |
| データベース | PostgreSQL (Supabase) + Drizzle ORM |
| 認証 | Clerk / ローカルパスワード認証 (JWT) |
| エディタ | CodeMirror 6 + codemirror-live-markdown |
| デプロイ | Vercel |

## セットアップ

### 前提条件

- Node.js 20+
- pnpm
- PostgreSQL データベース（Supabase 推奨）

### 環境変数

`.env.local` に以下を設定:

```env
DATABASE_URL=postgresql://...

# Clerk 認証
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# ローカル認証（Clerk を使わない場合）
JWT_SECRET=your-secret

# Google Drive 連携（任意）
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXT_PUBLIC_GOOGLE_API_KEY=...
```

### インストール・起動

```bash
pnpm install
pnpm db:push        # スキーマをDBに反映
pnpm bootstrap      # 初期データ投入
pnpm dev             # 開発サーバー起動 (http://localhost:3000)
```

### データベース操作

```bash
pnpm db:generate    # マイグレーションファイル生成
pnpm db:migrate     # マイグレーション実行
pnpm db:push        # スキーマを直接反映（開発用）
pnpm db:studio      # Drizzle Studio（DB GUI）
```

## プロジェクト構成

```
src/
├── app/
│   ├── (pages)/         # 各ページ (timeline, problems, answers, ...)
│   └── api/             # API ルートハンドラ (Hono へのブリッジ)
├── components/          # UI コンポーネント
├── hooks/               # カスタムフック
├── lib/
│   ├── db/              # Drizzle スキーマ・DB接続
│   └── ...              # ユーティリティ
└── routes/              # Hono API ルート定義
```
