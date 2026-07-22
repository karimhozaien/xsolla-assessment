import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runValidationCommand, runValidationCommands } from "../src/validation.js";

const FAIL_CMD = `node -e "process.exit(1)"`;

describe("runValidationCommand", () => {
  it("resolves with status 'passed' when the command succeeds", async () => {
    const result = await runValidationCommand("echo hello", process.cwd());
    expect(result.status).toBe("passed");
    expect(result.output).toContain("hello");
  });

  it("resolves with status 'failed' instead of rejecting when the command exits non-zero", async () => {
    // This is the core regression test for the promise-rejection crash: a
    // failing command must resolve as data, not reject/throw.
    await expect(runValidationCommand(FAIL_CMD, process.cwd())).resolves.toMatchObject({
      status: "failed",
    });
  });

  it("resolves with status 'failed' for a nonexistent command", async () => {
    const result = await runValidationCommand("definitely-not-a-real-command-xyz123", process.cwd());
    expect(result.status).toBe("failed");
    expect(result.output.length).toBeGreaterThan(0);
  });

  it("captures stderr output when a failing command writes only to stderr", async () => {
    const result = await runValidationCommand(
      `node -e "console.error('boom'); process.exit(1)"`,
      process.cwd(),
    );
    expect(result.status).toBe("failed");
    expect(result.output).toContain("boom");
  });

  it("captures stdout for a passing command that writes only to stdout", async () => {
    const result = await runValidationCommand(`node -e "console.log('all good')"`, process.cwd());
    expect(result.status).toBe("passed");
    expect(result.output).toContain("all good");
  });

  it("runs the command in the specified working directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "validation-cwd-"));
    try {
      writeFileSync(join(dir, "marker.txt"), "found-me");
      const result = await runValidationCommand("cat marker.txt", dir);
      expect(result.status).toBe("passed");
      expect(result.output).toContain("found-me");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves the original command string on the result", async () => {
    const result = await runValidationCommand("echo test", process.cwd());
    expect(result.command).toBe("echo test");
  });

  it("resolves with status 'failed' for a command killed by exit code > 1", async () => {
    const result = await runValidationCommand(`node -e "process.exit(2)"`, process.cwd());
    expect(result.status).toBe("failed");
  });

  it("resolves with status 'failed' for an empty command string", async () => {
    const result = await runValidationCommand("", process.cwd());
    expect(result.status).toBe("failed");
  });

  it("keeps a quoted argument containing spaces intact", async () => {
    const result = await runValidationCommand(`echo "hello world"`, process.cwd());
    expect(result.status).toBe("passed");
    expect(result.output.trim()).toBe("hello world");
  });

  // Shell-injection regression tests (SEEDED DEFECT #3): a command string
  // must never be handed to a shell, so operators like `;`, `&&`, and `$()`
  // must end up as literal argument text instead of chaining or expanding.

  it("does not execute a second command chained with ';'", async () => {
    const dir = mkdtempSync(join(tmpdir(), "validation-injection-"));
    try {
      const marker = join(dir, "injected.txt");
      const result = await runValidationCommand(`echo safe; touch ${marker}`, dir);
      expect(existsSync(marker)).toBe(false);
      expect(result.output).toContain(";");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not execute a second command chained with '&&'", async () => {
    const dir = mkdtempSync(join(tmpdir(), "validation-injection-"));
    try {
      const marker = join(dir, "injected.txt");
      const result = await runValidationCommand(`echo safe && touch ${marker}`, dir);
      expect(existsSync(marker)).toBe(false);
      expect(result.output).toContain("&&");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not expand command substitution like '$(...)'", async () => {
    const result = await runValidationCommand(`echo $(whoami)`, process.cwd());
    expect(result.status).toBe("passed");
    // Treated as literal text, not substituted with the shell user's name.
    expect(result.output.trim()).toBe("$(whoami)");
  });

  it("does not interpret a pipe as a shell pipeline", async () => {
    const result = await runValidationCommand(`echo safe | cat`, process.cwd());
    expect(result.status).toBe("passed");
    // "|" and "cat" are passed to echo as literal arguments, not piped.
    expect(result.output.trim()).toBe("safe | cat");
  });
});

describe("runValidationCommands", () => {
  it("returns results in order matching the input commands", async () => {
    const results = await runValidationCommands(["echo one", "echo two"], process.cwd());
    expect(results).toHaveLength(2);
    expect(results[0].output).toContain("one");
    expect(results[1].output).toContain("two");
  });

  it("continues running remaining commands after an earlier one fails", async () => {
    // Real-world case: a lint step fails but the test step should still run
    // and be reported, not get skipped because of the earlier failure.
    const results = await runValidationCommands([FAIL_CMD, "echo still-runs"], process.cwd());
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("failed");
    expect(results[1].status).toBe("passed");
    expect(results[1].output).toContain("still-runs");
  });

  it("returns an empty array when given no commands", async () => {
    const results = await runValidationCommands([], process.cwd());
    expect(results).toEqual([]);
  });

  it("does not reject/throw even when every command fails", async () => {
    await expect(runValidationCommands([FAIL_CMD, FAIL_CMD], process.cwd())).resolves.toHaveLength(2);
  });
});
