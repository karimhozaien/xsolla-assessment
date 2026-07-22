import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getChangedFiles } from "../src/git.js";

let repoDir: string;

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: repoDir, encoding: "utf8" }).trim();
}

function initRepo(defaultBranch: string) {
  git("init", "-q", "-b", defaultBranch);
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test");
}

beforeEach(() => {
  repoDir = mkdtempSync(join(tmpdir(), "git-test-"));
});

afterEach(() => {
  rmSync(repoDir, { recursive: true, force: true });
});

describe("getChangedFiles — base branch resolution", () => {
  it("uses an explicit baseRef when provided, regardless of the repo's default branch", () => {
    initRepo("trunk");
    writeFileSync(join(repoDir, "a.txt"), "one\n");
    git("add", "a.txt");
    git("commit", "-qm", "initial");
    const baseSha = git("rev-parse", "HEAD");

    writeFileSync(join(repoDir, "a.txt"), "two\n");
    git("add", "a.txt");
    git("commit", "-qm", "update");

    const files = getChangedFiles(repoDir, baseSha);
    expect(files).toEqual([{ path: "a.txt", status: "modified" }]);
  });

  it("falls back to 'master' when the repo's default branch is 'master' instead of 'main'", () => {
    initRepo("master");
    writeFileSync(join(repoDir, "a.txt"), "one\n");
    git("add", "a.txt");
    git("commit", "-qm", "initial");

    git("checkout", "-qb", "feature");
    writeFileSync(join(repoDir, "b.txt"), "new file\n");
    git("add", "b.txt");
    git("commit", "-qm", "add b");

    // No baseRef passed — should resolve to "master", not silently fail/empty.
    const files = getChangedFiles(repoDir);
    expect(files).toEqual([{ path: "b.txt", status: "added" }]);
  });

  it("throws a clear error when no baseRef is given and neither main nor master exists", () => {
    initRepo("trunk");
    writeFileSync(join(repoDir, "a.txt"), "one\n");
    git("add", "a.txt");
    git("commit", "-qm", "initial");

    expect(() => getChangedFiles(repoDir)).toThrow(/main.*master|--base-ref/i);
  });

  it("throws a clear, actionable error for an explicit baseRef that doesn't exist", () => {
    initRepo("main");
    writeFileSync(join(repoDir, "a.txt"), "one\n");
    git("add", "a.txt");
    git("commit", "-qm", "initial");

    expect(() => getChangedFiles(repoDir, "no-such-ref")).toThrow(
      /no-such-ref.*not found.*--base-ref/is,
    );
  });
});

describe("getChangedFiles — untracked files", () => {
  it("includes untracked files with status 'untracked'", () => {
    initRepo("main");
    writeFileSync(join(repoDir, "a.txt"), "one\n");
    git("add", "a.txt");
    git("commit", "-qm", "initial");
    const baseSha = git("rev-parse", "HEAD");

    // A brand new file that was never `git add`-ed.
    writeFileSync(join(repoDir, "new-file.txt"), "not yet tracked\n");

    const files = getChangedFiles(repoDir, baseSha);
    expect(files).toEqual([{ path: "new-file.txt", status: "untracked" }]);
  });

  it("reports both tracked diffs and untracked files together", () => {
    initRepo("main");
    writeFileSync(join(repoDir, "a.txt"), "one\n");
    git("add", "a.txt");
    git("commit", "-qm", "initial");
    const baseSha = git("rev-parse", "HEAD");

    writeFileSync(join(repoDir, "a.txt"), "two\n");
    git("add", "a.txt");
    git("commit", "-qm", "update a");
    writeFileSync(join(repoDir, "new-file.txt"), "not yet tracked\n");

    const files = getChangedFiles(repoDir, baseSha);
    expect(files).toContainEqual({ path: "a.txt", status: "modified" });
    expect(files).toContainEqual({ path: "new-file.txt", status: "untracked" });
    expect(files).toHaveLength(2);
  });

  it("does not include gitignored files as untracked", () => {
    initRepo("main");
    writeFileSync(join(repoDir, ".gitignore"), "ignored.txt\n");
    writeFileSync(join(repoDir, "a.txt"), "one\n");
    git("add", "a.txt", ".gitignore");
    git("commit", "-qm", "initial");
    const baseSha = git("rev-parse", "HEAD");

    writeFileSync(join(repoDir, "ignored.txt"), "should not appear\n");

    const files = getChangedFiles(repoDir, baseSha);
    expect(files).toEqual([]);
  });
});
