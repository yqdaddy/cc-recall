import { generateCandidates, getDb } from "../db";
import { sync, calculateValueScore } from "../sync";
import { formatCandidates } from "../format";

export interface IngestOptions {
  candidates?: boolean;
  session?: string;
  minScore?: number;
  format?: "text" | "json";
  noSync?: boolean;
}

export async function ingest(options: IngestOptions): Promise<void> {
  if (!options.noSync) {
    const result = sync();
    if (result.newMessages > 0 && !options.candidates) {
      console.log(`Indexed ${result.newMessages} new messages`);
    }
  }

  // candidates mode - output JSON for SessionEnd Hook
  if (options.candidates) {
    const candidates = generateCandidates(options.session, options.minScore);

    if (options.format === "json") {
      // Output JSON for SessionEnd Hook parsing
      const output = {
        hookSpecificOutput: {
          hookEventName: "RecallCandidates",
          candidates: candidates.map((c) => ({
            type: c.content_type,
            content: c.content.slice(0, 500), // Truncate for readability
            score: c.value_score,
            session: c.session_id,
            cwd: c.cwd,
          })),
        },
      };
      console.log(JSON.stringify(output, null, 2));
    } else {
      formatCandidates(candidates);
    }
    return;
  }

  // Default: show stats
  const db = getDb();
  const stats = {
    totalCommands: db.query(`SELECT COUNT(*) as count FROM commands`).get() as { count: number },
    totalMessages: db.query(`SELECT COUNT(*) as count FROM messages`).get() as { count: number },
  };

  console.log(`
recall index stats:
  Commands: ${stats.totalCommands.count}
  Messages: ${stats.totalMessages.count}

Run "recall ingest --candidates" to generate knowledge ingestion candidates.
`);
}