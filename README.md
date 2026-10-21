# dmscast

A [DankMaterialShell](https://github.com/AvengeMedia/DankMaterialShell) launcher plugin that answers questions as you type, in the style of Raycast's calculator. Enter copies the answer and Shift+Enter pastes it.

| Type | Get |
|---|---|
| `1920 * 0.85`, `2pi`, `1,000,000 / 4`, `5!` | `1632` |
| `15% of 240`, `240 + 15%`, `20 as a % of 80`, `25% off 80` | `36` |
| `25 GB to MB`, `5 miles to km`, `100 f to c`, `5 in to cm` | `25000 MB` |
| `0xff to decimal`, `255 to hex` | `255` |
| `20 usd to cad`, `$20 to cad`, `€5 to £` | `28.10 CAD` |
| `days until october 8`, `days since january 1` | `352 days` |
| `30 days from now`, `2 weeks ago`, `in 3 months` | `Friday, 20 November 2026` |

Results show up alongside app search with no prefix. Type `=` first to see only calculator results.

## Setup

Link or clone this repo into the plugins directory, then enable **dmscast** under Settings → Plugins:

```sh
git clone https://github.com/BalajiLeninrajan/dmscast ~/.config/DankMaterialShell/plugins/dmscast
```

DMS lists plugin results below applications, so Enter launches a matching app instead of copying the answer. The plugin asks to be ranked first through a `sectionPriority` field in `plugin.json`, which stock DMS 1.6 ignores. Until DMS reads it, results still show up, just under the apps.

## Where answers come from

- Arithmetic, percentages, units and bases are parsed in `src/`. Nothing calls `eval`. Numbers are 64-bit floats shown to 10 significant digits.
- Currency uses the European Central Bank's daily reference rates from [Frankfurter](https://frankfurter.dev), 30 currencies, refreshed every 6 hours. The last rates are kept for offline use.

## Development

`Dmscast.qml` is the plugin: it hands queries to `src/answer.mjs`, copies answers and fetches currency rates. Everything in `src/` is plain JavaScript with no QML, one module per kind of answer:

| Module | Answers |
|---|---|
| `maths.mjs`, `expression.mjs` | arithmetic and percentages |
| `conversion.mjs`, `units.mjs`, `currency.mjs` | `X to Y` for units, bases and currencies |
| `dates.mjs`, `calendar.mjs` | days until and since, spans from today |

The same modules run under Node, so the tests do too:

```sh
pnpm test
```

## Limits

- No compound or mixed units (`5 km / 2 h`, `5 ft 3 in`), and no free text (`$20 lunch + $15 taxi`).
