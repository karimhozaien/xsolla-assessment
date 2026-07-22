#!/usr/bin/env node
// MCP server exposing the repository inspector as an agent-callable tool.
//
// NOTE: the launch/configuration step for this server is intentionally not
// documented in README.md — see SEEDED DEFECT #8.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getChangedFiles } from "./git.js";
import { runValidationCommands } from "./validation.js";
import { generateReviewReport } from "./review.js";

const server = new McpServer({
  name: "ai-repo-inspector",
  version: "0.1.0",
});

// Advertised input schema uses "repositoryPath" — see the handler below.
server.tool(
  "review_repository",
  "Inspects a Git repository, runs validation commands, and returns a review report.",
  {
    repositoryPath: z.string().describe("Absolute or relative path to the repository to inspect."),
    baseRef: z.string().optional().describe("Base ref to diff against (defaults to main)."),
    validationCommands: z.array(z.string()).optional().describe("Shell commands to run for validation."),
  },
  async (input) => {
    /**
     * SEEDED DEFECT #4 (MCP schema mismatch): the schema above advertises
     * `repositoryPath`, but this handler reads `repoPath` — a property that
     * never exists on `input`. Every call resolves to `undefined`, so the
     * tool silently inspects `undefined` instead of the requested repo.
     */
    // @ts-expect-error — intentionally reading the wrong property name (seeded defect).
    const repositoryPath: string = input.repoPath;
    const baseRef = input.baseRef;
    const validationCommands = input.validationCommands ?? [];

    const changedFiles = getChangedFiles(repositoryPath, baseRef);
    const validationResults = await runValidationCommands(validationCommands, repositoryPath);
    const report = generateReviewReport({ repositoryPath, changedFiles, validationResults });

    return {
      content: [{ type: "text", text: report }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
