import { Database } from "bun:sqlite";
import { homedir } from "os";
import { join } from "path";
import { statSync, readFileSync, readdirSync, existsSync } from "fs";
import {
  getIndexedFile,
  updateIndexedFile,
  insertCommand,
  getDb,
  insertMessage,
  checkMessagesTableExists,
} from "./db";

const CLAUDE_PROJECTS_DIR = join(homedir(), ".claude", "projects");

export interface ToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: {
    command?: string;
    description?: string;
  };
}

export interface ToolResult {
  tool_use_id: string;
  type: "tool_result";
  content: string;
  is_error?: boolean;
}

export interface TextContent {
  type: "text";
  text: string;
}

export interface ThinkingContent {
  type: "thinking";
  thinking: string;
}

export interface MessageEntry {
  type: "user" | "assistant";
  message: {
    role: string;
    content: string | Array<ToolUse | ToolResult | TextContent | ThinkingContent | { type: string }>;
  };
  cwd?: string;
  sessionId?: string;
  timestamp?: string;
  uuid?: string;
  parentUuid?: string;
  toolUseResult?: {
    stdout?: string;
    stderr?: string;
    interrupted?: boolean;
  };
}

export interface ParsedCommand {
  tool_use_id: string;
  command: string;
  description: string | null;
  cwd: string | null;
  stdout: string | null;
  stderr: string | null;
  is_error: number;
  timestamp: string | null;
  session_id: string | null;
}

export interface ParsedMessage {
  uuid: string;
  parent_uuid: string | null;
  session_id: string | null;
  type: "user" | "assistant";
  content_type: "text" | "thinking" | "tool_use" | "tool_result";
  content: string | null;
  tool_name: string | null;
  tool_id: string | null;
  cwd: string | null;
  timestamp: string | null;
  word_count: number | null;
}

export interface SyncResult {
  filesScanned: number;
  newCommands: number;
  newMessages: number;
  errors: string[];
}

/**
 * Parse JSONL content and extract Bash commands with their results.
 * Exported for testing.
 */
export function parseJsonlContent(
  content: string,
  sessionId: string | null = null
): { commands: ParsedCommand[]; messages: ParsedMessage[] } {
  const lines = content.split("\n");
  const entries: MessageEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed));
    } catch {
      // Skip malformed lines
    }
  }

  return {
    commands: extractCommands(entries, sessionId),
    messages: extractMessages(entries, sessionId),
  };
}

/**
 * Generate a UUID from timestamp and random suffix
 */
function generateUuid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Extract commands from parsed message entries.
 * Exported for testing.
 */
export function extractCommands(entries: MessageEntry[], sessionId: string | null = null): ParsedCommand[] {
  const commands: ParsedCommand[] = [];
  const pendingToolUses = new Map<string, { toolUse: ToolUse; cwd?: string; timestamp?: string }>();

  for (const entry of entries) {
    if (entry.type === "assistant" && Array.isArray(entry.message.content)) {
      for (const item of entry.message.content) {
        if (item.type === "tool_use" && (item as ToolUse).name === "Bash") {
          const toolUse = item as ToolUse;
          if (toolUse.input?.command) {
            pendingToolUses.set(toolUse.id, {
              toolUse,
              cwd: entry.cwd,
              timestamp: entry.timestamp,
            });
          }
        }
      }
    }

    if (entry.type === "user" && Array.isArray(entry.message.content)) {
      for (const item of entry.message.content) {
        if (item.type === "tool_result") {
          const toolResult = item as ToolResult;
          const pending = pendingToolUses.get(toolResult.tool_use_id);

          if (pending) {
            commands.push({
              tool_use_id: toolResult.tool_use_id,
              command: pending.toolUse.input.command!,
              description: pending.toolUse.input.description ?? null,
              cwd: pending.cwd ?? null,
              stdout: entry.toolUseResult?.stdout ?? toolResult.content ?? null,
              stderr: entry.toolUseResult?.stderr ?? null,
              is_error: toolResult.is_error ? 1 : 0,
              timestamp: pending.timestamp ?? null,
              session_id: sessionId,
            });
            pendingToolUses.delete(toolResult.tool_use_id);
          }
        }
      }
    }
  }

  return commands;
}

