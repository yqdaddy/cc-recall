import { searchMessages, getSessionMessages, getSessionCommands, getDb } from "../db";
import { sync } from "../sync";
import { formatMessages, formatSessionTimeline } from "../format";

export interface ChatSearchOptions {
  pattern: string;
  type?: "text" | "thinking" | "all";
  cwd?: string;
  session?: string;
  limit?: number;
  format?: "text" | "json";
  noSync?: boolean;
}

export interface ChatSessionOptions {
  sessionId: string;
  format?: "text" | "json";
  includeCommands?: boolean;
  noSync?: boolean;
}

export async function chatSearch(options: ChatSearchOptions): Promise<void> {
  if (!options.noSync) {
    const result = sync();
    if (result.newMessages > 0) {
      console.log(`Indexed ${result.newMessages} new messages from ${result.filesScanned} files\n`);
    }
  }

  const results: Array<{
    id: number;
    uuid: string;
    session_id: string | null;
    content_type: string;
    content: string | null;
    cwd: string | null;
    timestamp: string | null;
    source: string;
  }> = [];

  const contentType = options.type ?? "all";

  if (contentType === "thinking" || contentType === "all") {
    const thoughts = searchMessages(options.pattern, options.cwd, options.session, "thinking");
    results.push(
      ...thoughts.map((t) => ({
        id: t.id,
        uuid: t.uuid,
        session_id: t.session_id,
        content_type: t.content_type,
        content: t.content,
        cwd: t.cwd,
        timestamp: t.timestamp,
        source: "thinking",
      }))
    );
  }

  if (contentType === "text" || contentType === "all") {
    const messages = searchMessages(options.pattern, options.cwd, options.session, "text");
    results.push(
      ...messages.map((m) => ({
        id: m.id,
        uuid: m.uuid,
        session_id: m.session_id,
        content_type: m.content_type,
        content: m.content,
        cwd: m.cwd,
        timestamp: m.timestamp,
        source: "text",
      }))
    );
  }

  // Sort by timestamp
  results.sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return bTime - aTime;
  });

  const limited = options.limit ? results.slice(0, options.limit) : results;

  if (options.format === "json") {
    console.log(JSON.stringify(limited, null, 2));
  } else {
    formatMessages(limited, options.pattern);
  }
}

export async function chatSession(options: ChatSessionOptions): Promise<void> {
  if (!options.noSync) {
    const result = sync();
    if (result.newMessages > 0) {
      console.log(`Indexed ${result.newMessages} new messages\n`);
    }
  }

  const messages = getSessionMessages(options.sessionId);
  const commands = options.includeCommands ? getSessionCommands(options.sessionId) : [];

  // Combine and sort by timestamp
  const timeline = [...messages, ...commands]
    .map((item) => ({
      type: "content_type" in item ? item.content_type : "command",
      content:
        "content" in item
          ? item.content
          : `command: ${item.command}${item.description ? ` (${item.description})` : ""}`,
      timestamp: item.timestamp,
      cwd: item.cwd,
    }))
    .sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return aTime - bTime;
    });

  if (options.format === "json") {
    console.log(
      JSON.stringify(
        {
          session: options.sessionId,
          messageCount: messages.length,
          commandCount: commands.length,
          timeline,
        },
        null,
        2
      )
    );
  } else {
    formatSessionTimeline(timeline, options.sessionId);
  }
}