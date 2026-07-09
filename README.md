# NotionToLua

Notion Developer Platform（Notion Workers）上で動作する Luau コードジェネレーターです。  
ページ内のカスタムツール **「Generate Luau」** から、指定したデータベースの全レコードを読み込み、Roblox Luau の `ModuleScript` 形式へ変換して同一ページのコードブロックへ反映します。

## 機能

- `worker.tool("generateLuau")` としてデプロイ（Custom Agent 向け）
- `worker.webhook("generateLuauWebhook")` としてデプロイ（オートメーション・ボタン向け）
- データベース全レコードの取得（ページネーション対応）
- Notion プロパティ型 → Luau 型変換
- ページ内の `language = lua`（UI 上の Luau 含む）コードブロックを検索して上書き、なければ末尾に新規作成
- Name 列をトップレベルキーとして使用（重複・空はエラー）
- 未対応プロパティ型はスキップ

## 前提

- Node.js 22+
- Notion Business 以上（Workers 利用）
- [Notion CLI (`ntn`)](https://developers.notion.com/) がインストール済み
- 対象ページ・データベースが Integration / Worker に共有済み

## セットアップ

```bash
# 依存関係のインストール
npm install

# 型チェック
npm run check

# ユニットテスト
npm test
```

### ローカル実行用の環境変数

```bash
cp .env.example .env
```

`.env` に `NOTION_API_TOKEN`（Integration の Internal Integration Secret）を設定します。  
ローカルで `ntn workers exec` する際に使用されます。

Webhook 用の任意設定:

| 変数                  | 用途                                                  |
| --------------------- | ----------------------------------------------------- |
| `WEBHOOK_SECRET`      | オートメーションの `x-webhook-secret` ヘッダーと照合  |
| `DEFAULT_DATABASE_ID` | `databaseId` 未指定時のデフォルト DB / data_source ID |

Worker シークレットとして `ntn workers secrets set` でも設定できます。

## デプロイ

```bash
# Notion ワークスペースにログイン（初回のみ）
ntn auth login

# Worker をデプロイ
ntn workers deploy
```

デプロイ後、Notion の Custom Agent 設定から **Generate Luau** ツールを有効化してください。

Webhook URL の確認:

```bash
ntn workers webhooks list
```

## 使い方

### 方法 A: Custom Agent ツール（既存）

#### 1. Notion ページの準備

1. 変換元のデータベースをページにリンク（linked database view）として配置
2. 同一ページに `Lua` / `Luau` のコードブロックを置く（任意。なければ自動作成）
3. データベースに **Name**（title 型）列を必ず用意

### 2. ツールの実行（Custom Agent）

ページのカスタムツールから **Generate Luau** を実行し、次の入力を渡します。

| 入力         | 説明                                                                                 |
| ------------ | ------------------------------------------------------------------------------------ |
| `pageId`     | コードを書き込むページ ID                                                            |
| `databaseId` | 変換元の database_id または data_source_id（複数データソースがある DB は後者を指定） |

### 3. ローカルでの動作確認（Custom Agent）

```bash
ntn workers exec generateLuau --local \
  -d '{"pageId":"<PAGE_ID>","databaseId":"<DATABASE_ID>"}'
```

### 方法 B: Webhook（エージェント不要）

Notion の **オートメーション** または **ページ/DB ボタン** から Worker を直接起動できます。

#### 1. Webhook URL を取得

```bash
ntn workers deploy
ntn workers webhooks list
```

`generateLuauWebhook` の URL をコピーします（URL はパスワード同等 — 共有に注意）。

#### 2. Notion オートメーションを設定

1. 対象 DB またはページで **+ New automation** を作成
2. トリガーを設定（例: ボタン押下、ステータス変更）
3. アクション: **Send webhook**
4. Webhook URL を貼り付け
5. 必要に応じてカスタムヘッダーを追加:

| ヘッダー           | 値                         | 必須                                    |
| ------------------ | -------------------------- | --------------------------------------- |
| `x-webhook-secret` | `WEBHOOK_SECRET` と同じ値  | 推奨（設定時）                          |
| `x-database-id`    | 変換元 DB / data_source ID | ページ内にリンク DB が1つだけなら省略可 |
| `x-page-id`        | 書き込み先ページ ID        | Notion が自動送信する場合は省略可       |

> Notion オートメーションは **カスタム body を送れません**（ヘッダーのみ）。  
> `pageId` は Notion から送られる ID を利用するか、`x-page-id` ヘッダーで指定してください。  
> `databaseId` が未指定の場合、ページ内の最初のリンク DB（`child_database`）を自動検出します。

#### 3. curl での手動テスト

```bash
curl -X POST "<WEBHOOK_URL>" \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-random-webhook-secret" \
  -d '{"pageId":"<PAGE_ID>","databaseId":"<DATABASE_ID>"}'
```

#### 4. ログ確認

```bash
ntn workers runs logs <run-id>
```

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

生成結果:

```lua
return {
    Axe = {
        Cooldown = 2,
        Damage = 40,
    },
    Sword = {
        Cooldown = 1.2,
        Damage = 25,
    },
}
```

## エラー

次の場合、分かりやすいメッセージを返します。

- Name 列が存在しない / 空 / 重複
- データベース・ページが見つからない
- データ取得・書き込み失敗
- 権限不足

## プロジェクト構成

```
src/
  index.ts      # Worker エントリポイント（tool + webhook）
  generate.ts   # 共有の Luau 生成オーケストレーション
  webhook.ts    # Webhook 入力パース・認証
  notion.ts     # Notion API 操作・プロパティ変換
  generator.ts  # Luau ModuleScript 生成
  formatter.ts  # Luau 値・キーのフォーマット
  blocks.ts     # コードブロック検索・更新
  types.ts      # 共有型定義
  errors.ts     # エラーハンドリング
tests/          # ユニットテスト
```

## 拡張性

`generator.ts` の `ModuleGenerator` と `blocks.ts` の `CodeBlockUpdater` インターフェースにより、将来の ModuleScript 分割や出力先の差し替えが可能です。

## ライセンス

Private