/**
 * Extract messages (text, thinking, tool_use, tool_result) from parsed entries.
 * Exported for testing.
 */
export function extractMessages(entries: MessageEntry[], sessionId: string | null = null): ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  for (const entry of entries) {
    // 处理 assistant 消息
    if (entry.type === "assistant" && Array.isArray(entry.message.content)) {
      for (const item of entry.message.content) {
        // Extract thinking content
        if (item.type === "thinking") {
          const thinking = (item as ThinkingContent).thinking;
          messages.push({
            uuid: entry.uuid ?? generateUuid(),
            parent_uuid: entry.parentUuid ?? null,
            session_id: sessionId ?? entry.sessionId ?? null,
            type: "assistant",
            content_type: "thinking",
            content: thinking,
            tool_name: null,
            tool_id: null,
            cwd: entry.cwd ?? null,
            timestamp: entry.timestamp ?? null,
            word_count: thinking.split(/\s+/).length,
          });
        }
        // Extract text content
        else if (item.type === "text") {
          const text = (item as TextContent).text;
          messages.push({
            uuid: entry.uuid ?? generateUuid(),
            parent_uuid: entry.parentUuid ?? null,
            session_id: sessionId ?? entry.sessionId ?? null,
            type: "assistant",
            content_type: "text",
            content: text,
            tool_name: null,
            tool_id: null,
            cwd: entry.cwd ?? null,
            timestamp: entry.timestamp ?? null,
            word_count: text.split(/\s+/).length,
          });
        }
        // Extract tool_use (all tools, not just Bash)
        else if (item.type === "tool_use") {
          const toolUse = item as ToolUse;
          messages.push({
            uuid: entry.uuid ?? generateUuid(),
            parent_uuid: entry.parentUuid ?? null,
            session_id: sessionId ?? entry.sessionId ?? null,
            type: "assistant",
            content_type: "tool_use",
            content: toolUse.input?.description ?? null,
            tool_name: toolUse.name,
            tool_id: toolUse.id,
            cwd: entry.cwd ?? null,
            timestamp: entry.timestamp ?? null,
            word_count: null,
          });
        }
      }
    }

    // 处理 user 消息
    if (entry.type === "user") {
      const content = entry.message.content;
      // 用户纯文本输入
      if (typeof content === "string" && content.trim()) {
        messages.push({
          uuid: entry.uuid ?? generateUuid(),
          parent_uuid: entry.parentUuid ?? null,
          session_id: sessionId ?? entry.sessionId ?? null,
          type: "user",
          content_type: "text",
          content: content,
          tool_name: null,
          tool_id: null,
          cwd: entry.cwd ?? null,
          timestamp: entry.timestamp ?? null,
          word_count: content.split(/\s+/).length,
        });
      }
      // tool_result
      else if (Array.isArray(content)) {
        for (const item of content) {
          if (item.type === "tool_result") {
            messages.push({
              uuid: entry.uuid ?? generateUuid(),
              parent_uuid: entry.parentUuid ?? null,
              session_id: sessionId ?? entry.sessionId ?? null,
              type: "user",
              content_type: "tool_result",
              content: null,
              tool_name: null,
              tool_id: (item as ToolResult).tool_use_id,
              cwd: entry.cwd ?? null,
              timestamp: entry.timestamp ?? null,
              word_count: null,
            });
          }
        }
      }
    }
  }

  return messages;
}

/**
 * Calculate value score for content (0-100)
 * Higher score = more likely to be valuable for knowledge ingestion
 */
