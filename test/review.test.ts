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
});
