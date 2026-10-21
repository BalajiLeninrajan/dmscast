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
| `time in medan`, `time in syd`, `tokyo time` | `2:13 PM WIB` |
| `3pm pst to london`, `9am ist`, `15:00 tokyo to waterloo` | `11:00 PM BST` |

Results show up alongside app search with no prefix. Type `=` first to see only calculator results.

## Setup

Link or clone this repo into the plugins directory, then enable **dmscast** under Settings → Plugins:

```sh
git clone https://github.com/BalajiLeninrajan/dmscast ~/.config/DankMaterialShell/plugins/dmscast
```

DMS lists plugin results below applications, so Enter launches a matching app instead of copying the answer. The plugin asks to be ranked first through a `sectionPriority` field in `plugin.json`, which stock DMS 1.6 ignores. Until DMS reads it, results still show up, just under the apps.

## Where answers come from

- Arithmetic, percentages, units and bases are parsed in `calc.js`. It never calls `eval`. Numbers are 64-bit floats shown to 10 significant digits.
- Currency uses the European Central Bank's daily reference rates from [Frankfurter](https://frankfurter.dev), 30 currencies, refreshed every 6 hours. The last rates are kept for offline use.
- Times come from `date`, so daylight saving follows the system tz database. Place names resolve through `data/places.tsv`: about 62,000 city names and airport codes. When two places share a name, the more populous one wins.

## Rebuilding the place table

`data/places.tsv` is generated from [GeoNames](https://www.geonames.org) `cities15000` (CC BY 4.0) and [OurAirports](https://ourairports.com/data/) (public domain). Airports take the zone of the nearest city in the same country.

```sh
curl -LO https://download.geonames.org/export/dump/cities15000.zip && unzip cities15000.zip
curl -LO https://davidmegginson.github.io/ourairports-data/airports.csv
python3 scripts/build_places.py cities15000.txt airports.csv > data/places.tsv
```

## Limits

- No compound or mixed units (`5 km / 2 h`, `5 ft 3 in`), and no free text (`$20 lunch + $15 taxi`).
- No way to pick between places that share a name: `london` is always London, UK.
