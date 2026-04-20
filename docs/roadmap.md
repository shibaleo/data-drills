# Roadmap

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
