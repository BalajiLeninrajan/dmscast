// Each unit converts to its category's base unit by multiplying with its
// factor. Temperatures need an offset, so they get to/from functions instead.
const UNIT_DEFS = [
    // data, base: byte
    ["data", 1, ["b", "B", "byte", "bytes"]],
    ["data", 1e3, ["kB", "KB", "kilobyte", "kilobytes"]],
    ["data", 1e6, ["MB", "megabyte", "megabytes"]],
    ["data", 1e9, ["GB", "gigabyte", "gigabytes"]],
    ["data", 1e12, ["TB", "terabyte", "terabytes"]],
    ["data", 1e15, ["PB", "petabyte", "petabytes"]],
    ["data", 1024, ["KiB", "kibibyte", "kibibytes"]],
    ["data", Math.pow(1024, 2), ["MiB", "mebibyte", "mebibytes"]],
    ["data", Math.pow(1024, 3), ["GiB", "gibibyte", "gibibytes"]],
    ["data", Math.pow(1024, 4), ["TiB", "tebibyte", "tebibytes"]],
    ["data", Math.pow(1024, 5), ["PiB", "pebibyte", "pebibytes"]],
    ["data", 1 / 8, ["bit", "bits"]],
    ["data", 1e3 / 8, ["Kb", "kbit", "kilobit", "kilobits"]],
    ["data", 1e6 / 8, ["Mb", "mbit", "megabit", "megabits"]],
    ["data", 1e9 / 8, ["Gb", "gbit", "gigabit", "gigabits"]],
    ["data", 1e12 / 8, ["Tb", "tbit", "terabit", "terabits"]],
    // length, base: metre
    ["length", 1, ["m", "meter", "meters", "metre", "metres"]],
    ["length", 1e3, ["km", "kilometer", "kilometers", "kilometre", "kilometres"]],
    ["length", 1e-2, ["cm", "centimeter", "centimeters", "centimetre", "centimetres"]],
    ["length", 1e-3, ["mm", "millimeter", "millimeters", "millimetre", "millimetres"]],
    ["length", 1e-6, ["um", "µm", "micrometer", "micrometers", "micron", "microns"]],
    ["length", 1e-9, ["nm", "nanometer", "nanometers"]],
    ["length", 1609.344, ["mi", "mile", "miles"]],
    ["length", 0.9144, ["yd", "yard", "yards"]],
    ["length", 0.3048, ["ft", "foot", "feet", "'"]],
    ["length", 0.0254, ["in", "inch", "inches", "\""]],
    ["length", 1852, ["nmi", "nautical mile", "nautical miles"]],
    ["length", 9.4607304725808e15, ["ly", "light year", "light years", "lightyear", "lightyears"]],
    // mass, base: kilogram
    ["mass", 1, ["kg", "kilogram", "kilograms", "kilo", "kilos"]],
    ["mass", 1e-3, ["g", "gram", "grams"]],
    ["mass", 1e-6, ["mg", "milligram", "milligrams"]],
    ["mass", 1e-9, ["ug", "µg", "microgram", "micrograms"]],
    ["mass", 1e3, ["t", "tonne", "tonnes", "metric ton", "metric tons"]],
    ["mass", 0.45359237, ["lb", "lbs", "pound", "pounds"]],
    ["mass", 0.028349523125, ["oz", "ounce", "ounces"]],
    ["mass", 6.35029318, ["st", "stone", "stones"]],
    // time, base: second
    ["time", 1, ["s", "sec", "secs", "second", "seconds"]],
    ["time", 1e-3, ["ms", "millisecond", "milliseconds"]],
    ["time", 1e-6, ["us", "µs", "microsecond", "microseconds"]],
    ["time", 1e-9, ["ns", "nanosecond", "nanoseconds"]],
    ["time", 60, ["min", "mins", "minute", "minutes"]],
    ["time", 3600, ["h", "hr", "hrs", "hour", "hours"]],
    ["time", 86400, ["d", "day", "days"]],
    ["time", 604800, ["wk", "week", "weeks"]],
    ["time", 2629746, ["month", "months"]],
    ["time", 31556952, ["yr", "yrs", "year", "years"]],
    // volume, base: litre
    ["volume", 1, ["l", "L", "liter", "liters", "litre", "litres"]],
    ["volume", 1e-3, ["ml", "mL", "milliliter", "milliliters", "millilitre", "millilitres"]],
    ["volume", 1e-2, ["cl", "cL", "centiliter", "centiliters"]],
    ["volume", 1e-1, ["dl", "dL", "deciliter", "deciliters"]],
    ["volume", 1e3, ["m3", "m³", "cubic meter", "cubic meters"]],
    ["volume", 1e-3, ["cm3", "cm³", "cc"]],
    ["volume", 3.785411784, ["gal", "gallon", "gallons"]],
    ["volume", 0.946352946, ["qt", "quart", "quarts"]],
    ["volume", 0.473176473, ["pt", "pint", "pints"]],
    ["volume", 0.2365882365, ["cup", "cups"]],
    ["volume", 0.0295735295625, ["floz", "fl oz", "fluid ounce", "fluid ounces"]],
    ["volume", 0.01478676478125, ["tbsp", "tablespoon", "tablespoons"]],
    ["volume", 0.00492892159375, ["tsp", "teaspoon", "teaspoons"]],
    // speed, base: metre per second
    ["speed", 1, ["m/s", "mps"]],
    ["speed", 1 / 3.6, ["km/h", "kmh", "kph", "kmph"]],
    ["speed", 0.44704, ["mph", "mi/h"]],
    ["speed", 0.514444444444, ["kn", "kt", "knot", "knots"]],
    ["speed", 0.3048, ["ft/s", "fps"]],
    // area, base: square metre
    ["area", 1, ["m2", "m²", "sqm", "square meter", "square meters", "square metre", "square metres"]],
    ["area", 1e6, ["km2", "km²", "square kilometer", "square kilometers"]],
    ["area", 1e-4, ["cm2", "cm²"]],
    ["area", 1e4, ["ha", "hectare", "hectares"]],
    ["area", 4046.8564224, ["acre", "acres", "ac"]],
    ["area", 0.09290304, ["ft2", "ft²", "sqft", "square foot", "square feet"]],
    ["area", 2589988.110336, ["mi2", "mi²", "square mile", "square miles"]],
    // energy, base: joule
    ["energy", 1, ["J", "joule", "joules"]],
    ["energy", 1e3, ["kJ", "kilojoule", "kilojoules"]],
    ["energy", 4.184, ["cal", "calorie", "calories"]],
    ["energy", 4184, ["kcal", "Cal", "kilocalorie", "kilocalories"]],
    ["energy", 3600, ["Wh", "watt hour", "watt hours"]],
    ["energy", 3.6e6, ["kWh", "kilowatt hour", "kilowatt hours"]],
    // pressure, base: pascal
    ["pressure", 1, ["Pa", "pascal", "pascals"]],
    ["pressure", 1e3, ["kPa"]],
    ["pressure", 1e5, ["bar"]],
    ["pressure", 6894.757293168, ["psi"]],
    ["pressure", 101325, ["atm"]],
    // frequency, base: hertz
    ["frequency", 1, ["Hz", "hz", "hertz"]],
    ["frequency", 1e3, ["kHz", "khz"]],
    ["frequency", 1e6, ["MHz", "mhz"]],
    ["frequency", 1e9, ["GHz", "ghz"]],
    // angle, base: radian
    ["angle", 1, ["rad", "radian", "radians"]],
    ["angle", Math.PI / 180, ["deg", "degree", "degrees", "°"]],
    ["angle", Math.PI / 200, ["grad", "gon"]]
];

