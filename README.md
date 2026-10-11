# llm-price-data

Hand-verified LLM API prices as code. Dated, schema-validated, with a structured change log: the data provider pricing pages refuse to be.

Provider pricing pages have no changelog, no history, and no feed. This repo gives the table all three:

- **`data/models.json`**: USD per million tokens, standard tier, with context windows and long-context surcharge cliffs. Every number read directly from the provider's public page, with the verification date attached.
- **`data/events.json`**: a structured event per price change, model launch, or verification pass. No event, no noise. Zero price changes since tracking began (Sep 3, 2026) is itself recorded data.
- **CI schema validation**, so a malformed PR cannot land.

The same data drives the [hosted price tracker](https://alexryan.tech/tools/llm-price-tracker.html) (sortable, exportable) and its [RSS feed](https://alexryan.tech/prices.xml), which fires only when a price actually moves.

## Use the data directly

```sh
curl -s https://raw.githubusercontent.com/AlexRyan92/llm-price-data/main/data/models.json | jq '.models[] | {id, in, out}'
```

## CLI

```sh
$ npx llm-price-data            # or: llm-prices after npm install -g
verified Oct 7, 2026 | blended at 10:1 input:output

model                        provider     $in/M    $out/M  blended/M
GPT-6 Luna                   OpenAI       $0.1      $0.5      $0.14
Gemini 3.1 Flash-Lite        Google       $0.25     $1.5      $0.36
Claude Haiku 4.5             Anthropic    $1        $5        $1.36
...

$ npx llm-prices --events
2026-10-07  [verify]  Initial publication. All 11 model rates verified...
```

`--ratio 3` for chat-shaped workloads, `--csv` for spreadsheets, `--validate` for CI.

## Library

```js
import { loadModels, blended, rank, validate } from 'llm-price-data';

const { models, verified } = loadModels();
blended(models[0], 10);          // $/M for a 10:1 input:output workload
rank(models, 20, { providers: ['Anthropic'] });
validate();                      // [] when the data files are well-formed
```

Blended cost is `(ratio * in + out) / (ratio + 1)`. Long-context surcharges and cache discounts are deliberately not blended in; they live on the model entries (`longCtx`) for your own math.

## Corrections and updates

If a number here disagrees with a provider's page, the provider's page wins and I owe the fix. PRs welcome with one rule: **link the provider pricing page** you read the number from. Every merged change lands as an event in `events.json`, which is what makes the history trustworthy.

## License

Code MIT, data CC BY 4.0 © [Alexander Ryan](https://alexryan.tech).
