export type Theme = "light" | "dark";
export type Lang = "zh-CN" | "en";

export interface Settings {
  theme: Theme;
  lang: Lang;
  fontSize: number;
  splitRatio: number;
  syncScroll: boolean;
  showToc: boolean;
  restoreTabs: boolean;
}

const KEY = "md-v-settings";

const defaultLang: Lang = navigator.language.startsWith("zh") ? "zh-CN" : "en";

const DEFAULTS: Settings = {
  theme: "light",
  lang: defaultLang,
  fontSize: 14,
  splitRatio: 35,
  syncScroll: true,
  showToc: false,
  restoreTabs: false,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      theme: parsed.theme === "dark" ? "dark" : "light",
      lang: parsed.lang === "zh-CN" ? "zh-CN" : "en",
      fontSize: clamp(num(parsed.fontSize, DEFAULTS.fontSize), 10, 28),
      splitRatio: clamp(num(parsed.splitRatio, DEFAULTS.splitRatio), 15, 80),
      syncScroll: bool(parsed.syncScroll, DEFAULTS.syncScroll),
      showToc: bool(parsed.showToc, DEFAULTS.showToc),
      restoreTabs: bool(parsed.restoreTabs, DEFAULTS.restoreTabs),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
