import { describe, expect, it } from "vitest";
import { generateReviewReport } from "../src/review.js";

describe("generateReviewReport", () => {
  it("lists changed files and validation output", () => {
    const report = generateReviewReport({
      repositoryPath: "some/repo",
      changedFiles: [{ path: "src/index.ts", status: "modified" }],
      validationResults: [{ command: "npm test", status: "passed", output: "3 passed" }],
    });

    expect(report).toContain("src/index.ts");
    expect(report).toContain("npm test");
    expect(report).toContain("3 passed");
  });

  it("summarizes all checks passing distinctly from a mixed pass/fail result", () => {
    const allPassed = generateReviewReport({
      repositoryPath: "some/repo",
      changedFiles: [],
      validationResults: [
        { command: "npm test", status: "passed", output: "ok" },
        { command: "npm run lint", status: "passed", output: "ok" },
      ],
    });
    expect(allPassed).toContain("✅ All 2 check(s) passed.");
    expect(allPassed).not.toContain("❌");

    const mixed = generateReviewReport({
      repositoryPath: "some/repo",
      changedFiles: [],
      validationResults: [
        { command: "npm test", status: "passed", output: "ok" },
        { command: "npm run lint", status: "failed", output: "lint error" },
      ],
    });
    expect(mixed).toContain("❌ 1 of 2 check(s) failed.");
  });

  it("marks each individual check with a pass/fail icon", () => {
    const report = generateReviewReport({
      repositoryPath: "some/repo",
      changedFiles: [],
      validationResults: [
        { command: "npm test", status: "passed", output: "ok" },
        { command: "npm run lint", status: "failed", output: "lint error" },
      ],
    });

    expect(report).toContain("✅ `npm test`");
    expect(report).toContain("❌ `npm run lint`");
    expect(report).toContain("### ✅ npm test");
    expect(report).toContain("### ❌ npm run lint");
  });

  it("states clearly when no validation commands were run, instead of an empty section", () => {
    const report = generateReviewReport({
      repositoryPath: "some/repo",
      changedFiles: [{ path: "a.txt", status: "modified" }],
      validationResults: [],
    });

    expect(report).toContain("No validation commands were run.");
  });

  it("states clearly when no changed files were detected", () => {
    const report = generateReviewReport({
      repositoryPath: "some/repo",
      changedFiles: [],
      validationResults: [],
    });

    expect(report).toContain("No changed files detected.");
  });
});
