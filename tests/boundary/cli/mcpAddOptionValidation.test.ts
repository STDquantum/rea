import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "vitest";

import { createTestTempDirectory } from "../../fixtures/temporaryDirectory.js";
import { cliTest } from "../../support/cli/cliFixture.js";

cliTest("mcp add rejects valued options without a value", async ({ cli }) => {
  const root = await createTestTempDirectory("rea-mcp-add-value-");
  const home = join(root, "home");
  const environment = {
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: join(home, ".config"),
  };
  const run = (arguments_: readonly string[]) =>
    cli.run({
      arguments: [...arguments_, "--json"],
      cwd: root,
      environment,
      timeoutMs: 20_000,
    });

  for (const [flag, field] of [
    ["--agent", "agent"],
    ["--command", "command"],
    ["-c", "command"],
    ["-c=", "command"],
    ["--agent=", "agent"],
  ] as const) {
    const result = await run(["mcp", "add", flag]);
    expect(result.exitCode, result.stderr).toBe(1);
    expect(result.json).toMatchObject({
      code: "VALIDATION_ERROR",
      fieldErrors: expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_value",
          missing: false,
          path: field,
        }),
      ]),
    });
  }

  // Incur would swallow the following flag as the option value; REA rejects it.
  const swallowed = await run(["mcp", "add", "--command", "--agent", "amp"]);
  expect(swallowed.exitCode, swallowed.stderr).toBe(1);
  expect(swallowed.json).toMatchObject({
    code: "VALIDATION_ERROR",
    fieldErrors: expect.arrayContaining([
      expect.objectContaining({
        code: "invalid_value",
        missing: false,
        path: "command",
      }),
    ]),
  });

  // A registration with an explicit agent still writes the Amp registration.
  const registered = await run(["mcp", "add", "--agent", "amp"]);
  expect(registered.exitCode, registered.stderr).toBe(0);
  const settings = JSON.parse(
    await readFile(join(home, ".config", "amp", "settings.json"), "utf8"),
  );
  expect(settings["amp.mcpServers"].rea).toMatchObject({
    command: expect.any(String),
  });
});
