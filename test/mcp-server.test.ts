import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { reviewRepository } from "../src/mcp-server.js";

const baseSha = readFileSync("test/fixtures/.sample-repo-base-sha", "utf8").trim();

describe("reviewRepository (MCP tool handler)", () => {
  it("inspects the given repositoryPath instead of silently defaulting elsewhere", async () => {
    // Regression test for the schema/handler mismatch: the handler used to
    // read a nonexistent `repoPath` field, so `repositoryPath` was ignored
    // and the tool inspected `undefined` (i.e. the server's own cwd)
    // instead of the requested repo.
    const report = await reviewRepository({
      repositoryPath: "test/fixtures/sample-repo",
      baseRef: baseSha,
    });

    expect(report).toContain("Review Report: test/fixtures/sample-repo");
  });

  it("runs validation commands against the given repositoryPath", async () => {
    const report = await reviewRepository({
      repositoryPath: "test/fixtures/sample-repo",
      baseRef: baseSha,
      validationCommands: ["echo mcp-check"],
    });

    expect(report).toContain("mcp-check");
  });

  it("defaults validationCommands to an empty list when omitted", async () => {
    const report = await reviewRepository({
      repositoryPath: "test/fixtures/sample-repo",
      baseRef: baseSha,
    });

    expect(report).toContain("## Validation output");
  });
});
