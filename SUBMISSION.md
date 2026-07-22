# Submission

## What did you investigate first, and why?

I started by reading every file in `src/` and running the full build pipeline
(`npm install`, `npm run build`, `npm run typecheck`, `npm test`) to establish
a baseline. Everything passed, which was itself the first clue. It meant the 
tests were the problem.

Reading `test/cli.test.ts` and `test/review.test.ts` confirmed it: the suite
only exercised the "easy" path (repo path with no spaces, a base ref that
exists, no failing commands). So my first real task was mapping why each
defect existed and why the tests never caught it, rather than trusting the
passing run. I captured that in `TRIAGE.md`, ranked by severity, before
touching any code.

## What did you choose to implement or fix?

I worked strictly in severity order, one issue per commit ( appart from when they were connected), verifying each before moving on. Fixed:

- **Critical** — shell injection in validation commands (`exec` string →
  `execFile` with a tokenized argv); validation failures crashing the whole
  report (promise `reject` → structured `failed` result).
- **High** — MCP schema/handler property mismatch (100% failure rate, no
  workaround); base-branch detection (main → master fallback); untracked
  files now included; clear errors for a missing/invalid base ref; a timeout
  on validation commands so a hanging command can't stall forever.
- **Medium** — CLI truncating repo paths containing a space; a pass/fail
  summary at the top of the report (`✅ All N passed` / `❌ N of M failed`)
  so a reviewer can tell outcome at a glance; broad test coverage
  (per-module test files, negative-path CLI tests).

After the seeded defects, I attacked my own fixed code with hostile inputs
and found more issues (see Known limitations). One of those — a passing
command with >1MB of output being falsely marked failed due to `execFile`'s
default 1MB `maxBuffer` — I fixed (raised to 32MB, with a test).

Test count went from 2 to 44.

## What did you intentionally NOT do?

- **The three Low-severity items** (stdout/stderr fallback labeling, Markdown
  escaping of the repo path, MCP launch docs) — real but low-impact, and I
  prioritized correctness and safety over polish.
- **Several adversarial findings I chose to document rather than fix** — e.g.
  making the CLI exit non-zero on a failed check. That one is a genuine
  design decision (some users want the report generated regardless of check
  status), so I flagged it as needing a `--fail-on-error` flag rather than
  silently changing behavior under time pressure.

I'd rather ship a few well-verified fixes with honest documentation of what's
left than a large diff I can't stand behind.

## How did you use an AI coding agent?

I used Claude Code as a pair-programmer: reading the codebase, drafting
fixes, writing tests, and — most usefully — running adversarial
probes against my own fixes. I drove the prioritization and made the calls on
what to fix vs. document; the agent executed, verified, and surfaced options.

A workflow I leaned on: for each fix, after tests went green, I had it prove
the test was real by reintroducing the original bug and confirming the test
failed (red), then restoring the fix (green). A passing test count alone
doesn't prove a test guards anything.

## Where did you check, correct, or reject an AI suggestion? (at least one, required)

Two clear cases:

1. **Rejected a bundled change.** For the `git.ts` work, the agent proposed
   fixing all three related issues (base-branch fallback, untracked files,
   error handling) in one large edit. I stopped it and had it split into three
   separate, individually-tested commits — smaller changes are easier to
   verify and to review, and if one is wrong it doesn't taint the others.

2. **Caught a "too smooth" fix.** After the MCP schema fix passed on the first
   try, I was suspicious it was passing trivially. I had the agent reintroduce
   the exact original bug — and the test failed by trying to `git diff`
   against the *wrong repo* (the tool's own cwd), which is precisely the
   defect's real-world symptom. That red/green cycle is what convinced me the
   test actually guarded the behavior, not just the string output.

## Commands used to verify your result

```bash
npm install
npm run build
npm run typecheck
npm test            # 44 tests, 5 files

# Real-world manual verification (examples):
npm run inspector -- review --repo . --validate 'echo ok' --validate 'node -e "process.exit(1)"'
npm run inspector -- review --repo "/path/with a space"      # CLI space fix
# plus a real MCP stdio client calling review_repository end-to-end
```

Beyond the suite, I ran the actual CLI binary against throwaway git repos for
each fix (a `master`-default repo, a path containing a space, a hanging
command with the timeout temporarily lowered to 2s, an invalid base ref) and
confirmed the real output — not just unit behavior.

## A blocker you hit, and how you approached it

Testing the timeout fix "for real" was awkward: the default timeout is 5
minutes, so a genuine hang test would either take 5 minutes or be killed by an
outer wrapper first (masking whether my code did the killing). I temporarily
lowered the default to 2s, ran the real CLI against a truly hanging command,
confirmed it was killed at ~2.2s with a clean report, then restored the
5-minute default. Separately, when I removed the timeout to prove the test was
real, it left an orphaned `node` process running — I caught it with `pgrep`
and killed it, which was itself a useful reminder to verify cleanup, not just
exit codes.

## Known limitations and the next three things you'd do

Found by attacking my own fixed code (documented in `TRIAGE.md`):

1. **Uncommitted changes to *tracked* files are invisible.** `git diff
   base...HEAD` only sees commits, so a modified-but-uncommitted tracked file
   doesn't appear — even though new untracked files now do (inconsistent
   semantics). I'd add `git status --porcelain` to capture working-tree state.
2. **The CLI exits 0 even when a validation check fails.** Report says ❌, exit
   code says success — bad for CI. I'd add a `--fail-on-error` flag setting
   `process.exitCode = 1` on any failed check.
3. **The tokenizer mishandles mid-token quotes** (`--flag="a b"` splits into
   two args). I'd use a proper POSIX-style tokenizer or accept argv arrays.

Also outstanding: the three Low-severity items and wiring up (or removing) the
parsed-but-unused `--format` flag.

## Approximate focused-work start and finish times

- Start: 11:57PM EET
- Finish: 1:25AM EET
