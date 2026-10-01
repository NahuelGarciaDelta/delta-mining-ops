import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'artifacts/phase1c-ab');
const PAIRS = [1, 2, 3, 4, 5];
const SIDES = ['baseline', 'candidate'];
const STEP_LABELS = {
  rop05: 'ROP05 / Productividad',
  control: 'Control ROP05 vs ROP02',
  actualizar: 'Botón Actualizar en Control',
};

function displayStep(key) {
  return key === 'rop05' ? 'ROP05' : key === 'control' ? 'Control' : 'Actualizar Control';
}

const metricDefs = [
  ['cold.requests', 'Cold / requests'],
  ['cold.resourceTransferBytes', 'Cold / resourceTransferBytes'],
  ['cold.longTaskMs', 'Cold / longTaskMs'],
  ['warm.requests', 'Warm / requests'],
  ['warm.resourceTransferBytes', 'Warm / resourceTransferBytes'],
  ['warm.longTaskMs', 'Warm / longTaskMs'],
  ['navigation.requests', 'Navigation / requests'],
  ['navigation.resourceTransferBytes', 'Navigation / resourceTransferBytes'],
  ['navigation.longTaskMs', 'Navigation / longTaskMs'],
  ...['rop05', 'control', 'actualizar'].flatMap((key) => [
    [`${key}.requests`, `${displayStep(key)} / requests`],
    [`${key}.resourceTransferBytes`, `${displayStep(key)} / resourceTransferBytes`],
    [`${key}.longTaskMs`, `${displayStep(key)} / longTaskMs`],
    [`${key}.durationMs`, `${displayStep(key)} / durationMs`],
    [`${key}.status0`, `${displayStep(key)} / status0`],
    [`${key}.networkErrors`, `${displayStep(key)} / networkErrors`],
    [`${key}.timeouts`, `${displayStep(key)} / timeouts`],
  ]),
];

