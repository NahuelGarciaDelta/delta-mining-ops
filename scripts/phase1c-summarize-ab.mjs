import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'artifacts/phase1c-ab');
const PAIRS = [1, 2, 3, 4, 5];

const summaryScenarios = {
  cold: 'Cold',
  warm: 'Warm',
  navigation: 'Navigation',
};

const stepSpecs = [
  { key: 'rop05', label: 'ROP05', stepLabel: 'ROP05 / Productividad' },
  { key: 'control', label: 'Control', stepLabel: 'Control ROP05 vs ROP02' },
  { key: 'actualizar', label: 'Actualizar Control', stepLabel: 'Botón Actualizar en Control' },
];

const metricDefs = [];
for (const [scenario, label] of Object.entries(summaryScenarios)) {
  for (const field of ['requests', 'resourceTransferBytes', 'longTaskMs']) {
    metricDefs.push({ key: `${scenario}.${field}`, label: `${label} ${field}` });
  }
}
for (const spec of stepSpecs) {
  for (const field of ['requests', 'resourceTransferBytes', 'longTaskMs', 'durationMs', 'status0', 'networkErrors', 'timeouts']) {
    metricDefs.push({ key: `${spec.key}.${field}`, label: `${spec.label} ${field}` });
  }
}

const exists = async (p) => fs.access(p).then(() => true).catch(() => false);
const readText = async (p) => fs.readFile(p, 'utf8').catch(() => null);
const readJson = async (p) => {
  try { return JSON.parse(await fs.readFile(p, 'utf8')); }
  catch { return null; }
};
const numOrNull = (v) => Number.isFinite(Number(v)) ? Number(v) : null;

function networkStats(step) {
  if (!step || !Array.isArray(step.network)) {
    return { status0: null, networkErrors: null, timeouts: null };
  }
  let status0 = 0;
  let networkErrors = 0;
  let timeouts = 0;
  for (const item of step.network) {
    if (Number(item?.status) === 0) status0 += 1;
    const err = item?.error;
    if (err !== null && err !== undefined && String(err) !== '') {
      networkErrors += 1;
      if (String(err).toLowerCase().includes('timeout')) timeouts += 1;
    }
  }
  return { status0, networkErrors, timeouts };
}

function extractSide(doc) {
  if (!doc) return null;
  const out = {};
  const summaries = Array.isArray(doc.summaries) ? doc.summaries : [];
  for (const scenario of Object.keys(summaryScenarios)) {
    const item = summaries.find((x) => String(x?.scenario || '').toLowerCase() === scenario) || null;
    out[scenario] = item ? {
      requests: numOrNull(item.requests),
      resourceTransferBytes: numOrNull(item.resourceTransferBytes),
      longTaskMs: numOrNull(item.longTaskMs),
    } : {
      requests: null,
      resourceTransferBytes: null,
      longTaskMs: null,
    };
  }

  const steps = Array.isArray(doc.steps) ? doc.steps : [];
  for (const spec of stepSpecs) {
    const step = steps.find((x) => x?.label === spec.stepLabel) || null;
    const net = networkStats(step);
    out[spec.key] = step ? {
      requests: numOrNull(step.requests),
      resourceTransferBytes: numOrNull(step.resourceTransferBytes),
      longTaskMs: numOrNull(step.longTaskMs),
      durationMs: numOrNull(step.durationMs),
      ...net,
    } : {
      requests: null,
      resourceTransferBytes: null,
      longTaskMs: null,
      durationMs: null,
      status0: null,
      networkErrors: null,
      timeouts: null,
    };
  }
  return out;
}

function getMetric(side, key) {
  if (!side) return null;
  const [group, field] = key.split('.');
  const value = side?.[group]?.[field];
  return Number.isFinite(value) ? value : null;
}

