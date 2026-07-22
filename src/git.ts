// Git inspection helpers for the repository review tool.
import { execFileSync } from "node:child_process";

export type ChangedFile = {
  path: string;
  status: "added" | "modified" | "deleted" | "untracked";
};

function runGit(repoPath: string, args: string[]): string {
  return execFileSync("git", args, { cwd: repoPath, encoding: "utf8" }).trim();
}

const DEFAULT_BRANCH_CANDIDATES = ["main", "master"];

function refExists(repoPath: string, ref: string): boolean {
  try {
    runGit(repoPath, ["rev-parse", "--verify", "--quiet", ref]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves the base ref to diff against: an explicit `baseRef` if given,
 * otherwise the first of the common default branch names that exists in
 * the repo.
 */
function resolveBaseRef(repoPath: string, baseRef?: string): string {
  if (baseRef) return baseRef;

  for (const candidate of DEFAULT_BRANCH_CANDIDATES) {
    if (refExists(repoPath, candidate)) return candidate;
  }

  throw new Error(
    `Could not determine a default base branch (tried: ${DEFAULT_BRANCH_CANDIDATES.join(", ")}). ` +
      "Pass --base-ref <ref> to specify one explicitly.",
  );
}

/**
 * Returns the files changed relative to a base ref, including both tracked
 * diffs and untracked (but not ignored) files in the working tree.
 */
export function getChangedFiles(repoPath: string, baseRef?: string): ChangedFile[] {
  const base = resolveBaseRef(repoPath, baseRef);

  let diffOutput: string;
  try {
    diffOutput = runGit(repoPath, ["diff", "--name-status", `${base}...HEAD`]);
  } catch {
    throw new Error(
      `Base ref "${base}" not found in this repository. ` +
        "Pass --base-ref <ref> to specify a valid one.",
    );
  }

  const files: ChangedFile[] = [];

  for (const line of diffOutput.split("\n")) {
    if (!line.trim()) continue;
    const [statusChar, ...pathParts] = line.split("\t");
    const path = pathParts.join("\t");
    const status =
      statusChar === "A" ? "added" : statusChar === "D" ? "deleted" : "modified";
    files.push({ path, status });
  }

  const untrackedOutput = runGit(repoPath, ["ls-files", "--others", "--exclude-standard"]);
  for (const path of untrackedOutput.split("\n")) {
    if (!path.trim()) continue;
    files.push({ path, status: "untracked" });
  }

  return files;
}

export function getCurrentBranch(repoPath: string): string {
  return runGit(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
}

export function getHeadCommit(repoPath: string): string {
  return runGit(repoPath, ["rev-parse", "HEAD"]);
}
