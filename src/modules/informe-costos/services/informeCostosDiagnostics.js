const MAX_EVENTS = 120;

const state = {
  startedAt: Date.now(),
  counters: {},
  gauges: {},
  timings: {},
  events: [],
};

const listeners = new Set();

function notify() {
  for (const listener of listeners) {
    try { listener(); } catch (_) {}
  }
}

export function diagCount(name, amount = 1) {
  state.counters[name] = (state.counters[name] || 0) + amount;
}

export function diagGauge(name, value) {
  state.gauges[name] = value;
}

export function diagTiming(name, durationMs, meta = {}) {
  const duration = Number(durationMs) || 0;
  const current = state.timings[name] || { count: 0, totalMs: 0, maxMs: 0, lastMs: 0, avgMs: 0 };
  current.count += 1;
  current.totalMs += duration;
  current.lastMs = duration;
  current.maxMs = Math.max(current.maxMs, duration);
  current.avgMs = current.totalMs / current.count;
  state.timings[name] = current;
  state.events.unshift({ type: "timing", name, durationMs: duration, at: Date.now(), meta });
  if (state.events.length > MAX_EVENTS) state.events.length = MAX_EVENTS;
  notify();
}

export function diagEvent(name, meta = {}) {
  state.events.unshift({ type: "event", name, at: Date.now(), meta });
  if (state.events.length > MAX_EVENTS) state.events.length = MAX_EVENTS;
  notify();
}

export function diagSnapshot() {
  return {
    startedAt: state.startedAt,
    counters: { ...state.counters },
    gauges: { ...state.gauges },
    timings: Object.fromEntries(Object.entries(state.timings).map(([key, value]) => [key, { ...value }])),
    events: state.events.map((event) => ({ ...event, meta: { ...(event.meta || {}) } })),
  };
}

export function diagReset() {
  state.startedAt = Date.now();
  state.counters = {};
  state.gauges = {};
  state.timings = {};
  state.events = [];
  notify();
}

export function subscribeDiagnostics(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
