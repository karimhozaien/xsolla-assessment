// Runs candidate/repo-configured validation commands (lint, tests, build, ...).
import { execFile } from "node:child_process";

export type ValidationResult = {
  command: string;
  status: "passed" | "failed";
  output: string;
};

/**
 * Splits a command string into a program and its arguments, respecting
 * single- and double-quoted segments (e.g. `echo "hello world"` ->
 * ["echo", "hello world"]). Shell operators like `;`, `&&`, `|`, and `$()`
 * are not given any special meaning — they end up as literal argument text.
 */
function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(command)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}

/**
 * Runs a single validation command and returns its result.
 *
 * Uses `execFile` with an argv array instead of a shell string, so shell
 * metacharacters in a command are never interpreted by a shell — they pass
 * through as literal argument text instead of chaining additional commands.
 */
export function runValidationCommand(command: string, cwd: string): Promise<ValidationResult> {
  return new Promise((resolve) => {
    const [program, ...args] = tokenizeCommand(command);
    if (!program) {
      resolve({ command, status: "failed", output: "Empty validation command" });
      return;
    }

    execFile(program, args, { cwd }, (error, stdout, stderr) => {
      if (error) {
        resolve({ command, status: "failed", output: stdout || stderr || error.message });
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
