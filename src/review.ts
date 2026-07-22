// Builds the Markdown review report from changed files + validation results.
import type { ChangedFile } from "./git.js";
import type { ValidationResult } from "./validation.js";

export type ReviewInput = {
  repositoryPath: string;
  changedFiles: ChangedFile[];
  validationResults: ValidationResult[];
};

/**
 * Produces the Markdown review report.
 *
 * Leads with a pass/fail summary so a reviewer (human or AI) can tell
 * "everything passed" from "everything failed" at a glance, without
 * reading through every line of raw validation output.
 */
export function generateReviewReport(input: ReviewInput): string {
  const { repositoryPath, changedFiles, validationResults } = input;
  const lines: string[] = [];

  lines.push(`# Review Report: ${repositoryPath}`);
  lines.push("");

  lines.push("## Changed files");
  if (changedFiles.length === 0) {
    lines.push("_No changed files detected._");
  } else {
    for (const file of changedFiles) {
      lines.push(`- ${file.path} (${file.status})`);
    }
  }
  lines.push("");

  lines.push("## Validation summary");
  if (validationResults.length === 0) {
    lines.push("_No validation commands were run._");
  } else {
    const failedCount = validationResults.filter((result) => result.status === "failed").length;
    lines.push(
      failedCount === 0
        ? `✅ All ${validationResults.length} check(s) passed.`
        : `❌ ${failedCount} of ${validationResults.length} check(s) failed.`,
    );
    lines.push("");
    for (const result of validationResults) {
      const icon = result.status === "passed" ? "✅" : "❌";
      lines.push(`- ${icon} \`${result.command}\``);
    }
  }
  lines.push("");

  lines.push("## Validation output");
  if (validationResults.length === 0) {
    lines.push("_No validation commands were run._");
  } else {
    for (const result of validationResults) {
      const icon = result.status === "passed" ? "✅" : "❌";
      lines.push(`### ${icon} ${result.command}`);
      lines.push("```");
      lines.push(result.output);
      lines.push("```");
    }
  }

  return lines.join("\n");
}