export function calculateValueScore(content: string, contentType: string): number {
  let score = 0;

  // Length score (0-30)
  const wordCount = content.split(/\s+/).length;
  score += Math.min(30, wordCount * 0.3);

  // Type weighting
  if (contentType === "thinking") {
    score += 20; // thinking is generally more valuable
  }

  // Keyword patterns
  if (containsKeyPatterns(content)) {
    score += 15;
  }

  return Math.min(100, Math.round(score));
}

function containsKeyPatterns(content: string): boolean {
  const patterns = [
    /solve|fix|resolve|implement|design|create|build/i,
    /error|fail|bug|issue|problem|debug/i,
    /best practice|recommend|should|important|note/i,
    /config|setup|install|deploy|architecture/i,
    /decision|approach|strategy|solution/i,
  ];
  return patterns.some((p) => p.test(content));
}

export interface SyncOptions {
  force?: boolean;
  db?: Database;
  projectsDir?: string;
}

export function sync(options: SyncOptions = {}): SyncResult {
  const { force = false, db, projectsDir = CLAUDE_PROJECTS_DIR } = options;
  const database = db ?? getDb();

  const result: SyncResult = {
    filesScanned: 0,
    newCommands: 0,
    newMessages: 0,
    errors: [],
  };

  if (!existsSync(projectsDir)) {
    result.errors.push(`Claude projects directory not found: ${projectsDir}`);
    return result;
  }

  // Check if messages table exists - if not and commands exist, force rebuild
  const messagesTableExists = checkMessagesTableExists(database);
  const shouldForceMessages = !messagesTableExists && !force;
  const effectiveForce = force || shouldForceMessages;

  if (shouldForceMessages) {
    // Will rebuild messages index from existing data
  }

  // Find all .jsonl files
  const jsonlFiles: string[] = [];
  const projectDirs = readdirSync(projectsDir);

  for (const dir of projectDirs) {
    const projectPath = join(projectsDir, dir);
    try {
      const stat = statSync(projectPath);
      if (stat.isDirectory()) {
        const files = readdirSync(projectPath);
        for (const file of files) {
          if (file.endsWith(".jsonl")) {
            jsonlFiles.push(join(projectPath, file));
          }
        }
      }
    } catch (e) {
      // Skip files we can't read
    }
  }

  for (const filePath of jsonlFiles) {
    result.filesScanned++;

    try {
      const stat = statSync(filePath);
      const indexed = getIndexedFile(filePath, database);

      // Skip if already fully indexed (unless force)
      if (!effectiveForce && indexed && indexed.last_byte_offset >= stat.size) {
        continue;
      }

      const startOffset = effectiveForce ? 0 : (indexed?.last_byte_offset ?? 0);
      const { newCommands, newMessages } = indexFile(filePath, startOffset, database);
      result.newCommands += newCommands;
      result.newMessages += newMessages;

      updateIndexedFile(filePath, stat.size, stat.mtimeMs, database);
    } catch (e) {
      result.errors.push(`Error processing ${filePath}: ${e}`);
    }
  }

  return result;
}

function indexFile(
  filePath: string,
  startOffset: number,
  db: Database
): { newCommands: number; newMessages: number } {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Track byte position to find where startOffset lands
  let bytePos = 0;
  let startLine = 0;

  if (startOffset > 0) {
    for (let i = 0; i < lines.length; i++) {
      const lineBytes = Buffer.byteLength(lines[i], "utf-8") + 1; // +1 for newline
      if (bytePos + lineBytes > startOffset) {
        startLine = i;
        break;
      }
      bytePos += lineBytes;
    }
  }

  // Parse only new content
  const newContent = lines.slice(startLine).join("\n");
  const sessionId = filePath.split("/").pop()?.replace(".jsonl", "") ?? null;
  const { commands, messages } = parseJsonlContent(newContent, sessionId);

  for (const cmd of commands) {
    insertCommand(cmd, db);
  }

  for (const msg of messages) {
    insertMessage(msg, db);
  }

  return { newCommands: commands.length, newMessages: messages.length };
}
