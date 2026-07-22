import { execFileSync } from "node:child_process";
import { existsSync, unlinkSync, readFileSync } from "node:fs";
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
        "exit 1",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    );

    const report = readFileSync("review-report.md", "utf8");
    expect(report).toContain("exit 1");
  });
});
