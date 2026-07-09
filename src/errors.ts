export class NotionToLuaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotionToLuaError";
  }
}

export function toUserErrorMessage(error: unknown): string {
  if (error instanceof NotionToLuaError) {
    return error.message;
  }

  if (error && typeof error === "object" && "code" in error) {
    const notionError = error as { code?: string; message?: string };

    switch (notionError.code) {
      case "object_not_found":
        return "データベースまたはページが見つかりません。Integration の接続と ID を確認してください。";
      case "unauthorized":
      case "restricted_resource":
        return "権限が不足しています。対象ページとデータベースを Integration に共有してください。";
      case "validation_error":
        return notionError.message ?? "Notion API の入力が不正です。";
      default:
        break;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "予期しないエラーが発生しました。";
}
