// Recomputes the WCAG 2 contrast ratios stated in tokens.css from the file
// itself, so the header comment can be checked rather than trusted.
//
//   node design/contrast.mjs
//
// Prints one row per pair and theme; exits 1 when a text pair falls below
// 4.5:1 or a status dot below 3:1 against the page.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "tokens.css"), "utf8");

function block(selector) {
  const start = source.indexOf(`${selector} {`);
  const end = source.indexOf("\n}", start);
  const vars = {};
  for (const line of source.slice(start, end).split("\n")) {
    const m = line.match(/^\s*(--[a-z0-9-]+):\s*(.+?);/);
    if (m) vars[m[1]] = m[2];
  }
  return vars;
}

function resolve(vars, name, depth = 0) {
  const value = vars[name];
  if (value === undefined) throw new Error(`missing ${name}`);
  const ref = value.match(/^var\((--[a-z0-9-]+)\)$/);
  if (ref) return depth > 8 ? value : resolve(vars, ref[1], depth + 1);
  return value;
}

function oklchToSrgb(L, C, h) {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(1, Math.max(0, v)));
}

function luminance(rgb) {
  return rgb
    .map((c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))
    .map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}

function parse(value) {
  const m = value.match(/oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)/);
  if (!m) throw new Error(`not oklch: ${value}`);
  return oklchToSrgb(Number(m[1]), Number(m[2]), Number(m[3]));
}

function ratio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const TEXT_PAIRS = [
  ["foreground / background", "--foreground", "--background"],
  ["muted-foreground / background", "--muted-foreground", "--background"],
  ["muted-foreground / muted", "--muted-foreground", "--muted"],
  ["accent / background", "--accent", "--background"],
  ["accent-foreground / accent", "--accent-foreground", "--accent"],
  ["destructive / background", "--destructive", "--background"],
  ["code-foreground / code", "--code-foreground", "--code"],
  ...["neutral", "attention", "working", "ready", "failed", "muted"].flatMap((tone) => [
    [`${tone} text / tone bg`, `--tone-${tone}`, `--tone-${tone}-bg`],
    [`${tone} text / background`, `--tone-${tone}`, `--background`],
    [`${tone} text / card`, `--tone-${tone}`, `--card`],
  ]),
];
const DOT_PAIRS = ["neutral", "attention", "working", "ready", "failed"].map((tone) => [
  `${tone} dot / background`,
  `--tone-${tone}-dot`,
  "--background",
]);

let failed = false;
const light = block(":root");
const dark = { ...light, ...block(".dark") };
console.log(`${"pair".padEnd(34)} light   dark`);
for (const [label, a, b, floor] of [...TEXT_PAIRS.map((p) => [...p, 4.5]), ...DOT_PAIRS.map((p) => [...p, 3])]) {
  const values = [light, dark].map((vars) => ratio(parse(resolve(vars, a)), parse(resolve(vars, b))));
  const flag = values.some((v) => v < floor) ? `  BELOW ${String(floor)}` : "";
  if (flag) failed = true;
  console.log(`${label.padEnd(34)} ${values.map((v) => v.toFixed(2).padStart(5)).join("   ")}${flag}`);
}
process.exit(failed ? 1 : 0);
