import { getTheme } from "./theme.svelte";

export const COLOR_OPTIONS = [
  { key: "accent", label: "Theme accent", fallback: "--accent" },
  { key: "keyword", label: "Keywords", fallback: "--syntax-keyword" },
  { key: "string", label: "Strings", fallback: "--syntax-string" },
  { key: "literal", label: "Numbers & literals", fallback: "--syntax-literal" },
  { key: "comment", label: "Comments", fallback: "--syntax-comment" },
  { key: "type", label: "Types", fallback: "--syntax-type" },
  { key: "function", label: "Functions & headings", fallback: "--syntax-function" },
  { key: "operator", label: "Operators & punctuation", fallback: "--syntax-operator" },
  { key: "identifier", label: "Names & identifiers", fallback: "--syntax-identifier" },
  { key: "special", label: "Parameters & invalid syntax", fallback: "--syntax-special" },
] as const;
export type ColorKey = (typeof COLOR_OPTIONS)[number]["key"];
const STORAGE_KEY = "sql-repl-palette";
const isHex = (value: unknown): value is string =>
  typeof value === "string" && /^#[\da-f]{6}$/i.test(value);

function readColors(): Partial<Record<ColorKey, string>> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return Object.fromEntries(
      COLOR_OPTIONS.filter(({ key }) => isHex(saved?.[key])).map(({ key }) => [key, saved[key]])
    );
  } catch {
    return {};
  }
}
let colors = $state<Partial<Record<ColorKey, string>>>(readColors());
const variable = (key: ColorKey) => (key === "accent" ? "--accent" : `--syntax-${key}`);

function applyColors() {
  const style = document.documentElement.style;
  for (const { key } of COLOR_OPTIONS) {
    const value = colors[key];
    if (value) style.setProperty(variable(key), value);
    else style.removeProperty(variable(key));
  }
  const accent = colors.accent;
  for (const [key, value] of Object.entries({
    "--accent-soft": accent ? `color-mix(in srgb, ${accent}, transparent 86%)` : "",
    "--accent-ring": accent ? `color-mix(in srgb, ${accent}, transparent 50%)` : "",
    "--accent-fg": accent ? accentForeground(accent) : "",
  })) {
    if (value) style.setProperty(key, value);
    else style.removeProperty(key);
  }
}

function accentForeground(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#0a0a0a" : "#ffffff";
}

export function paletteColor(key: ColorKey): string {
  void getTheme(); // Resolve defaults again when light/dark mode changes.
  if (colors[key]) return colors[key]!;
  const option = COLOR_OPTIONS.find((item) => item.key === key)!;
  return getComputedStyle(document.documentElement).getPropertyValue(option.fallback).trim();
}

export function setPaletteColor(key: ColorKey, value: string): void {
  if (!isHex(value)) return;
  colors = { ...colors, [key]: value };
  applyColors();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  } catch {
    /* Keep the session palette when storage is unavailable. */
  }
}

export function resetPalette(): void {
  colors = {};
  applyColors();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Session reset still applies. */
  }
}

applyColors();
