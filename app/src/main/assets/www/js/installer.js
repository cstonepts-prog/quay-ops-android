/**
 * Quay installer wizard — intelligent first-run setup.
 * Zero external dependencies. Reads device/network hints when available.
 */

export const INSTALL_KEY = "quay-install-v1";

export function isInstalled() {
  try {
    const raw = localStorage.getItem(INSTALL_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return Boolean(data?.completedAt);
  } catch {
    return false;
  }
}

export function markInstalled(meta = {}) {
  const payload = {
    completedAt: Date.now(),
    mode: meta.mode || "demo",
    version: 1,
    ...meta,
  };
  localStorage.setItem(INSTALL_KEY, JSON.stringify(payload));
  return payload;
}

export function clearInstall() {
  localStorage.removeItem(INSTALL_KEY);
}

export function probeEnvironment() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory;
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const downlink = conn?.downlink;
  const saveData = Boolean(conn?.saveData);
  const online = navigator.onLine !== false;
  const platform = navigator.platform || "unknown";
  const touch = navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches;

  let concurrency = Math.max(1, Math.min(6, Math.round(cores / 2)));
  if (mem && mem <= 4) concurrency = Math.min(concurrency, 2);
  if (touch) concurrency = Math.min(concurrency, 3);

  let bandwidthMBps = 8;
  if (typeof downlink === "number" && downlink > 0) {
    bandwidthMBps = Math.max(1, Math.min(32, Math.round(downlink / 8)));
  }
  if (saveData) bandwidthMBps = Math.min(bandwidthMBps, 2);
  if (mem && mem <= 4) bandwidthMBps = Math.min(bandwidthMBps, 4);

  return {
    cores,
    mem: mem ?? null,
    downlink: downlink ?? null,
    saveData,
    online,
    platform,
    touch,
    suggested: { concurrency, bandwidthMBps, autoRetry: true },
    notes: buildProbeNotes({ cores, mem, downlink, saveData, online, touch }),
  };
}

function buildProbeNotes({ cores, mem, downlink, saveData, online, touch }) {
  const notes = [];
  notes.push(`${cores} CPU thread${cores === 1 ? "" : "s"} detected`);
  if (mem) notes.push(`~${mem} GB device memory`);
  if (typeof downlink === "number") notes.push(`~${downlink} Mbps link estimate`);
  if (saveData) notes.push("Data-saver mode is on — bandwidth capped");
  if (!online) notes.push("Browser reports offline — demo mode still works");
  if (touch) notes.push("Touch interface — compact defaults applied");
  return notes;
}

export function defaultPort(protocol) {
  if (protocol === "sftp") return 22;
  if (protocol === "ftps") return 990;
  return 21;
}

export function validateHost(host) {
  const h = String(host || "").trim();
  if (!h) return "Host is required";
  if (h.length > 253) return "Host is too long";
  if (/[\s]/.test(h)) return "Host cannot contain spaces";
  if (!/^[a-zA-Z0-9._\-[\]]+$/.test(h)) return "Host has invalid characters";
  return null;
}

export function validateSiteName(name) {
  const n = String(name || "").trim();
  if (!n) return "Name is required";
  if (n.length > 64) return "Name is too long";
  return null;
}

export const STEPS = [
  { id: "welcome", title: "Welcome", short: "Start" },
  { id: "mode", title: "Install mode", short: "Mode" },
  { id: "capacity", title: "Transfer capacity", short: "Capacity" },
  { id: "site", title: "First site", short: "Site" },
  { id: "review", title: "Review", short: "Finish" },
];

export function createWizardState(probe) {
  return {
    step: 0,
    mode: "demo",
    concurrency: probe.suggested.concurrency,
    bandwidthMBps: probe.suggested.bandwidthMBps,
    autoRetry: true,
    site: {
      name: "",
      host: "",
      protocol: "sftp",
      port: 22,
      username: "",
      note: "",
      connectNow: true,
    },
    errors: {},
    probe,
  };
}

export function nextStep(wizard) {
  let step = wizard.step + 1;
  if (STEPS[step]?.id === "site" && wizard.mode === "demo") step += 1;
  return Math.min(step, STEPS.length - 1);
}

export function prevStep(wizard) {
  let step = wizard.step - 1;
  if (STEPS[step]?.id === "site" && wizard.mode === "demo") step -= 1;
  return Math.max(step, 0);
}

export function validateStep(wizard) {
  const id = STEPS[wizard.step]?.id;
  const errors = {};
  if (id === "site" && wizard.mode === "clean") {
    const nameErr = validateSiteName(wizard.site.name);
    const hostErr = validateHost(wizard.site.host);
    if (nameErr) errors.name = nameErr;
    if (hostErr) errors.host = hostErr;
    const port = Number(wizard.site.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) errors.port = "Port must be 1–65535";
  }
  return errors;
}
