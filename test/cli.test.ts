import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, unlinkSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// SEEDED DEFECT #7 (testing gap): this only exercises the happy path (repo
// path with no spaces, base ref that exists, no failing validation
// commands) and relies on the developer's current working directory
// (`test/fixtures/sample-repo`, resolved relative to wherever `vitest` is
// invoked from, and regenerated in place rather than copied into a fresh
// isolated temp dir per run) instead of true test isolation. Run this suite
// from a different working directory and it breaks — it proves nothing
// about the CLI argument-parsing, base-ref, or error-handling bugs.
const baseSha = readFileSync("test/fixtures/.sample-repo-base-sha", "utf8").trim();

describe("inspector CLI (happy path only)", () => {
  it("writes a review report for the sample fixture repo", () => {
    if (existsSync("review-report.md")) unlinkSync("review-report.md");

    execFileSync(
      "npx",
      ["tsx", "src/cli.ts", "review", "--repo", "test/fixtures/sample-repo", "--base-ref", baseSha],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(existsSync("review-report.md")).toBe(true);
  });

  it("records a failing --validate command as a failed check instead of crashing the CLI", () => {
    if (existsSync("review-report.md")) unlinkSync("review-report.md");

    // Regression test for the promise-rejection crash: if this were still
    // broken, execFileSync would throw here because the CLI process itself
    // would exit non-zero / never finish writing the report.
    const failingCommand = `node -e "process.exit(1)"`;
    execFileSync(
      "npx",
      [
        "tsx",
        "src/cli.ts",
        "review",
        "--repo",
        "test/fixtures/sample-repo",
        "--base-ref",
        baseSha,
        "--validate",
        failingCommand,
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    const report = readFileSync("review-report.md", "utf8");
    expect(report).toContain(failingCommand);
  });

  it("does not execute a second command chained via shell metacharacters", () => {
    if (existsSync("review-report.md")) unlinkSync("review-report.md");

    // Regression test for the shell-injection fix: a validate command with
    // a chained shell operator must never run the second command.
    const markerPath = join(process.cwd(), "injected-by-cli-test.txt");
    if (existsSync(markerPath)) unlinkSync(markerPath);

    execFileSync(
      "npx",
      [
        "tsx",
        "src/cli.ts",
        "review",
        "--repo",
        "test/fixtures/sample-repo",
        "--base-ref",
        baseSha,
        "--validate",
        `echo safe && touch ${markerPath}`,
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    expect(existsSync(markerPath)).toBe(false);
  });

  it("handles a --repo path containing a space", () => {
    if (existsSync("review-report.md")) unlinkSync("review-report.md");

    // Regression test for the CLI argument-parsing bug: a repo path with a
    // space (e.g. "~/Desktop/My Project") used to be silently truncated at
    // the first space instead of treated as one argument.
    const repoDir = mkdtempSync(join(tmpdir(), "cli space test "));
    try {
      execFileSync("git", ["init", "-q", "-b", "main"], { cwd: repoDir });
      execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repoDir });
      execFileSync("git", ["config", "user.name", "Test"], { cwd: repoDir });
      writeFileSync(join(repoDir, "a.txt"), "one\n");
      execFileSync("git", ["add", "a.txt"], { cwd: repoDir });
      execFileSync("git", ["commit", "-qm", "initial"], { cwd: repoDir });
      const baseShaForSpaceRepo = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: repoDir,
        encoding: "utf8",
      }).trim();

      writeFileSync(join(repoDir, "new-file.txt"), "not yet tracked\n");

      execFileSync(
        "npx",
        ["tsx", "src/cli.ts", "review", "--repo", repoDir, "--base-ref", baseShaForSpaceRepo],
        { cwd: process.cwd(), encoding: "utf8" },
      );

      const report = readFileSync("review-report.md", "utf8");
      expect(report).toContain(`Review Report: ${repoDir}`);
      expect(report).toContain("new-file.txt (untracked)");
    } finally {
      rmSync(repoDir, { recursive: true, force: true });
    }
  });
});
