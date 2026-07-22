// Regenerates the sample fixture repo used by the test suite and writes its
// base commit SHA to a gitignored file the tests read at run time.
//
// SEEDED DEFECT #7 (part of it): this fixture lives at a fixed path inside
// the project (`test/fixtures/sample-repo`) rather than an isolated temp
// directory created fresh per test run — see cli.test.ts for the rest of
// the gap (relies on `process.cwd()`, happy-path only).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoDir = join(here, "sample-repo");
const shaFile = join(here, ".sample-repo-base-sha");

function git(...args) {
  return execFileSync("git", args, { cwd: repoDir, encoding: "utf8" }).trim();
}

mkdirSync(repoDir, { recursive: true });

if (!existsSync(join(repoDir, ".git"))) {
  git("init", "-q", "-b", "main");
  git("config", "user.email", "fixture@example.com");
  git("config", "user.name", "Fixture");
}

writeFileSync(join(repoDir, "greeting.txt"), "hello\n");
git("add", "greeting.txt");
try {
  git("commit", "-qm", "fixture: initial");
} catch {
  // Nothing changed since last run — fine, keep the existing commit.
}
const baseSha = git("rev-parse", "HEAD");

writeFileSync(join(repoDir, "greeting.txt"), "hello world\n");
git("add", "greeting.txt");
try {
  git("commit", "-qm", "fixture: update greeting");
} catch {
  // Nothing changed since last run — fine.
}

writeFileSync(shaFile, baseSha + "\n");
console.log(`Fixture repo ready at ${repoDir}, base SHA ${baseSha}`);
