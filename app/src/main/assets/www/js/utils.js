export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export function formatBytes(bytes, digits = 1) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  const d = n >= 100 || i === 0 ? 0 : digits;
  return `${n.toFixed(d)} ${units[i]}`;
}

export function formatSpeed(bps) {
  if (!bps || bps < 1) return "0 B/s";
  return `${formatBytes(bps, bps > 1024 * 1024 ? 1 : 0)}/s`;
}

export function formatEta(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  if (seconds < 1) return "<1s";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function formatClock(ts) {
  if (!ts) return "00:00:00";
  const d = new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

export function formatWhen(ts, now = Date.now()) {
  if (!now || !ts) return "—";
  const delta = ts - now;
  if (Math.abs(delta) < 8000) return "now";
  if (ts < now) {
    const secs = Math.round((now - ts) / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 48) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  }
  if (delta < 60000) return "in <1m";
  const mins = Math.round(delta / 60000);
  if (mins < 60) return `in ${mins}m`;
  const d = new Date(ts);
  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const hm = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (sameDay(d, today)) return `today ${hm}`;
  if (sameDay(d, tomorrow)) return `tomorrow ${hm}`;
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatRecurrence(r) {
  const pad = (n) => String(n).padStart(2, "0");
  if (r.kind === "once") {
    return `Once · ${new Date(r.at).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })}`;
  }
  if (r.kind === "interval") {
    if (r.everyMinutes < 60) return `Every ${r.everyMinutes} min`;
    const h = r.everyMinutes / 60;
    return Number.isInteger(h) ? `Every ${h}h` : `Every ${r.everyMinutes} min`;
  }
  if (r.kind === "daily") return `Daily ${pad(r.hour)}:${pad(r.minute)}`;
  if (r.kind === "weekly") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${days[r.weekday] ?? "?"} ${pad(r.hour)}:${pad(r.minute)}`;
  }
  return "—";
}

export function computeNextRun(recurrence, from, lastRunAt) {
  if (recurrence.kind === "once") {
    return recurrence.at > from ? recurrence.at : null;
  }
  if (recurrence.kind === "interval") {
    const step = Math.max(1, recurrence.everyMinutes) * 60_000;
    if (!lastRunAt) return from;
    let next = lastRunAt + step;
    while (next <= from) next += step;
    return next;
  }
  if (recurrence.kind === "daily") {
    const d = new Date(from);
    d.setSeconds(0, 0);
    d.setHours(recurrence.hour, recurrence.minute, 0, 0);
    if (d.getTime() <= from) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setHours(recurrence.hour, recurrence.minute, 0, 0);
  const delta = (recurrence.weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  if (d.getTime() <= from) d.setDate(d.getDate() + 7);
  return d.getTime();
}
