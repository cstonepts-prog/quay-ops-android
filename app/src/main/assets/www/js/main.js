import { isInstalled, markInstalled, probeEnvironment, createWizardState, nextStep, prevStep, STEPS } from "./installer.js";
import { formatBytes, formatSpeed, formatWhen } from "./utils.js";

const STORAGE = "quay-state-v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveState(s) {
  try { localStorage.setItem(STORAGE, JSON.stringify(s)); } catch {}
}

function seedDemo() {
  const MB = 1024 * 1024;
  const now = Date.now();
  return {
    sites: [
      { id: "site_romford", name: "Romford backup", host: "ftp.romford.ops", protocol: "sftp", port: 22, connected: true },
      { id: "site_studio", name: "Studio prod", host: "assets.studio.prod", protocol: "ftp", port: 21, connected: true },
    ],
    jobs: [
      { id: "j1", fileName: "invoice-batch.zip", status: "transferring", sizeBytes: 18 * MB, transferred: 11 * MB, speedBps: 3.2 * MB, siteId: "site_romford", direction: "upload" },
      { id: "j2", fileName: "grade-v3.mov", status: "transferring", sizeBytes: 210 * MB, transferred: 42 * MB, speedBps: 4.1 * MB, siteId: "site_studio", direction: "download" },
      { id: "j3", fileName: "podcast-ep12.wav", status: "waiting", sizeBytes: 86 * MB, transferred: 0, speedBps: 0, siteId: "site_romford", direction: "upload" },
      { id: "j4", fileName: "ledger-q3.csv", status: "completed", sizeBytes: 890 * 1024, transferred: 890 * 1024, speedBps: 0, siteId: "site_romford", direction: "upload" },
    ],
    schedules: [
      { id: "s1", name: "Nightly backup", enabled: true, nextRunAt: now + 6 * 3600000 },
      { id: "s2", name: "Log shipper", enabled: true, nextRunAt: now + 120000 },
    ],
    settings: { concurrency: 3, bandwidthMBps: 8 },
    logs: [{ id: "l1", at: now, level: "ok", message: "Quay ready · demo fleet loaded" }],
    view: "board",
  };
}

let state = loadState() || null;
let wizard = null;
let tickTimer = null;

function siteName(id) {
  return state?.sites?.find(s => s.id === id)?.name || id || "—";
}

function liveCount() {
  return (state?.jobs || []).filter(j => j.status === "transferring").length;
}
function waitCount() {
  return (state?.jobs || []).filter(j => j.status === "waiting").length;
}

window.__quayStatus = function () {
  return JSON.stringify({ live: liveCount(), wait: waitCount() });
};
window.__QUAY_STATE = state;

function tick() {
  if (!state) return;
  let changed = false;
  for (const j of state.jobs) {
    if (j.status !== "transferring") continue;
    const step = (j.speedBps || 1e6) * 0.5;
    j.transferred = Math.min(j.sizeBytes, j.transferred + step);
    if (j.transferred >= j.sizeBytes) {
      j.status = "completed";
      j.speedBps = 0;
      const next = state.jobs.find(x => x.status === "waiting");
      if (next) {
        next.status = "transferring";
        next.speedBps = 2.5 * 1024 * 1024;
      }
    }
    changed = true;
  }
  if (changed) {
    saveState(state);
    window.__QUAY_STATE = state;
    render();
  }
}

function renderWizard() {
  const probe = wizard.probe;
  const step = STEPS[wizard.step];
  let body = "";
  if (step.id === "welcome") {
    body = `<p>Industrial FTP console with queue, scheduling, and background transfers.</p>
      <div>${probe.notes.map(n => `<div class="probe">· ${n}</div>`).join("")}</div>`;
  } else if (step.id === "mode") {
    body = `<p>Load a demo fleet or start clean.</p>
      <label class="row"><span>Demo fleet</span><input type="radio" name="mode" value="demo" ${wizard.mode==="demo"?"checked":""} /></label>
      <label class="row"><span>Clean install</span><input type="radio" name="mode" value="clean" ${wizard.mode==="clean"?"checked":""} /></label>`;
  } else if (step.id === "capacity") {
    body = `<p>Suggested berths: <strong>${wizard.concurrency}</strong> · bandwidth ${wizard.bandwidthMBps} MB/s</p>
      <label class="row"><span>Parallel berths</span>
        <input type="range" min="1" max="6" value="${wizard.concurrency}" id="cap" /></label>`;
  } else if (step.id === "review") {
    body = `<p>Mode: <strong>${wizard.mode}</strong><br/>Berths: <strong>${wizard.concurrency}</strong><br/>Bandwidth: <strong>${wizard.bandwidthMBps} MB/s</strong></p>`;
  }

  const app = document.getElementById("app");
  app.innerHTML = `<div class="wizard">
    <h1>Quay</h1>
    <p class="muted">Step ${wizard.step + 1} · ${step.title}</p>
    ${body}
    <div class="actions">
      ${wizard.step > 0 ? `<button class="btn ghost" id="back">Back</button>` : ""}
      <button class="btn" id="next">${step.id === "review" ? "Launch" : "Continue"}</button>
    </div>
  </div>`;

  document.getElementById("back")?.addEventListener("click", () => {
    wizard.step = prevStep(wizard);
    renderWizard();
  });
  document.getElementById("next")?.addEventListener("click", () => {
    const modeEl = document.querySelector('input[name="mode"]:checked');
    if (modeEl) wizard.mode = modeEl.value;
    const cap = document.getElementById("cap");
    if (cap) wizard.concurrency = Number(cap.value);
    if (step.id === "review") {
      finishInstall();
      return;
    }
    wizard.step = nextStep(wizard);
    renderWizard();
  });
}