function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function csvCell(value) {
  if (value === null || value === undefined) return 'N/A';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function markdownCell(value) {
  return value === null || value === undefined ? 'N/A' : String(value);
}

function round(value, digits = 4) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function median(values) {
  const sorted = values
    .filter((value) => typeof value === 'number' && Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function getPath(object, dottedPath) {
  return dottedPath.split('.').reduce((value, key) => {
    if (value && Object.prototype.hasOwnProperty.call(value, key)) return value[key];
    return null;
  }, object);
}

function scenarioSummary(data, scenario) {
  const item = Array.isArray(data?.summaries)
    ? data.summaries.find((entry) => entry?.scenario === scenario)
    : null;
  if (!item) return { requests: null, resourceTransferBytes: null, longTaskMs: null };
  return {
    requests: numeric(item.requests),
    resourceTransferBytes: numeric(item.resourceTransferBytes),
    longTaskMs: numeric(item.longTaskMs),
  };
}

function stepMetrics(data, label) {
  const step = Array.isArray(data?.steps) ? data.steps.find((entry) => entry?.label === label) : null;
  if (!step) {
    return {
      requests: null,
      resourceTransferBytes: null,
      longTaskMs: null,
      durationMs: null,
      status0: null,
      networkErrors: null,
      timeouts: null,
    };
  }

  const network = Array.isArray(step.network) ? step.network : null;
  return {
    requests: numeric(step.requests),
    resourceTransferBytes: numeric(step.resourceTransferBytes),
    longTaskMs: numeric(step.longTaskMs),
    durationMs: numeric(step.durationMs),
    status0: network ? network.filter((item) => item?.status === 0).length : null,
    networkErrors: network
      ? network.filter(
          (item) => item?.error !== null && item?.error !== undefined && String(item.error) !== '',
        ).length
      : null,
    timeouts: network
      ? network.filter((item) => String(item?.error || '').toLowerCase().includes('timeout')).length
      : null,
  };
}

function extract(data) {
  return {
    cold: scenarioSummary(data, 'cold'),
    warm: scenarioSummary(data, 'warm'),
    navigation: scenarioSummary(data, 'navigation'),
    rop05: stepMetrics(data, STEP_LABELS.rop05),
    control: stepMetrics(data, STEP_LABELS.control),
    actualizar: stepMetrics(data, STEP_LABELS.actualizar),
  };
}

const pairs = [];
for (const pair of PAIRS) {
  const pairDir = path.join(root, `pair-${pair}`);
  const validFile = path.join(pairDir, 'pair-valid.txt');
  const valid = exists(validFile) && readText(validFile).trim() === 'true';
  const entry = { pair, valid, baseline: null, candidate: null };

  for (const side of SIDES) {
    const filePath = path.join(pairDir, side, 'production-browser-performance.json');
    if (valid && exists(filePath)) {
      try {
        entry[side] = extract(readJson(filePath));
      } catch (error) {
        entry[side] = { parseError: String(error?.message || error) };
      }
    }
  }
  pairs.push(entry);
}

const validPairs = pairs.filter((pair) => pair.valid).map((pair) => pair.pair);
const metrics = {};

for (const [key, label] of metricDefs) {
  const byPair = {};
  const baselineValues = [];
  const candidateValues = [];

  for (const pair of pairs) {
    const baseline =
      pair.valid && pair.baseline && !pair.baseline.parseError ? getPath(pair.baseline, key) : null;
    const candidate =
      pair.valid && pair.candidate && !pair.candidate.parseError ? getPath(pair.candidate, key) : null;

    byPair[pair.pair] = { baseline: baseline ?? null, candidate: candidate ?? null };
    if (typeof baseline === 'number' && Number.isFinite(baseline)) baselineValues.push(baseline);
    if (typeof candidate === 'number' && Number.isFinite(candidate)) candidateValues.push(candidate);
  }

  const medianBaseline = median(baselineValues);
  const medianCandidate = median(candidateValues);
  const delta =
    medianBaseline !== null && medianCandidate !== null ? medianCandidate - medianBaseline : null;
  const deltaPercent =
    delta !== null && medianBaseline !== 0 ? (delta / medianBaseline) * 100 : null;

  metrics[key] = {
    label,
    pairs: byPair,
    medianBaseline: round(medianBaseline),
    medianCandidate: round(medianCandidate),
    delta: round(delta),
    deltaPercent: round(deltaPercent),
  };
}

const summary = {
  generatedAt: new Date().toISOString(),
  root,
  validPairs,
  validPairCount: validPairs.length,
  conclusion: validPairs.length < 3 ? 'INCONCLUSIVE' : 'READY_FOR_REVIEW',
  pairs,
  metrics,
};

fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(path.join(root, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

const csvHeader = [
  'metric',
  'B1',
  'C1',
  'B2',
  'C2',
  'B3',
  'C3',
  'B4',
  'C4',
  'B5',
  'C5',
  'medianBaseline',
  'medianCandidate',
  'delta',
  'deltaPercent',
];
const csvRows = [csvHeader.join(',')];
for (const [key] of metricDefs) {
  const metric = metrics[key];
  const row = [metric.label];
  for (const pair of PAIRS) row.push(metric.pairs[pair].baseline, metric.pairs[pair].candidate);
  row.push(
    metric.medianBaseline,
    metric.medianCandidate,
    metric.delta,
    metric.deltaPercent,
  );
  csvRows.push(row.map(csvCell).join(','));
}
fs.writeFileSync(path.join(root, 'summary.csv'), `${csvRows.join('\n')}\n`);

const markdown = [];
markdown.push('# Phase 1C A/B');
markdown.push('');
markdown.push(`Valid pairs: ${validPairs.length}/5`);
markdown.push(`Conclusion: ${summary.conclusion}`);
markdown.push('');
markdown.push(
  '| Métrica | B1 | C1 | B2 | C2 | B3 | C3 | B4 | C4 | B5 | C5 | Mediana B | Mediana C | Δ | % |',
);
markdown.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const [key] of metricDefs) {
  const metric = metrics[key];
  const row = [metric.label];
  for (const pair of PAIRS) {
    row.push(markdownCell(metric.pairs[pair].baseline), markdownCell(metric.pairs[pair].candidate));
  }
  row.push(
    markdownCell(metric.medianBaseline),
    markdownCell(metric.medianCandidate),
    markdownCell(metric.delta),
    markdownCell(metric.deltaPercent),
  );
  markdown.push(`| ${row.join(' | ')} |`);
}
markdown.push('');
fs.writeFileSync(path.join(root, 'medians.md'), markdown.join('\n'));

console.log(
  JSON.stringify(
    {
      validPairs,
      conclusion: summary.conclusion,
      outputs: ['summary.json', 'summary.csv', 'medians.md'],
    },
    null,
    2,
  ),
);
