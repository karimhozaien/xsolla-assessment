import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, unlinkSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const baseSha = readFileSync("test/fixtures/.sample-repo-base-sha", "utf8").trim();

describe("inspector CLI", () => {
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

  it("exits non-zero with a clear message when --repo is missing", () => {
    if (existsSync("review-report.md")) unlinkSync("review-report.md");

    expect(() =>
      execFileSync("npx", ["tsx", "src/cli.ts", "review"], {
        cwd: process.cwd(),
        encoding: "utf8",
      }),
    ).toThrow(/Missing required --repo/);

    expect(existsSync("review-report.md")).toBe(false);
  });

  it("exits non-zero with a clear message for an unknown command", () => {
    if (existsSync("review-report.md")) unlinkSync("review-report.md");

    expect(() =>
      execFileSync("npx", ["tsx", "src/cli.ts", "bogus-command"], {
        cwd: process.cwd(),
        encoding: "utf8",
      }),
    ).toThrow(/Unknown command: bogus-command/);

    expect(existsSync("review-report.md")).toBe(false);
  });

  it("runs every repeated --validate flag, not just the first", () => {
    if (existsSync("review-report.md")) unlinkSync("review-report.md");

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
        "echo first-check",
        "--validate",
        "echo second-check",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    const report = readFileSync("review-report.md", "utf8");
    expect(report).toContain("first-check");
    expect(report).toContain("second-check");
    expect(report).toContain("✅ All 2 check(s) passed.");
  });
});
