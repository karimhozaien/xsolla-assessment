# ai-repo-inspector

A small CLI tool that scans a Git repository, runs validation commands, and
produces a Markdown code-review report.

## About this assessment

You received this repository as part of the AI-First Engineering Intern
hiring process at Xsolla. It is a working project, but **it has problems** —
some things are broken, some are unsafe, some are just weak. Part of the
assessment is figuring out what's wrong and deciding what matters most.

**Your task:** investigate the repository, then repair and/or extend it as
you judge best. Completion is **not** required or expected — we evaluate
your investigation, prioritization, and verification, not how much you
finish.

**Rules:**

- **48 hours** from the moment you received the invite email, with a
  **90-minute focused-work timebox** (honor system — record your start and
  finish times in `SUBMISSION.md`).
- Work in **your own copy** of this repo (created via "Use this template").
  Keep it public. Commit as you go — your commit history is part of what we
  read.
- **Use AI tools freely** (Claude Code, Codex, whatever you like). That's
  expected, not discouraged. We *will* ask how you used them.
- Fill in **`SUBMISSION.md`** and include it in your final commit. A
  thoughtful SUBMISSION.md with modest code changes beats a big diff with an
  empty one.
- When done, reply to the invite email with **your repository's URL**.
  Commits pushed after your 48-hour deadline are ignored.

## Setup

```bash
npm install
npm run build
```

## Usage

```bash
npm run inspector -- review --repo ./path/to/repo --format markdown
```

This writes `review-report.md` in the current directory, listing changed
files (relative to `main`) and the output of any validation commands you
pass with `--validate "<command>"` (repeatable).

```bash
npm run inspector -- review --repo ./path/to/repo --validate "npm test" --validate "npm run lint"
```

## Development

```bash
npm run typecheck
npm test
```

## Project layout

```
src/
  cli.ts          entry point + argument parsing
  git.ts          changed-file discovery
  validation.ts   runs validation commands
  review.ts       builds the Markdown report
  mcp-server.ts   exposes the inspector as an MCP tool
test/
  fixtures/       sample repo used by the test suite
```
