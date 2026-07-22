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
 * SEEDED DEFECT #6 (report quality): this just lists changed files and
 * dumps raw validation output. It does not distinguish errors, warnings,
 * successful checks, or missing/skipped checks — a reviewer (human or AI)
 * reading this report cannot tell "everything passed" from "everything
 * failed" without reading every line of raw output.
 */
export function generateReviewReport(input: ReviewInput): string {
  const lines: string[] = [];
  lines.push(`# Review Report: ${input.repositoryPath}`);
  lines.push("");
  lines.push("## Changed files");
  for (const file of input.changedFiles) {
    lines.push(`- ${file.path} (${file.status})`);
  }
  lines.push("");
  lines.push("## Validation output");
  for (const result of input.validationResults) {
    lines.push(`### ${result.command}`);
    lines.push("```");
    lines.push(result.output);
    lines.push("```");
  }
  return lines.join("\n");
}
