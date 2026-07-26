import { Client, LogLevel, type Logger } from "@notionhq/client";

const notionLogger: Logger = (level, message, extraInfo) => {
  const formatted = `@notionhq/client ${level}: ${message} ${JSON.stringify(extraInfo)}`;
  if (level === LogLevel.ERROR) {
    console.error(formatted);
    return;
  }

  console.warn(formatted);
};

export function createNotionClient(auth: string): Client {
  return new Client({
    auth,
    logger: (level, message, extraInfo) => {
      if (
        level === LogLevel.WARN &&
        message === "request fail" &&
        extraInfo.code === "object_not_found"
      ) {
        return;
      }

      notionLogger(level, message, extraInfo);
    },
  });
}
