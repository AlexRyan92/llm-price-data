/**
 * llm-price-data: hand-verified LLM API prices as code.
 *
 * The data lives in ../data/models.json and ../data/events.json. This
 * module is the typed, tested surface over it: blended costs for a
 * workload shape, rankings, schema validation, and exports.
 */
import { readFileSync } from 'node:fs';

const dataURL = (name) => new URL(`../data/${name}`, import.meta.url);

/** Load the price table. @returns {{ verified: string, models: object[] }} */
export function loadModels() {
  return JSON.parse(readFileSync(dataURL('models.json'), 'utf8'));
}

/** Load the structured event log. */
export function loadEvents() {
  return JSON.parse(readFileSync(dataURL('events.json'), 'utf8'));
}

/**
 * Blended $ per million tokens for a workload with `ratio` input tokens
 * per output token: (ratio * in + out) / (ratio + 1).
 *
 * @param {{ in: number, out: number }} model
 * @param {number} ratio - e.g. 10 for a RAG-shaped 10:1 workload.
 */
export function blended(model, ratio) {
  if (!(ratio > 0)) throw new RangeError(`ratio must be positive, got ${ratio}`);
  return (ratio * model.in + model.out) / (ratio + 1);
}

/**
 * Models ranked cheapest-first by blended cost for a workload shape.
 *
 * @param {object[]} models
 * @param {number} ratio
 * @param {object} [opts]
 * @param {string[]} [opts.providers] - restrict to these providers.
 */
export function rank(models, ratio, { providers } = {}) {
  return models
    .filter((m) => !providers || providers.includes(m.provider))
    .map((m) => ({ ...m, blended: blended(m, ratio) }))
    .sort((a, b) => a.blended - b.blended);
}

/** CSV export of the ranked table. */
export function toCSV(models, ratio) {
  const head = `model,provider,input_usd_per_m,output_usd_per_m,blended_${ratio}to1_usd_per_m,context_tokens`;
  const rows = rank(models, ratio).map((m) =>
    [JSON.stringify(m.name), m.provider, m.in, m.out, m.blended.toFixed(4), m.ctx].join(','),
  );
  return [head, ...rows].join('\n') + '\n';
}

/**
 * Validate the data files' shape. Run in CI so a malformed PR cannot
 * land. Returns a list of problems; empty means valid.
 */
export function validate({ models, events } = {}) {
  const doc = models ?? loadModels();
  const ev = events ?? loadEvents();
  const problems = [];
  if (!doc.verified) problems.push('models.json: missing verified date');
  const ids = new Set();
  for (const m of doc.models ?? []) {
    for (const field of ['id', 'name', 'provider']) {
      if (typeof m[field] !== 'string' || !m[field]) problems.push(`model ${m.id ?? '?'}: bad ${field}`);
    }
    for (const field of ['in', 'out', 'ctx']) {
      if (!(typeof m[field] === 'number' && m[field] > 0)) problems.push(`model ${m.id}: bad ${field}`);
    }
    if (ids.has(m.id)) problems.push(`duplicate model id: ${m.id}`);
    ids.add(m.id);
  }
  let prev = '9999-99-99';
  for (const e of ev.events ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) problems.push(`event: bad date ${e.date}`);
    if (!['verify', 'launch', 'change'].includes(e.type)) problems.push(`event ${e.date}: bad type ${e.type}`);
    if (!Array.isArray(e.models) || !e.models.length) problems.push(`event ${e.date}: empty models`);
    if (e.date > prev) problems.push(`events not newest-first at ${e.date}`);
    prev = e.date;
    for (const id of e.models) {
      if (id !== 'all' && !ids.has(id)) problems.push(`event ${e.date}: unknown model id ${id}`);
    }
  }
  return problems;
}