function finishInstall() {
  markInstalled({ mode: wizard.mode, concurrency: wizard.concurrency });
  state = seedDemo();
  state.settings.concurrency = wizard.concurrency;
  state.settings.bandwidthMBps = wizard.bandwidthMBps;
  saveState(state);
  window.__QUAY_STATE = state;
  if (window.QuayNative?.startBackground) {
    try { window.QuayNative.startBackground(); } catch {}
  }
  startTick();
  render();
}

function renderBoard() {
  const jobs = state.jobs || [];
  const live = jobs.filter(j => j.status === "transferring");
  const waiting = jobs.filter(j => j.status === "waiting");
  const done = jobs.filter(j => j.status === "completed" || j.status === "failed");

  const jobRow = (j) => {
    const pct = j.sizeBytes ? Math.round((j.transferred / j.sizeBytes) * 100) : 0;
    return `<div class="row" style="flex-direction:column;align-items:stretch">
      <div style="display:flex;justify-content:space-between;gap:8px">
        <strong>${j.fileName}</strong>
        <span class="status-${j.status}">${j.status}</span>
      </div>
      <div class="muted" style="font-size:12px">${j.direction} · ${siteName(j.siteId)} · ${formatBytes(j.transferred)} / ${formatBytes(j.sizeBytes)}
        ${j.speedBps ? " · " + formatSpeed(j.speedBps) : ""}</div>
      ${j.status === "transferring" || j.status === "paused" ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ""}
    </div>`;
  };

  return `
    <div class="card"><h3>Live berths · ${live.length}/${state.settings?.concurrency || 3}</h3>
      ${live.length ? live.map(jobRow).join("") : `<div class="empty">No active transfers</div>`}
    </div>
    <div class="card"><h3>Queue · ${waiting.length}</h3>
      ${waiting.length ? waiting.map(jobRow).join("") : `<div class="empty">Queue clear</div>`}
    </div>
    <div class="card"><h3>Recent</h3>
      ${done.slice(0, 5).map(jobRow).join("") || `<div class="empty">None yet</div>`}
    </div>`;
}

function renderSites() {
  return `<div class="card"><h3>Fleet</h3>
    ${(state.sites || []).map(s => `
      <div class="row">
        <div><strong>${s.name}</strong><div class="muted" style="font-size:12px">${s.protocol}://${s.host}:${s.port || 21}</div></div>
        <span class="badge ${s.connected ? "live" : ""}">${s.connected ? "online" : "offline"}</span>
      </div>`).join("") || `<div class="empty">No sites</div>`}
  </div>`;
}

function renderSchedules() {
  return `<div class="card"><h3>Schedules</h3>
    ${(state.schedules || []).map(s => `
      <div class="row">
        <div><strong>${s.name}</strong><div class="muted" style="font-size:12px">Next ${formatWhen(s.nextRunAt)}</div></div>
        <span class="badge">${s.enabled ? "armed" : "off"}</span>
      </div>`).join("") || `<div class="empty">No schedules</div>`}
  </div>`;
}

function render() {
  if (!isInstalled() || !state) {
    if (!wizard) wizard = createWizardState(probeEnvironment());
    renderWizard();
    return;
  }
  const view = state.view || "board";
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="topbar">
      <div class="brand">QUAY</div>
      <div class="tabs">
        <button class="tab ${view==="board"?"active":""}" data-v="board">Board</button>
        <button class="tab ${view==="queue"?"active":""}" data-v="queue">Queue</button>
        <button class="tab ${view==="sites"?"active":""}" data-v="sites">Fleet</button>
        <button class="tab ${view==="schedules"?"active":""}" data-v="schedules">Schedules</button>
      </div>
      <span class="badge live">${liveCount()} live</span>
    </div>
    <div class="main">
      ${view === "board" || view === "queue" ? renderBoard() : ""}
      ${view === "sites" ? renderSites() : ""}
      ${view === "schedules" ? renderSchedules() : ""}
    </div>`;
  app.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      state.view = btn.dataset.v;
      saveState(state);
      render();
    });
  });
}

function startTick() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(tick, 500);
}

function boot() {
  document.documentElement.classList.add("quay-android");
  if (isInstalled()) {
    state = loadState() || seedDemo();
    window.__QUAY_STATE = state;
    if (window.QuayNative?.startBackground) {
      try { window.QuayNative.startBackground(); } catch {}
    }
    startTick();
  }
  render();
}

boot();
