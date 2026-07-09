Notion Developer Platform用 Luauコードジェネレーターの実装

目的

Notion Developer Platformを利用し、ページ内に設置したカスタムツール（ボタン）から実行できる、Luauコード生成ツールを実装してください。

このツールは、指定したNotionデータベースを読み込み、データをLuauのModuleScript形式へ変換し、同一ページ内のコードブロックへ自動反映します。

⸻

要件

1. 実行方法

- ページ内のカスタムツール（ボタン）から実行できること
- ツール名は「Generate Luau」
- ワンクリックで処理が完了すること

⸻

2. データ取得

対象は現在のページに関連付けられたNotionデータベースです。

データベース内の全レコードを取得してください。

⸻

3. Luau生成

取得したデータをModuleScript形式へ変換します。

例

データベース

Name Damage Cooldown
Sword 25 1.2
Axe 40 2

↓

生成結果

return {
Sword = {
Damage = 25,
Cooldown = 1.2,
},
Axe = {
Damage = 40,
Cooldown = 2,
},
}

⸻

4. 型変換

Notionのプロパティ型に応じてLuauへ変換してください。

- Number → number
- Checkbox → boolean
- Rich Text → string
- Select → string
- Multi Select → string[]
- Date → ISO文字列
- URL → string
- Formula → 評価結果
- Status → string

空の値はnilとして扱ってください。

⸻

1. コードブロック更新

ページ内に存在する

Language = Lua

または

Language = Luau

のコードブロックを検索してください。

存在する場合

- 内容を上書き更新

存在しない場合

- ページ末尾へ新規コードブロックを追加

⸻

6. 出力フォーマット

生成コードは

- Roblox Luau
- return形式
- インデントは4スペース
- キーはName列を使用
- キーが存在しない場合はエラー

⸻

7. エラー処理

以下の場合はユーザーへ分かりやすく通知してください。

- Name列が存在しない
- データベースが見つからない
- データ取得失敗
- 書き込み失敗
- 権限不足

⸻

8. コード品質

生成するコードは

- 読みやすい
- ソート済み
- 不要な空行なし
- 末尾カンマあり
- Luau Formatterに適した形式

⸻

9. 拡張性

今後追加できるよう設計してください。

- ModuleScript分割

⸻

1.  実装

TypeScriptで実装してください。

使用するもの

- Notion Developer Platform
- Notion API
- 最新SDK
- async/await
- 型安全な設計

⸻

11. ファイル構成

以下のような構成を提案してください。

src/
index.ts
notion.ts
generator.ts
formatter.ts
blocks.ts
types.ts

⸻

12. 出力してほしい内容

以下をすべて作成してください。

1. プロジェクト構成
2. 実装コード
3. 型定義
4. Luau生成ロジック
5. Notion API操作
6. コードブロック更新処理
7. エラーハンドリング
8. README
9. セットアップ方法
10. 実行方法

コードはそのままビルドできる品質で、省略せず完全な実装を出力してください。
