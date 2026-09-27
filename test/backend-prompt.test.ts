// ABOUTME: Tests the neutralizeBackendPrompt settings flag loader and the override constant.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { KIRO_PERSONA_OVERRIDE, loadNeutralizeBackendPrompt } from "../src/backend-prompt.js";

describe("backend-prompt neutralization flag", () => {
  let agentDir: string;

  beforeEach(() => {
    agentDir = mkdtempSync(join(tmpdir(), "kiro-backend-prompt-"));
  });

  afterEach(() => {
    rmSync(agentDir, { recursive: true, force: true });
  });

  const writeSettings = (contents: string) => writeFileSync(join(agentDir, "settings.json"), contents);

  it("defaults to disabled when the settings file is absent", () => {
    expect(loadNeutralizeBackendPrompt(agentDir)).toBe(false);
  });

  it("defaults to disabled when the section is absent", () => {
    writeSettings(JSON.stringify({ "some-other-provider": { foo: true } }));
    expect(loadNeutralizeBackendPrompt(agentDir)).toBe(false);
  });

  it("enables only when the flag is exactly true", () => {
    writeSettings(JSON.stringify({ "pi-provider-kiro": { neutralizeBackendPrompt: true } }));
    expect(loadNeutralizeBackendPrompt(agentDir)).toBe(true);
  });

  it.each([false, "true", 1, null])("treats non-true value %p as disabled", (value) => {
    writeSettings(JSON.stringify({ "pi-provider-kiro": { neutralizeBackendPrompt: value } }));
    expect(loadNeutralizeBackendPrompt(agentDir)).toBe(false);
  });

  it("fails closed on malformed JSON", () => {
    writeSettings("{ not valid json");
    expect(loadNeutralizeBackendPrompt(agentDir)).toBe(false);
  });

  it("override preamble denies the Kiro persona", () => {
    expect(KIRO_PERSONA_OVERRIDE).toContain('You are not "Kiro"');
  });
});
