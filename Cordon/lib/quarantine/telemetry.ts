import { createHash } from "node:crypto";

import type { CanaryDefinition, NetworkPolicy, RuntimeEvent, RuntimeEventType } from "./types";

export const TELEMETRY_PREFIX = "CORDON_EVENT ";
export const MAX_EVENT_EVIDENCE = 2_000;

function eventId(event: Omit<RuntimeEvent, "id">, index: number): string {
  return createHash("sha256").update(`${index}:${event.timestamp}:${event.type}:${event.evidence}`).digest("hex").slice(0, 16);
}

function safeEvent(value: unknown, index: number): RuntimeEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const types: RuntimeEventType[] = ["process-start", "process-exit", "file-read", "file-write", "sensitive-path-access", "network-attempt", "canary-access", "canary-propagation", "stdout", "stderr", "policy-violation"];
  if (!types.includes(raw.type as RuntimeEventType) || typeof raw.evidence !== "string") return null;
  const timestamp = typeof raw.timestamp === "string" && !Number.isNaN(Date.parse(raw.timestamp)) ? raw.timestamp : new Date().toISOString();
  const event: Omit<RuntimeEvent, "id"> = {
    timestamp,
    type: raw.type as RuntimeEventType,
    evidence: raw.evidence.slice(0, MAX_EVENT_EVIDENCE),
  };
  if (typeof raw.processId === "number") event.processId = raw.processId;
  if (typeof raw.parentProcessId === "number") event.parentProcessId = raw.parentProcessId;
  if (typeof raw.command === "string") event.command = raw.command.slice(0, 1_000);
  if (typeof raw.filePath === "string") event.filePath = raw.filePath.slice(0, 1_000);
  if (typeof raw.destination === "string") event.destination = raw.destination.slice(0, 1_000);
  if (typeof raw.canaryId === "string") event.canaryId = raw.canaryId.slice(0, 100);
  if (["allowed", "blocked", "observed", "unknown"].includes(String(raw.outcome))) event.outcome = raw.outcome as RuntimeEvent["outcome"];
  return { id: eventId(event, index), ...event };
}

export function parseTelemetryOutput(stderr: string): { events: RuntimeEvent[]; stderr: string } {
  const events: RuntimeEvent[] = [];
  const visible: string[] = [];
  for (const line of stderr.split(/\r?\n/)) {
    if (!line.startsWith(TELEMETRY_PREFIX)) {
      if (line) visible.push(line);
      continue;
    }
    try {
      const event = safeEvent(JSON.parse(line.slice(TELEMETRY_PREFIX.length)), events.length);
      if (event) events.push(event);
    } catch {
      visible.push("[Cordon discarded one malformed telemetry record]");
    }
  }
  return { events, stderr: visible.join("\n") };
}

export function outputEvents(stdout: string, stderr: string, timestamp = new Date().toISOString()): RuntimeEvent[] {
  const result: RuntimeEvent[] = [];
  if (stdout) result.push({ id: eventId({ timestamp, type: "stdout", evidence: stdout.slice(0, MAX_EVENT_EVIDENCE) }, 0), timestamp, type: "stdout", evidence: stdout.slice(0, MAX_EVENT_EVIDENCE) });
  if (stderr) result.push({ id: eventId({ timestamp, type: "stderr", evidence: stderr.slice(0, MAX_EVENT_EVIDENCE) }, 1), timestamp, type: "stderr", evidence: stderr.slice(0, MAX_EVENT_EVIDENCE) });
  return result;
}

