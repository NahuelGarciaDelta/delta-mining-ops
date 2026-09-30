import { promises as fs } from "node:fs";
import path from "node:path";
import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";

const [profilesDir, sourceMapRoot] = process.argv.slice(2);
if (!profilesDir || !sourceMapRoot) throw new Error("Uso: node phase1c-symbolicate.mjs <profiles-dir> <source-map-root>");

const mapCache = new Map();
const basename = (value) => path.basename(String(value || "").split("?")[0]);
async function getMap(url) {
  const file = basename(url);
  if (!file.endsWith(".js")) return null;
  if (!mapCache.has(file)) {
    mapCache.set(file, fs.readFile(path.join(sourceMapRoot, `${file}.map`), "utf8").then((raw) => new TraceMap(JSON.parse(raw))).catch(() => null));
  }
  return mapCache.get(file);
}
async function symbolicate(frame) {
  const generated = { url: String(frame.url || ""), line: Number(frame.lineNumber ?? -1), column: Number(frame.columnNumber ?? -1) };
  const map = await getMap(generated.url);
  if (!map || generated.line < 0 || generated.column < 0) return { generated, source: null, line: null, column: null, name: null };
  const original = originalPositionFor(map, { line: generated.line + 1, column: generated.column });
  return { generated, source: original.source || null, line: original.line || null, column: original.column ?? null, name: original.name || null };
}

function metrics(profile) {
  const nodes = new Map((profile.nodes || []).map((node) => [node.id, node]));
  const parent = new Map();
  for (const node of profile.nodes || []) for (const child of node.children || []) parent.set(child, node.id);
  const values = new Map([...nodes].map(([id, node]) => [id, { node, parentId: parent.get(id) ?? null, selfMs: 0, totalMs: 0, samples: 0 }]));
  (profile.samples || []).forEach((id, index) => {
    const milliseconds = Number(profile.timeDeltas?.[index] || 0) / 1000;
    const leaf = values.get(id); if (leaf) { leaf.selfMs += milliseconds; leaf.samples += 1; }
    let current = id; let guard = 0;
    while (current && guard++ < 150) { const item = values.get(current); if (item) item.totalMs += milliseconds; current = parent.get(current); }
  });
  return [...values.values()];
}

async function enrich(item, all) {
  const frame = item.node.callFrame || {};
  const location = await symbolicate(frame);
  const chain = [];
  let current = item; let guard = 0;
  while (current && guard++ < 40) {
    const currentFrame = current.node.callFrame || {};
    const currentLocation = await symbolicate(currentFrame);
    chain.unshift({ nodeId: current.node.id, functionName: currentFrame.functionName || "(anonymous)", ...currentLocation });
    current = current.parentId == null ? null : all.get(current.parentId);
  }
  return { nodeId: item.node.id, parentId: item.parentId, functionName: frame.functionName || "(anonymous)", ...location, selfMs: item.selfMs, totalMs: item.totalMs, samples: item.samples, callStack: chain };
}

const entries = (await fs.readdir(profilesDir)).filter((file) => file.endsWith(".cpu-profile.json")).sort();
const scenarios = [];
for (const file of entries) {
  const profile = JSON.parse(await fs.readFile(path.join(profilesDir, file), "utf8"));
  const computed = metrics(profile);
  const all = new Map(computed.map((item) => [item.node.id, item]));
  const hotspots = await Promise.all(computed.filter((item) => item.selfMs > 100 || item.totalMs > 250).map((item) => enrich(item, all)));
  scenarios.push({ scenario: file.replace(".cpu-profile.json", ""), hotspots: hotspots.sort((a, b) => b.totalMs - a.totalMs) });
}
const aggregate = new Map();
for (const scenario of scenarios) for (const hotspot of scenario.hotspots) {
  const original = hotspot.name || hotspot.functionName || "(anonymous)";
  const key = `${hotspot.source || hotspot.generated.url}:${hotspot.line ?? "?"}:${original}`;
  const item = aggregate.get(key) || { original, source: hotspot.source, line: hotspot.line, scenarios: [], samples: 0, selfMs: 0, totalMs: 0 };
  item.scenarios.push(scenario.scenario); item.samples += hotspot.samples; item.selfMs += hotspot.selfMs; item.totalMs += hotspot.totalMs; aggregate.set(key, item);
}
const result = { sourceMapRoot, scenarios, aggregate: [...aggregate.values()].sort((a, b) => b.totalMs - a.totalMs) };
await fs.writeFile(path.join(profilesDir, "cpu-profile-symbolicated.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ scenarios: scenarios.map(({ scenario, hotspots }) => ({ scenario, hotspots: hotspots.slice(0, 10) })), aggregate: result.aggregate.slice(0, 20) }, null, 2));
