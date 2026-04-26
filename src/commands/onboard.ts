import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface OnboardOptions {
  force?: boolean;
}

const MARKER = "<!-- recall:onboard -->";

const RECALL_SECTION = `${MARKER}
<recall>
Use \`recall\` to search bash commands from previous Claude Code sessions.

<commands>
- \`recall search <pattern>\` - Search by substring (or \`--regex\`)
- \`recall list\` - Recent commands
- \`recall list --here\` - Recent commands in current project
- \`recall search <pattern> --here\` - Search in current project
</commands>

<when-to-use>
- "Deploy like we did last time"
- "Run the same build command"
- "What was that curl/docker/git command?"
- "Set it up like we did on the other project"
- "Show me the failed builds"
- Looking up commands from previous sessions
</when-to-use>

<when-not-to-use>
- Finding files -> use Glob
- Searching file contents -> use Grep
- Commands from current session -> already in context
</when-not-to-use>
</recall>
`;

export function onboard(options: OnboardOptions = {}): void {
  const claudeDir = join(homedir(), ".claude");
  const targetFile = join(claudeDir, "CLAUDE.md");

  // Ensure ~/.claude directory exists
  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true });
  }

  let existingContent = "";
  if (existsSync(targetFile)) {
    existingContent = readFileSync(targetFile, "utf-8");
  }

  // Check for old markers (deja, ran) and new marker
  const oldMarkers = ["<!-- deja:onboard -->", "<!-- ran:onboard -->"];
  let hasOldMarker = false;
  let oldMarkerFound = "";

  for (const marker of oldMarkers) {
    if (existingContent.includes(marker)) {
      hasOldMarker = true;
      oldMarkerFound = marker;
      break;
    }
  }

  const hasNewMarker = existingContent.includes(MARKER);

  if (hasNewMarker) {
    if (!options.force) {
      console.log(`recall section already exists in ${targetFile}`);
      console.log("Use --force to update it");
      return;
    }
    // Remove existing section for replacement
    const markerIndex = existingContent.indexOf(MARKER);
    const nextSectionMatch = existingContent.slice(markerIndex + MARKER.length).match(/\n## /);
    if (nextSectionMatch && nextSectionMatch.index !== undefined) {
      const endIndex = markerIndex + MARKER.length + nextSectionMatch.index;
      existingContent = existingContent.slice(0, markerIndex) + existingContent.slice(endIndex);
    } else {
      existingContent = existingContent.slice(0, markerIndex);
    }
  } else if (hasOldMarker) {
    // Remove old section and replace with new recall section
    const markerIndex = existingContent.indexOf(oldMarkerFound);
    const nextSectionMatch = existingContent.slice(markerIndex + oldMarkerFound.length).match(/\n## /);
    if (nextSectionMatch && nextSectionMatch.index !== undefined) {
      const endIndex = markerIndex + oldMarkerFound.length + nextSectionMatch.index;
      existingContent = existingContent.slice(0, markerIndex) + existingContent.slice(endIndex);
    } else {
      existingContent = existingContent.slice(0, markerIndex);
    }
    console.log(`Migrating from ${oldMarkerFound} to recall...`);
  }

  const newContent = existingContent
    ? existingContent.trimEnd() + "\n\n" + RECALL_SECTION
    : RECALL_SECTION;

  writeFileSync(targetFile, newContent);

  const action = existingContent ? "Updated" : "Created";
  console.log(`${action} ${targetFile} with recall section`);
}