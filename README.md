# NotionToLua

Notion データベースの全レコードを Roblox Luau の `ModuleScript` 形式へ変換する CLI です。  
`ntn-lua` で、Notion ページ内のコードブロックへ反映するか、ローカルファイルとして出力できます。

## 機能

- `ntn-lua` CLI（Node.js 22 `parseArgs`）
- データベース全レコードの取得（ページネーション対応）
- Notion プロパティ型 → Luau 型変換
- ページ内の `language = lua`（UI 上の Luau 含む）コードブロックを検索して上書き、なければ末尾に新規作成
- `--output` 指定時はファイル出力のみ（Notion 書き込みなし）。ディレクトリまたは `.lua` / `.luau` ファイルパスを指定可能
- Stylua によるフォーマット（失敗時は警告して続行、`--no-format` でスキップ）
- title 型の主キー列をトップレベルキーとして使用（重複・空はエラー）
- 未対応プロパティ型はスキップ

## 前提

- Node.js 22+
- [Stylua](https://github.com/JohnnyMorganz/StyLua)（任意。未インストール時は警告して未フォーマットのまま出力）
- 対象ページ・データベースが Integration に共有済み

## セットアップ

```bash
# 依存関係のインストール
npm install

# ビルド
npm run build

# 型チェック
npm run check

# ユニットテスト
npm test
```

### 環境変数

```bash
cp .env.example .env
```

`.env` に `NOTION_API_TOKEN`（必須）と、よく使う設定を任意で入れます。

| 変数                  | 必須 | 用途                                           |
| --------------------- | ---- | ---------------------------------------------- |
| `NOTION_API_TOKEN`    | 必須 | Notion Integration の API トークン             |
| `NOTION_DATABASE_ID`  | 任意 | デフォルトの database_id / data_source_id      |
| `NOTION_OUTPUT_DIR`   | 任意 | デフォルトの出力ディレクトリ（ファイル出力）   |

## 使い方

開発中（ビルド不要）:

```bash
# 最短（.env に DB ID と output dir を設定済み）
npm run sync

# 個別に上書きする場合
npm run sync -- -o ./other
npm run sync -- 3a94b589fd86808d9d64d7c99ce91844
```

ビルド後:

```bash
npm run build
npx ntn-lua
npx ntn-lua -o ./other
```

優先順:
- database ID: `-d` / `--database-id` → 位置引数 → `NOTION_DATABASE_ID`
- 出力 dir: `-o` / `--output` → `NOTION_OUTPUT_DIR`（未設定時は Notion コードブロックへ書き込み）

### Notion コードブロックへ反映（デフォルト）

```bash
ntn-lua -d <DATABASE_OR_DATA_SOURCE_ID>
# または
ntn-lua <DATABASE_OR_DATA_SOURCE_ID>
```

書き込み先ページは次の順で解決されます。

1. `--page-id`（指定時）
2. データソースの `database_parent.page_id`
3. `database_parent.block_id` から `blocks.retrieve` で親を辿る
4. ワークスペース直下など解決不能な場合はエラー

```bash
# ページ ID を明示指定
ntn-lua -d <DATABASE_ID> -p <PAGE_ID>
```

### ローカルファイルへ出力

```bash
# .env に NOTION_DATABASE_ID / NOTION_OUTPUT_DIR を設定済みなら引数不要
ntn-lua

# 明示指定
ntn-lua -d <DATABASE_ID> -o ./output
ntn-lua <DATABASE_ID> -o ./output
```

- ファイル名はデータソース名をサニタイズした `{name}.luau`
- 出力ディレクトリは事前に作成しておく必要があります（自動作成しません）
- `--output` 指定時は Notion への書き込みは行わず、`--page-id` は無視されます（警告を stderr に出力）

### オプション

```bash
ntn-lua [-d <id>] [<database-id>] [-p <page-id>] [-o <dir>] [--no-format]
```

| オプション           | 説明                                           |
| -------------------- | ---------------------------------------------- |
| `<database-id>`      | 位置引数。`-d` 未指定時の DB ID                |
| `-d, --database-id`  | 変換元の database_id または data_source_id     |
| `-p, --page-id`      | 書き込み先ページ ID（ファイル出力時は無視）    |
| `-o, --output`       | 出力先ディレクトリ（指定時はファイル出力のみ） |
| `--no-format`        | Stylua フォーマットをスキップ                  |
| `-h, --help`         | ヘルプを表示                                   |

## 型変換ルール

| Notion 型    | Luau 型                        |
| ------------ | ------------------------------ |
| Number       | `number`                       |
| Checkbox     | `boolean`                      |
| Rich Text    | `string`                       |
| Select       | `string`                       |
| Multi Select | `{ "a", "b" }`                 |
| Date         | ISO 8601 文字列                |
| URL          | `string`                       |
| Formula      | 評価結果の型に応じて変換       |
| Status       | `string`                       |
| 空           | 出力から省略（内部では `nil`） |

未対応型（Relation, Rollup, Files, People など）はスキップします。

## 出力例

データベース:

| Name  | Damage | Cooldown |
| ----- | ------ | -------- |
| Sword | 25     | 1.2      |
| Axe   | 40     | 2        |

生成結果（`-o ./output/Weapons.luau` の場合）:

```lua
export type WeaponsEntry = {
    Cooldown: number?,
    Damage: number?,
}

export type Weapons = {
    Axe: WeaponsEntry,
    Sword: WeaponsEntry,
}

local Weapons: Weapons = {
    Axe = {
        Cooldown = 2,
        Damage = 40,
    },
    Sword = {
        Cooldown = 1.2,
        Damage = 25,
    },
}

return Weapons
```

`-o` に `.lua` / `.luau` ファイルを指定した場合、そのパスとファイル名（拡張子除く）がモジュール変数名に使われます。

## エラー

次の場合、分かりやすいメッセージを返します。

- title 型の主キー列が存在しない / 空 / 重複
- データベース・ページが見つからない
- データ取得・書き込み失敗
- 権限不足
- 出力ディレクトリが存在しない

## プロジェクト構成

```
src/
  cli.ts          # CLI エントリポイント
  env.ts          # .env ローダ・トークン検証
  generate.ts     # Luau 生成オーケストレーション
  resolve-page.ts # 書き込み先ページ解決
  stylua.ts       # Stylua フォーマット
  file-output.ts  # ファイル出力
  notion.ts       # Notion API 操作・プロパティ変換
  generator.ts    # Luau ModuleScript 生成
  formatter.ts    # Luau 値・キーのフォーマット
  blocks.ts       # コードブロック検索・更新
  types.ts        # 共有型定義
  errors.ts       # エラーハンドリング
tests/            # ユニットテスト
```

## 拡張性

`generator.ts` の `ModuleGenerator` と `blocks.ts` の `CodeBlockUpdater` インターフェースにより、将来の ModuleScript 分割や出力先の差し替えが可能です。

## ライセンス

MIT License. 詳細は [LICENSE](./LICENSE) を参照してください。