const TEMPERATURES = [
    {
        symbol: "°C",
        names: ["c", "°c", "celsius", "degc"],
        toK: c => c + 273.15,
        fromK: k => k - 273.15
    },
    {
        symbol: "°F",
        names: ["f", "°f", "fahrenheit", "degf"],
        toK: f => (f - 32) * 5 / 9 + 273.15,
        fromK: k => (k - 273.15) * 9 / 5 + 32
    },
    {
        symbol: "K",
        names: ["k", "kelvin", "kelvins"],
        toK: k => k,
        fromK: k => k
    }
];

// Exact spellings first ("Mb" is a megabit, "MB" a megabyte), then a
// case-insensitive fallback so "25 gb to mb" still works.
const UNITS_EXACT = {};
const UNITS_LOWER = {};
for (const [category, factor, names] of UNIT_DEFS) {
    for (const name of names) {
        const unit = {
            category: category,
            factor: factor
        };
        UNITS_EXACT[name] = unit;
        const lower = name.toLowerCase();
        if (!(lower in UNITS_LOWER))
            UNITS_LOWER[lower] = unit;
    }
}

// { category, factor } for a unit name, { category: "temperature", temp }
// for a temperature scale, or null.
export function lookupUnit(raw) {
    const name = raw.trim().replace(/\s+/g, " ");
    const lower = name.toLowerCase();
    for (const t of TEMPERATURES) {
        if (t.names.indexOf(lower) >= 0)
            return {
                category: "temperature",
                temp: t
            };
    }
    return UNITS_EXACT[name] || UNITS_LOWER[lower] || null;
}

export function convertUnit(amount, from, to) {
    if (to.category === "temperature")
        return to.temp.fromK(from.temp.toK(amount));
    return amount * from.factor / to.factor;
}
