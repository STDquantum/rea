import { access } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "vitest";

import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";
import { cliTest } from "../../support/cli/cliFixture.js";

const invalidValue = (value: string) => `--dry-run=${value}`;

cliTest(
  "setup rejects unrecognized --dry-run values before writing",
  async ({ cli }) => {
    const root = await createTestTempDirectory("rea-setup-dry-run-");
    const home = join(root, "home");
    const config = join(home, ".claude.json");
    const environment = {
      HOME: home,
      USERPROFILE: home,
      CLAUDE_CONFIG_DIR: "",
    };
    const run = (arguments_: readonly string[]) =>
      cli.run({
        arguments: [...arguments_, "--json"],
        cwd: root,
        environment,
        timeoutMs: 20_000,
      });

    for (const value of ["abc", ""]) {
      const result = await run([
        "setup",
        "--yes",
        "--client",
        "claude_code",
        invalidValue(value),
      ]);
      expect(result.exitCode, result.stderr).toBe(1);
      expect(result.json).toMatchObject({
        code: "VALIDATION_ERROR",
        fieldErrors: expect.arrayContaining([
          expect.objectContaining({
            code: "invalid_value",
            missing: false,
            path: "dryRun",
          }),
        ]),
      });
      await expect(access(config)).rejects.toMatchObject({ code: "ENOENT" });
    }

    // A bare --dry-run and an explicit true remain plan-only.
    for (const dryRun of ["--dry-run", "--dry-run=true"]) {
      const planned = await run(["setup", "--client", "claude_code", dryRun]);
      expect(planned.exitCode, planned.stderr).toBe(0);
      expect(planned.json).toMatchObject({ status: "planned" });
      await expect(access(config)).rejects.toMatchObject({ code: "ENOENT" });
    }

    // An explicit false remains a valid value: setup applies the configuration.
    const applied = await run([
      "setup",
      "--yes",
      "--client",
      "claude_code",
      "--dry-run=false",
    ]);
    expect(applied.exitCode, applied.stderr).toBe(0);
    expect(applied.json).toMatchObject({ status: "ready" });
  },
);
