#!/usr/bin/env node
// MCP server exposing the repository inspector as an agent-callable tool.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getChangedFiles } from "./git.js";
import { runValidationCommands } from "./validation.js";
import { generateReviewReport } from "./review.js";

export type ReviewRepositoryInput = {
  repositoryPath: string;
  baseRef?: string;
  validationCommands?: string[];
};

export async function reviewRepository(input: ReviewRepositoryInput): Promise<string> {
  const { repositoryPath, baseRef, validationCommands = [] } = input;
  const changedFiles = getChangedFiles(repositoryPath, baseRef);
  const validationResults = await runValidationCommands(validationCommands, repositoryPath);
  return generateReviewReport({ repositoryPath, changedFiles, validationResults });
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "ai-repo-inspector",
    version: "0.1.0",
  });

  server.tool(
    "review_repository",
    "Inspects a Git repository, runs validation commands, and returns a review report.",
    {
      repositoryPath: z.string().describe("Absolute or relative path to the repository to inspect."),
      baseRef: z.string().optional().describe("Base ref to diff against (defaults to main)."),
      validationCommands: z.array(z.string()).optional().describe("Shell commands to run for validation."),
    },
    async (input) => ({
      content: [{ type: "text", text: await reviewRepository(input) }],
    }),
  );

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
