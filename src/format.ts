import type { Command, CommandWithFrecency } from "./db";

/**
 * Highlight matching text in a string with ANSI bold yellow
 */
export function highlightMatch(text: string, pattern: string, useRegex: boolean): string {
  if (!pattern) {
    return text;
  }

  const HIGHLIGHT_START = "\x1b[1;33m"; // Bold yellow
  const HIGHLIGHT_END = "\x1b[0m\x1b[36m"; // Reset to cyan (command color)

  try {
    const regex = useRegex
      ? new RegExp(`(${pattern})`, "gi")
      : new RegExp(`(${escapeRegex(pattern)})`, "gi");

    return text.replace(regex, `${HIGHLIGHT_START}$1${HIGHLIGHT_END}`);
  } catch {
    // If regex is invalid, return text as-is
    return text;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface FormatOptions {
  pattern?: string;
  useRegex?: boolean;
  showFrequency?: boolean;
}

export function formatCommand(cmd: Command | CommandWithFrecency, options: FormatOptions = {}): void {
  const time = cmd.timestamp ? new Date(cmd.timestamp).toLocaleString() : "unknown";
  const status = cmd.is_error ? "\x1b[31m[error]\x1b[0m" : "\x1b[32m[ok]\x1b[0m";

  let commandText = cmd.command;
  if (options.pattern) {
    commandText = highlightMatch(commandText, options.pattern, options.useRegex ?? false);
  }

  // Show frequency if available and enabled
  const frequency = "frequency" in cmd ? (cmd as CommandWithFrecency).frequency : undefined;
  const frequencyDisplay = options.showFrequency && frequency && frequency > 1
    ? ` \x1b[90m(×${frequency})\x1b[0m`
    : "";

  console.log(`${status} \x1b[36m${commandText}\x1b[0m${frequencyDisplay}`);

  if (cmd.description) {
    console.log(`   \x1b[90m${cmd.description}\x1b[0m`);
  }

  console.log(`   \x1b[90m${time} | ${cmd.cwd ?? "unknown dir"}\x1b[0m`);
  console.log();
}

// ============ Message Formatting ============

export interface MessageResult {
  id: number;
  uuid: string;
  session_id: string | null;
  content_type: string;
  content: string | null;
  cwd: string | null;
  timestamp: string | null;
  source: string;
}

export function formatMessages(messages: MessageResult[], pattern?: string): void {
  if (messages.length === 0) {
    console.log("\x1b[90mNo messages found\x1b[0m\n");
    return;
  }

  for (const msg of messages) {
    const time = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : "unknown";
    const typeColor = msg.source === "thinking" ? "\x1b[35m" : "\x1b[36m"; // Magenta for thinking, cyan for text

    console.log(`${typeColor}[${msg.content_type}]\x1b[0m`);

    if (msg.content) {
      // Truncate long content
      const displayContent = msg.content.length > 200 ? msg.content.slice(0, 200) + "..." : msg.content;

      // Highlight pattern if provided
      let contentText = displayContent;
      if (pattern) {
        contentText = highlightMatch(displayContent, pattern, false);
      }

      console.log(`  ${contentText}`);
    }

    console.log(`  \x1b[90m${time} | ${msg.cwd ?? "unknown"} | session: ${msg.session_id?.slice(0, 8) ?? "?"}...\x1b[0m`);
    console.log();
  }

  console.log(`\x1b[90m${messages.length} messages\x1b[0m`);
}

export interface TimelineItem {
  type: string;
  content: string | null;
  timestamp: string | null;
  cwd: string | null;
}

export function formatSessionTimeline(timeline: TimelineItem[], sessionId: string): void {
  console.log(`\x1b[1mSession: ${sessionId}\x1b[0m\n`);

  if (timeline.length === 0) {
    console.log("\x1b[90mEmpty session\x1b[0m\n");
    return;
  }

  for (const item of timeline) {
    const time = item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : "?";

    // Color based on type
    let typeIndicator: string;
    switch (item.type) {
      case "text":
        typeIndicator = "\x1b[36m[text]\x1b[0m";
        break;
      case "thinking":
        typeIndicator = "\x1b[35m[think]\x1b[0m";
        break;
      case "tool_use":
        typeIndicator = "\x1b[33m[tool]\x1b[0m";
        break;
      case "tool_result":
        typeIndicator = "\x1b[32m[result]\x1b[0m";
        break;
      case "command":
        typeIndicator = "\x1b[34m[cmd]\x1b[0m";
        break;
      default:
        typeIndicator = `\x1b[90m[${item.type}]\x1b[0m`;
    }

    if (item.content) {
      const displayContent = item.content.length > 100 ? item.content.slice(0, 100) + "..." : item.content;
      console.log(`${time} ${typeIndicator} ${displayContent}`);
    } else {
      console.log(`${time} ${typeIndicator}`);
    }
  }

  console.log(`\n\x1b[90m${timeline.length} items in timeline\x1b[0m`);
}

export interface CandidateResult {
  id: number;
  session_id: string;
  message_uuid: string | null;
  content_type: string;
  content: string;
  value_score: number | null;
  cwd: string | null;
  timestamp: string | null;
}

export function formatCandidates(candidates: CandidateResult[]): void {
  if (candidates.length === 0) {
    console.log("\x1b[90mNo candidates found\x1b[0m\n");
    return;
  }

  console.log(`\x1b[1mCandidates for knowledge ingestion:\x1b[0m\n`);

  for (const cand of candidates) {
    const score = cand.value_score ?? 0;
    const scoreColor = score >= 70 ? "\x1b[32m" : score >= 50 ? "\x1b[33m" : "\x1b[90m";
    const typeColor = cand.content_type === "thinking" ? "\x1b[35m" : "\x1b[36m";

    console.log(`${scoreColor}[score: ${score}]\x1b[0m ${typeColor}[${cand.content_type}]\x1b[0m`);

    // Show truncated content
    const preview = cand.content.length > 150 ? cand.content.slice(0, 150) + "..." : cand.content;
    console.log(`  ${preview}`);

    console.log(`  \x1b[90mSession: ${cand.session_id.slice(0, 12)}... | ${cand.cwd ?? "unknown"}\x1b[0m`);
    console.log();
  }

  console.log(`\x1b[90m${candidates.length} candidates (min score: 50)\x1b[0m`);
}