function median(values) {
  const nums = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function calcMetric(pairs, key) {
  const cells = {};
  const pairedB = [];
  const pairedC = [];
  const pairedSamples = [];
  for (const pair of pairs) {
    const b = pair.valid ? getMetric(pair.baseline, key) : null;
    const c = pair.valid ? getMetric(pair.candidate, key) : null;
    cells[`B${pair.pair}`] = b;
    cells[`C${pair.pair}`] = c;
    if (pair.valid && Number.isFinite(b) && Number.isFinite(c)) {
      pairedB.push(b);
      pairedC.push(c);
      pairedSamples.push(pair.pair);
    }
  }
  const medianBaseline = median(pairedB);
  const medianCandidate = median(pairedC);
  const delta = Number.isFinite(medianBaseline) && Number.isFinite(medianCandidate)
    ? medianCandidate - medianBaseline
    : null;
  const deltaPercent = Number.isFinite(delta) && Number.isFinite(medianBaseline) && medianBaseline !== 0
    ? (delta / medianBaseline) * 100
    : null;
  return { cells, pairedSamples, medianBaseline, medianCandidate, delta, deltaPercent };
}

function csvCell(v) {
  const s = v === null || v === undefined ? 'N/A' : String(v);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
function mdCell(v) {
  if (v === null || v === undefined) return 'N/A';
  if (typeof v === 'number' && !Number.isInteger(v)) return String(Math.round(v * 100) / 100);
  return String(v);
}

await fs.mkdir(root, { recursive: true });
const pairs = [];
for (const pairNo of PAIRS) {
  const pairDir = path.join(root, `pair-${pairNo}`);
  const validMarker = await readText(path.join(pairDir, 'pair-valid.txt'));
  const valid = String(validMarker || '').trim() === 'true';
  const baselineDoc = await readJson(path.join(pairDir, 'baseline', 'production-browser-performance.json'));
  const candidateDoc = await readJson(path.join(pairDir, 'candidate', 'production-browser-performance.json'));
  pairs.push({
    pair: pairNo,
    valid,
    baseline: valid ? extractSide(baselineDoc) : null,
    candidate: valid ? extractSide(candidateDoc) : null,
    files: {
      baseline: await exists(path.join(pairDir, 'baseline', 'production-browser-performance.json')),
      candidate: await exists(path.join(pairDir, 'candidate', 'production-browser-performance.json')),
    },
  });
}

const validPairs = pairs.filter((p) => p.valid).map((p) => p.pair);
const conclusion = validPairs.length < 3 ? 'INCONCLUSIVE' : 'READY_FOR_REVIEW';
const metrics = {};
for (const def of metricDefs) metrics[def.key] = { label: def.label, ...calcMetric(pairs, def.key) };

const summary = {
  generatedAt: new Date().toISOString(),
  root,
  validPairs,
  validPairCount: validPairs.length,
  conclusion,
  pairs,
  metrics,
};
await fs.writeFile(path.join(root, 'summary.json'), JSON.stringify(summary, null, 2));

const cols = ['metric', 'B1', 'C1', 'B2', 'C2', 'B3', 'C3', 'B4', 'C4', 'B5', 'C5', 'medianBaseline', 'medianCandidate', 'delta', 'deltaPercent'];
const csv = [cols.join(',')];
for (const def of metricDefs) {
  const m = metrics[def.key];
  const row = [def.label];
  for (const i of PAIRS) row.push(m.cells[`B${i}`], m.cells[`C${i}`]);
  row.push(m.medianBaseline, m.medianCandidate, m.delta, m.deltaPercent);
  csv.push(row.map(csvCell).join(','));
}
await fs.writeFile(path.join(root, 'summary.csv'), `${csv.join('\n')}\n`);

const md = [];
md.push('# Phase 1C A/B');
md.push('');
md.push(`Valid pairs: ${validPairs.length}/5 (${validPairs.length ? validPairs.join(', ') : 'none'})`);
md.push(`Conclusion: ${conclusion}`);
md.push('');
md.push('| Métrica | B1 | C1 | B2 | C2 | B3 | C3 | B4 | C4 | B5 | C5 | Mediana B | Mediana C | Δ | % |');
md.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const def of metricDefs) {
  const m = metrics[def.key];
  const row = [def.label];
  for (const i of PAIRS) row.push(mdCell(m.cells[`B${i}`]), mdCell(m.cells[`C${i}`]));
  row.push(mdCell(m.medianBaseline), mdCell(m.medianCandidate), mdCell(m.delta), mdCell(m.deltaPercent));
  md.push(`| ${row.join(' | ')} |`);
}
md.push('');
md.push('Notes: medians use only valid pairs with numeric values on both baseline and candidate for the metric. Invalid pairs and missing fields are N/A.');
await fs.writeFile(path.join(root, 'medians.md'), `${md.join('\n')}\n`);

console.log(JSON.stringify({ root, validPairs, conclusion, outputs: ['summary.json', 'summary.csv', 'medians.md'] }));