export function telemetryPreloadSource(): string {
  return String.raw`"use strict";
const fs = require("node:fs");
const child = require("node:child_process");
const net = require("node:net");
const http = require("node:http");
const https = require("node:https");
const originalStderrWrite = process.stderr.write.bind(process.stderr);
const manifestPath = process.env.CORDON_CANARY_MANIFEST || "/cordon/canaries.json";
let canaries = [];
try { canaries = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch {}
const networkPolicy = process.env.CORDON_NETWORK_POLICY || "disabled";
const allowedDomains = (process.env.CORDON_ALLOWED_DOMAINS || "").split(",").filter(Boolean);
function clean(value) {
  let text = String(value ?? "");
  for (const canary of canaries) text = text.split(canary.marker).join("[CANARY:" + canary.id + "]");
  return text.slice(0, 2000);
}
function emit(event) {
  try { originalStderrWrite("CORDON_EVENT " + JSON.stringify({ timestamp: new Date().toISOString(), processId: process.pid, parentProcessId: process.ppid, ...event, evidence: clean(event.evidence) }) + "\n"); } catch {}
}
function fileName(value) { return typeof value === "string" ? value : Buffer.isBuffer(value) ? value.toString("utf8") : value && value.href ? value.href : String(value); }
function canaryForPath(target) { const normalized = fileName(target); return canaries.find((canary) => normalized === canary.path || normalized.endsWith(canary.path.replace("/workspace/repository", ""))); }
function sensitivePath(target) { return /(?:^|\/)(?:\.ssh|\.aws|\.config\/gh|\.npmrc|\.env|wallet|browser-session)(?:\/|$)/i.test(fileName(target)); }
function markersIn(value) { const text = Buffer.isBuffer(value) ? value.toString("utf8") : typeof value === "string" ? value : ""; return canaries.filter((canary) => text.includes(canary.marker)); }
function wrapRead(name) {
  const original = fs[name]; if (typeof original !== "function") return;
  fs[name] = function(target, ...args) {
    const filePath = fileName(target); const canary = canaryForPath(filePath);
    try { const result = original.call(this, target, ...args); emit({ type: "file-read", filePath, outcome: "observed", evidence: name + " read " + filePath }); if (sensitivePath(filePath)) emit({ type: "sensitive-path-access", filePath, outcome: "observed", evidence: "Sensitive path read: " + filePath }); if (canary) emit({ type: "canary-access", filePath, canaryId: canary.id, outcome: "observed", evidence: "Read seeded " + canary.label }); return result; }
    catch (error) { emit({ type: canary ? "canary-access" : "file-read", filePath, canaryId: canary && canary.id, outcome: "blocked", evidence: name + " failed for " + filePath + ": " + (error && error.code || "error") }); throw error; }
  };
}
for (const name of ["readFileSync", "openSync", "createReadStream"]) wrapRead(name);
for (const name of ["readFile", "open"]) {
  const original = fs[name]; if (typeof original !== "function") continue;
  fs[name] = function(target, ...args) { const filePath = fileName(target); const canary = canaryForPath(filePath); emit({ type: "file-read", filePath, outcome: "unknown", evidence: name + " attempted " + filePath }); if (canary) emit({ type: "canary-access", filePath, canaryId: canary.id, outcome: "unknown", evidence: "Attempted to read seeded " + canary.label }); return original.call(this, target, ...args); };
}
function wrapWrite(name, dataIndex) {
  const original = fs[name]; if (typeof original !== "function") return;
  fs[name] = function(target, ...args) { const filePath = fileName(target); const data = args[dataIndex]; emit({ type: "file-write", filePath, outcome: "unknown", evidence: name + " attempted " + filePath }); for (const canary of markersIn(data)) emit({ type: "canary-propagation", filePath, canaryId: canary.id, outcome: "observed", evidence: "Seeded canary was copied into " + filePath }); return original.call(this, target, ...args); };
}
wrapWrite("writeFileSync", 0); wrapWrite("appendFileSync", 0); wrapWrite("writeFile", 0); wrapWrite("appendFile", 0);
for (const name of ["copyFileSync", "copyFile"]) {
  const original = fs[name]; if (typeof original !== "function") continue;
  fs[name] = function(source, destination, ...args) { const canary = canaryForPath(source); emit({ type: "file-write", filePath: fileName(destination), outcome: "unknown", evidence: name + " copied " + fileName(source) + " to " + fileName(destination) }); if (canary) emit({ type: "canary-propagation", filePath: fileName(destination), canaryId: canary.id, outcome: "observed", evidence: "Seeded canary was copied to " + fileName(destination) }); return original.call(this, source, destination, ...args); };
}
function commandText(command, args) { return [command, ...(Array.isArray(args) ? args : [])].map(String).join(" "); }
for (const name of ["spawn", "spawnSync", "execFile", "execFileSync", "fork"]) {
  const original = child[name]; if (typeof original !== "function") continue;
  child[name] = function(command, args, ...rest) { const text = commandText(command, args); emit({ type: "process-start", command: clean(text), outcome: "observed", evidence: "Child process requested: " + clean(text) }); for (const canary of markersIn(text)) emit({ type: "canary-propagation", command: clean(text), canaryId: canary.id, outcome: "unknown", evidence: "Canary was prepared in child-process arguments" }); return original.call(this, command, args, ...rest); };
}
for (const name of ["exec", "execSync"]) {
  const original = child[name]; if (typeof original !== "function") continue;
  child[name] = function(command, ...args) { emit({ type: "process-start", command: clean(command), outcome: "observed", evidence: "Shell process requested: " + clean(command) }); for (const canary of markersIn(command)) emit({ type: "canary-propagation", command: clean(command), canaryId: canary.id, outcome: "unknown", evidence: "Canary was prepared in shell arguments" }); return original.call(this, command, ...args); };
}
function destinationFrom(args) { const first = args[0]; if (typeof first === "object" && first) return { host: first.hostname || first.host || "unknown", port: first.port || "unknown" }; return { port: typeof first === "number" ? first : args[1] || "unknown", host: typeof first === "object" ? first.host : typeof args[1] === "string" ? args[1] : "unknown" }; }
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function(...args) { const dest = destinationFrom(args); const destination = dest.host + ":" + dest.port; const allowed = networkPolicy === "allowlist" && allowedDomains.some((domain) => dest.host === domain || String(dest.host).endsWith("." + domain)); emit({ type: "network-attempt", destination, outcome: allowed ? "allowed" : "blocked", evidence: "TCP connection attempted to " + destination + "; quarantine policy=" + networkPolicy }); return originalConnect.apply(this, args); };
const originalSocketWrite = net.Socket.prototype.write;
net.Socket.prototype.write = function(data, ...args) { for (const canary of markersIn(data)) emit({ type: "canary-propagation", canaryId: canary.id, outcome: networkPolicy === "disabled" ? "blocked" : "unknown", evidence: "Canary was prepared in an observable TCP payload; transmission is not confirmed" }); return originalSocketWrite.call(this, data, ...args); };
function wrapRequest(module, protocol) { const original = module.request; module.request = function(...args) { let destination = "unknown"; let serialized = ""; try { const first = args[0]; const url = typeof first === "string" || first instanceof URL ? new URL(first) : null; const options = url || first || {}; destination = (options.hostname || options.host || "unknown") + ":" + (options.port || (protocol === "https" ? 443 : 80)); serialized = JSON.stringify(options); } catch {} emit({ type: "network-attempt", destination, outcome: networkPolicy === "disabled" ? "blocked" : "unknown", evidence: protocol.toUpperCase() + " request attempted to " + destination }); for (const canary of markersIn(serialized)) emit({ type: "canary-propagation", canaryId: canary.id, destination, outcome: networkPolicy === "disabled" ? "blocked" : "unknown", evidence: "Canary was prepared in observable request metadata; transmission is not confirmed" }); const request = original.apply(module, args); const originalWrite = request.write; request.write = function(data, ...writeArgs) { for (const canary of markersIn(data)) emit({ type: "canary-propagation", canaryId: canary.id, destination, outcome: networkPolicy === "disabled" ? "blocked" : "unknown", evidence: "Canary was prepared in an observable request body; transmission is not confirmed" }); return originalWrite.call(this, data, ...writeArgs); }; return request; }; }
wrapRequest(http, "http"); wrapRequest(https, "https");
emit({ type: "process-start", command: clean(process.argv.join(" ")), outcome: "observed", evidence: "Quarantine process started" });
process.on("exit", (code) => emit({ type: "process-exit", command: clean(process.argv.join(" ")), outcome: code === 0 ? "observed" : "unknown", evidence: "Process exited with code " + code }));
`;
}

export function probeSource(): string {
  return String.raw`"use strict";
const fs = require("node:fs");
const path = require("node:path");
const target = path.join(process.cwd(), "package.json");
const manifest = JSON.parse(fs.readFileSync(target, "utf8"));
process.stdout.write("Cordon probe inspected package metadata for " + String(manifest.name || "unnamed-package") + ".\n");
`;
}

export function canaryManifest(canaries: CanaryDefinition[]): string {
  return JSON.stringify(canaries.map(({ id, label, path, marker }) => ({ id, label, path, marker })));
}

export function telemetryEnvironment(plan: { networkPolicy: NetworkPolicy; allowedDomains: string[] }): string[] {
  return [
    "--env", "CORDON_CANARY_MANIFEST=/cordon/canaries.json",
    "--env", `CORDON_NETWORK_POLICY=${plan.networkPolicy}`,
    "--env", `CORDON_ALLOWED_DOMAINS=${plan.allowedDomains.join(",")}`,
  ];
}
