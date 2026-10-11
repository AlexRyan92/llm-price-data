#!/usr/bin/env node
/**
 * llm-prices CLI.
 *
 *   llm-prices                       # ranked table, RAG-shaped 10:1
 *   llm-prices --ratio 3             # chat-shaped
 *   llm-prices --provider Anthropic --provider Google
 *   llm-prices --csv > prices.csv
 *   llm-prices --events              # the change log
 *   llm-prices --validate            # schema check (used by CI)
 */
import { parseArgs } from 'node:util';
import { loadModels, loadEvents, rank, toCSV, validate } from './prices.mjs';

const { values: v } = parseArgs({
  options: {
    ratio: { type: 'string', default: '10' },
    provider: { type: 'string', multiple: true },
    csv: { type: 'boolean', default: false },
    events: { type: 'boolean', default: false },
    validate: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

if (v.help) {
  console.log(`usage: llm-prices [options]

  --ratio      input:output token ratio for blended cost (default: 10)
  --provider   restrict to a provider (repeatable)
  --csv        CSV to stdout
  --events     print the price event log
  --validate   schema-check the data files, exit 1 on problems`);
  process.exit(0);
}

if (v.validate) {
  const problems = validate();
  if (problems.length) {
    for (const p of problems) console.error(`invalid: ${p}`);
    process.exit(1);
  }
  console.log('data valid');
  process.exit(0);
}

if (v.events) {
  const { events } = loadEvents();
  for (const e of events) console.log(`${e.date}  [${e.type}]  ${e.note}`);
  process.exit(0);
}

const doc = loadModels();
const ratio = Number(v.ratio);

if (v.csv) {
  process.stdout.write(toCSV(doc.models, ratio));
  process.exit(0);
}

console.log(`verified ${doc.verified} | blended at ${ratio}:1 input:output\n`);
console.log('model                        provider     $in/M    $out/M  blended/M');
for (const m of rank(doc.models, ratio, { providers: v.provider })) {
  console.log(
    m.name.padEnd(28) + m.provider.padEnd(11) +
    ('$' + m.in).padStart(8) + ('$' + m.out).padStart(10) +
    ('$' + m.blended.toFixed(2)).padStart(11),
  );
}
