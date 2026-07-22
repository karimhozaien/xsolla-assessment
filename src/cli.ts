#!/usr/bin/env node
// Repository inspector CLI.
//
// Usage:
//   inspector review --repo <path> --format markdown [--validate "<cmd>"]...
import { writeFileSync } from "node:fs";
import { getChangedFiles } from "./git.js";
import { runValidationCommands } from "./validation.js";
import { generateReviewReport } from "./review.js";

type ParsedArgs = {
  command: string;
  repo?: string;
  format?: string;
  baseRef?: string;
  validate: string[];
};

/**
 * Parses `process.argv` into flags.
 *
 * SEEDED DEFECT #1 (CLI argument defect): this splits the raw argv on
 * whitespace-adjacent flags without honoring quoting, so a path containing
 * spaces (e.g. `--repo "./my project"`) is silently truncated at the first
 * space instead of being treated as one argument. Node/the shell already
 * hands this function a correctly-split `argv` array — the bug is that the
 * code re-splits `argv[i]` values on spaces "just in case", which breaks
 * exactly the case it was trying to handle.
 */
function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { command: argv[0] ?? "", validate: [] };
  for (let i = 1; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--repo") {
      // BUG: re-splitting an already-correct argv value on whitespace.
      parsed.repo = argv[++i]?.split(" ")[0];
    } else if (token === "--format") {
      parsed.format = argv[++i];
    } else if (token === "--base-ref") {
      parsed.baseRef = argv[++i];
    } else if (token === "--validate") {
      parsed.validate.push(argv[++i]);
    }
  }
  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.command !== "review") {
    console.error(`Unknown command: ${args.command}. Try "review".`);
    process.exitCode = 1;
    return;
  }

  if (!args.repo) {
    console.error("Missing required --repo <path>");
    process.exitCode = 1;
    return;
  }

  const changedFiles = getChangedFiles(args.repo, args.baseRef);
  const validationResults = await runValidationCommands(args.validate, args.repo);
  const report = generateReviewReport({
    repositoryPath: args.repo,
    changedFiles,
    validationResults,
  });

  const outputPath = "review-report.md";
  writeFileSync(outputPath, report, "utf8");
  console.log(`Review report written to ${outputPath}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exitCode = 1;
});
