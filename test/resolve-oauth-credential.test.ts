import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const credentialMocks = vi.hoisted(() => ({
  cli: vi.fn(),
  social: vi.fn(),
  ide: vi.fn(),
}));

vi.mock("../src/kiro-cli.js", async () => {
  const actual = await vi.importActual<typeof import("../src/kiro-cli.js")>("../src/kiro-cli.js");
  return { ...actual, getKiroCliCredentials: credentialMocks.cli, getKiroCliSocialToken: credentialMocks.social };
});

vi.mock("../src/kiro-ide.js", async () => {
  const actual = await vi.importActual<typeof import("../src/kiro-ide.js")>("../src/kiro-ide.js");
  return { ...actual, getKiroIdeCredentials: credentialMocks.ide };
});

import { resolveOAuthCredential } from "../src/index.js";

describe("resolveOAuthCredential", () => {
  let agentDir: string;
  const savedAgentDir = process.env.PI_CODING_AGENT_DIR;

  beforeEach(() => {
    agentDir = mkdtempSync(join(tmpdir(), "kiro-resolve-"));
    process.env.PI_CODING_AGENT_DIR = agentDir;
    delete process.env.KIRO_API_KEY;
    credentialMocks.cli.mockReset().mockReturnValue(undefined);
    credentialMocks.social.mockReset().mockReturnValue(undefined);
    credentialMocks.ide.mockReset().mockReturnValue(undefined);
  });

  afterEach(() => {
    rmSync(agentDir, { recursive: true, force: true });
    if (savedAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = savedAgentDir;
  });

  function writeAuth(auth: unknown): void {
    writeFileSync(join(agentDir, "auth.json"), JSON.stringify(auth));
  }

  it("maps a persisted api-key entry to a usage credential in the key-issuing region", () => {
    writeAuth({ kiro: { type: "api_key", key: "ksk_abc" } });
    expect(resolveOAuthCredential()).toEqual({ access: "ksk_abc", refresh: "", expires: 0, region: "us-east-1" });
  });

  it("maps the KIRO_API_KEY env credential to a usage credential", () => {
    process.env.KIRO_API_KEY = "ksk_env";
    expect(resolveOAuthCredential()).toMatchObject({ access: "ksk_env", region: "us-east-1" });
  });

  it("prefers a host oauth credential over anything else", () => {
    writeAuth({
      kiro: { access: "tok", refresh: "r", expires: Date.now() + 60 * 60 * 1000, region: "eu-central-1" },
    });
    process.env.KIRO_API_KEY = "ksk_env";
    expect(resolveOAuthCredential()).toMatchObject({ access: "tok", region: "eu-central-1" });
  });

  it("returns a kiro-cli oauth credential when no api key is present", () => {
    credentialMocks.social.mockReturnValue({ access: "cli-tok", region: "us-east-1", authMethod: "desktop" });
    expect(resolveOAuthCredential()).toMatchObject({ access: "cli-tok" });
  });

  it("returns undefined when nothing resolves", () => {
    expect(resolveOAuthCredential()).toBeUndefined();
  });
});
