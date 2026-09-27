// ABOUTME: Reads the Kiro credential pi itself persists in ~/.pi/agent/auth.json.
// ABOUTME: This is the credential pi hands the provider at runtime, so the footer
// ABOUTME: can resolve usage even when no kiro-cli/IDE credential exists locally.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { KiroCredentials } from "./oauth.js";
import { getPiAgentDir } from "./usage-tracking.js";

/** Refresh a little early so a near-expiry token doesn't slip through. */
const EXPIRY_BUFFER_MS = 2 * 60 * 1000;

/**
 * Read pi's own persisted Kiro credential. Returns undefined when the file is
 * missing, unparseable, lacks a usable kiro entry, or the access token has
 * expired. Never logs file contents because auth.json holds many providers'
 * secrets.
 */
export function getPiHostKiroCredentials(agentDir = getPiAgentDir()): KiroCredentials | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(agentDir, "auth.json"), "utf-8"));
  } catch {
    return undefined;
  }

  const kiro = asRecord(asRecord(raw)?.kiro);
  if (!kiro || typeof kiro.access !== "string" || !kiro.access) return undefined;

  if (typeof kiro.expires === "number" && Number.isFinite(kiro.expires)) {
    if (Date.now() >= kiro.expires - EXPIRY_BUFFER_MS) return undefined;
  }

  return kiro as unknown as KiroCredentials;
}

/**
 * Read pi's own persisted Kiro API key. pi stores a `ksk_` key as an
 * `{ type: "api_key", key }` entry rather than an OAuth credential, so the
 * OAuth reader above skips it; this returns the raw key for usage lookups.
 * Returns undefined when the file is missing, unparseable, or the kiro entry is
 * not an API key.
 */
export function getPiHostKiroApiKey(agentDir = getPiAgentDir()): string | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(agentDir, "auth.json"), "utf-8"));
  } catch {
    return undefined;
  }

  const kiro = asRecord(asRecord(raw)?.kiro);
  if (!kiro || kiro.type !== "api_key" || typeof kiro.key !== "string" || !kiro.key) return undefined;
  return kiro.key;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}
