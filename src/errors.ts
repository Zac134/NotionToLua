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
        return "Database or page not found. Check the integration connection and ID.";
      case "unauthorized":
      case "restricted_resource":
        return "Insufficient permissions. Share the target page and database with the integration.";
      case "validation_error":
        return notionError.message ?? "Invalid Notion API input.";
      default:
        break;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred.";
}
