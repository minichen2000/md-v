export type Theme = "light" | "dark";
export type Lang = "zh-CN" | "en";

export interface Settings {
  theme: Theme;
  lang: Lang;
  fontSize: number;
  splitRatio: number;
}

const KEY = "md-v-settings";

const DEFAULTS: Settings = {
  theme: "light",
  lang: "zh-CN",
  fontSize: 14,
  splitRatio: 35,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      theme: parsed.theme === "dark" ? "dark" : "light",
      lang: parsed.lang === "en" ? "en" : "zh-CN",
      fontSize: clamp(num(parsed.fontSize, DEFAULTS.fontSize), 10, 28),
      splitRatio: clamp(num(parsed.splitRatio, DEFAULTS.splitRatio), 15, 80),
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

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
