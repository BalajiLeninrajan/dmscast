# dmscast

A [DankMaterialShell](https://github.com/AvengeMedia/DankMaterialShell) launcher plugin that answers questions as you type, in the style of Raycast's calculator. Enter copies the answer and Shift+Enter pastes it.

| Type | Get |
|---|---|
| `1920 * 0.85`, `2pi`, `1,000,000 / 4`, `5!` | `1632` |

Results show up alongside app search with no prefix. Type `=` first to see only calculator results.

## Setup

Link or clone this repo into the plugins directory, then enable **dmscast** under Settings → Plugins:

```sh
git clone https://github.com/BalajiLeninrajan/dmscast ~/.config/DankMaterialShell/plugins/dmscast
```

## Where answers come from

- Arithmetic and percentages are parsed in `src/`. Nothing calls `eval`. Numbers are 64-bit floats shown to 10 significant digits.

## Development

`Dmscast.qml` is the plugin: it hands queries to `src/answer.mjs` and copies answers. Everything in `src/` is plain JavaScript with no QML, one module per kind of answer:

| Module | Answers |
|---|---|
| `maths.mjs`, `expression.mjs` | arithmetic and percentages |

The same modules run under Node, so the tests do too:

```sh
pnpm test
```
