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
 * Node/the shell already hand this function a correctly-split `argv`
 * array, so each flag's value is taken as-is — no re-splitting on
 * whitespace, which would truncate paths containing spaces.
 */
function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { command: argv[0] ?? "", validate: [] };
  for (let i = 1; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--repo") {
      parsed.repo = argv[++i];
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
