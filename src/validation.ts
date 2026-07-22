// Runs candidate/repo-configured validation commands (lint, tests, build, ...).
import { exec } from "node:child_process";

export type ValidationResult = {
  command: string;
  status: "passed" | "failed";
  output: string;
};

/**
 * Runs a single validation command and returns its result.
 *
 * SEEDED DEFECT #3 (unsafe command execution): this uses `exec()` with a
 * plain string, which runs through a shell. A command containing shell
 * metacharacters (`;`, `&&`, `|`, backticks, `$()`) can execute arbitrary
 * additional commands. This should use `execFile`/`spawn` with an argv
 * array so arguments are never shell-interpreted.
 *
 * SEEDED DEFECT #5 (error handling): a validation command that fails (or
 * whose shell rejects it, e.g. "command not found") rejects the returned
 * promise instead of resolving with a structured `failed` result — an
 * uncaught rejection here crashes the whole report generation instead of
 * recording one failed check.
 */
export function runValidationCommand(command: string, cwd: string): Promise<ValidationResult> {
  return new Promise((resolve, reject) => {
    exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        // BUG: rejects instead of resolving with a "failed" ValidationResult.
        reject(error);
        return;
      }
      resolve({ command, status: "passed", output: stdout || stderr });
    });
  });
}

export async function runValidationCommands(
  commands: string[],
  cwd: string,
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  for (const command of commands) {
    results.push(await runValidationCommand(command, cwd));
  }
  return results;
}
