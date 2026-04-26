#!/usr/bin/env bun

import { search } from "./commands/search";
import { list } from "./commands/list";
import { syncCommand } from "./commands/syncCmd";
import { onboard } from "./commands/onboard";
import { chatSearch, chatSession } from "./commands/chat";
import { ingest } from "./commands/ingest";
import { parseArgs } from "./cli";

const VERSION = "0.5.0";
const REPO_URL = "https://github.com/yqdaddy/cc-recall";

const args = process.argv.slice(2);
const command = args[0];

function printHelp(): void {
  console.log(`
\x1b[1mrecall\x1b[0m v${VERSION} - Claude Code history & conversation search
${REPO_URL}

\x1b[1mUSAGE:\x1b[0m
  recall <command> [options]

\x1b[1mCOMMANDS:\x1b[0m
  search <pattern>   Search command history
    --regex, -r      Use regex pattern
    --cwd <path>     Filter by working directory
    --here, -H       Filter by current directory
    --limit, -n <N>  Limit results
    --sort <mode>    Sort by: frecency (default), time
    --no-sync        Skip auto-sync

  list               List recent commands
    --limit, -n <N>  Number of commands (default: 20)
    --here, -H       Filter by current directory
    --sort <mode>    Sort by: frecency (default), time
    --no-sync        Skip auto-sync

  sync               Sync command history from Claude sessions
    --force, -f      Force re-index all sessions

  onboard            Add recall section to ~/.claude/CLAUDE.md
    --force, -f      Update existing section

  chat search <pattern>   Search conversation content
    --type <type>          Filter: text, thinking, all (default: all)
    --cwd <path>           Filter by working directory
    --session <id>         Filter by session ID
    --limit, -n <N>        Limit results
    --format <fmt>         Output: text (default), json
    --no-sync              Skip auto-sync

  chat session <session_id>  View full session timeline
    --format <fmt>           Output: text (default), json
    --include-commands       Include bash commands in timeline
    --no-sync                Skip auto-sync

  ingest             Show index stats or generate candidates
    --candidates             Generate knowledge ingestion candidates
    --session <id>           Filter by session ID
    --min-score <N>          Minimum value score (default: 50)
    --format <fmt>           Output: text (default), json
    --no-sync                Skip auto-sync

\x1b[1mEXAMPLES:\x1b[0m
  recall search docker
  recall search "git.*main" --regex
  recall search npm --cwd /projects/myapp
  recall search npm --here
  recall search npm --sort time
  recall list --limit 50
  recall list --here
  recall sync --force
  recall chat search "deployment"
  recall chat search "error" --type thinking
  recall chat session abc-123-session
  recall ingest --candidates --format json
`);
}

async function main(): Promise<void> {
  const { flags, positional } = parseArgs(args.slice(1));

  // Handle --here flag by setting cwd to current directory
  const cwd = flags.here ? process.cwd() : (flags.cwd as string);

  switch (command) {
    case "search":
    case "s":
      if (positional.length === 0) {
        console.error("Error: search requires a pattern");
        process.exit(1);
      }
      await search(positional[0], {
        regex: flags.regex as boolean,
        cwd,
        limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
        noSync: flags.noSync as boolean,
        sort: (flags.sort as string) || "frecency",
      });
      break;

    case "list":
    case "ls":
    case "l":
      await list({
        limit: flags.limit ? parseInt(flags.limit as string, 10) : undefined,
        noSync: flags.noSync as boolean,
        sort: (flags.sort as string) || "frecency",
        cwd,
      });
      break;

    case "sync":
      await syncCommand({
        force: flags.force as boolean,
      });
      break;

    case "onboard":
      onboard({
        force: flags.force as boolean,
      });
      break;

    case "chat":
      const chatSubCommand = args[1];
      if (!chatSubCommand) {
        console.error("Error: chat requires a subcommand (search, session)");
        process.exit(1);
      }
      const chatFlags = parseArgs(args.slice(2)).flags;
      const chatPos = parseArgs(args.slice(2)).positional;

      if (chatSubCommand === "search") {
        if (chatPos.length === 0) {
          console.error("Error: chat search requires a pattern");
          process.exit(1);
        }
        await chatSearch({
          pattern: chatPos[0],
          type: (chatFlags.type as "text" | "thinking" | "all") || "all",
          cwd: chatFlags.here ? process.cwd() : (chatFlags.cwd as string),
          session: chatFlags.session as string,
          limit: chatFlags.limit ? parseInt(chatFlags.limit as string, 10) : 20,
          format: (chatFlags.format as "text" | "json") || "text",
          noSync: chatFlags.noSync as boolean,
        });
      } else if (chatSubCommand === "session") {
        if (chatPos.length === 0) {
          console.error("Error: chat session requires a session_id");
          process.exit(1);
        }
        await chatSession({
          sessionId: chatPos[0],
          format: (chatFlags.format as "text" | "json") || "text",
          includeCommands: chatFlags["include-commands"] as boolean,
          noSync: chatFlags.noSync as boolean,
        });
      } else {
        console.error(`Unknown chat subcommand: ${chatSubCommand}`);
        process.exit(1);
      }
      break;

    case "ingest":
      await ingest({
        candidates: flags.candidates as boolean,
        session: flags.session as string,
        minScore: flags["min-score"] ? parseInt(flags["min-score"] as string, 10) : 50,
        format: (flags.format as "text" | "json") || "text",
        noSync: flags.noSync as boolean,
      });
      break;

    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;

    case "--version":
    case "-v":
    case "-V":
      console.log(VERSION);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});