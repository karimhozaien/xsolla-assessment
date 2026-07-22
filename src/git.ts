// Git inspection helpers for the repository review tool.
import { execFileSync } from "node:child_process";

export type ChangedFile = {
  path: string;
  status: "added" | "modified" | "deleted" | "untracked";
};

function runGit(repoPath: string, args: string[]): string {
  return execFileSync("git", args, { cwd: repoPath, encoding: "utf8" }).trim();
}

/**
 * Returns the files changed relative to a base ref.
 *
 * SEEDED DEFECT #2 (Git correctness): this hardcodes "main" as the base ref
 * and only inspects tracked diffs — it does not fall back to another
 * default branch name, and it never looks at untracked files. A repository
 * whose default branch is "master" (or one with untracked-but-relevant
 * files) will silently produce an incomplete or empty changed-file list.
 */
export function getChangedFiles(repoPath: string, baseRef?: string): ChangedFile[] {
  const base = baseRef ?? "main";
  const diffOutput = runGit(repoPath, ["diff", "--name-status", `${base}...HEAD`]);
  const files: ChangedFile[] = [];

  for (const line of diffOutput.split("\n")) {
    if (!line.trim()) continue;
    const [statusChar, ...pathParts] = line.split("\t");
    const path = pathParts.join("\t");
    const status =
      statusChar === "A" ? "added" : statusChar === "D" ? "deleted" : "modified";
    files.push({ path, status });
  }

  return files;
}

export function getCurrentBranch(repoPath: string): string {
  return runGit(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
}

export function getHeadCommit(repoPath: string): string {
  return runGit(repoPath, ["rev-parse", "HEAD"]);
}
