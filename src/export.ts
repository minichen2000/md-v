import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { getHljsCss, setHljsTheme } from "./preview";
import { t } from "./i18n";

function collectAppCss(): string {
  let css = "";
  for (const sheet of Array.from(document.styleSheets)) {
    const node = sheet.ownerNode as HTMLElement | null;
    if (node?.dataset?.hljsTheme) continue; // hljs theme is added separately
    try {
      for (const rule of Array.from(sheet.cssRules)) css += rule.cssText + "\n";
    } catch {
      // cross-origin sheets are not readable; skip
    }
  }
  return css;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function fontMime(url: string): string {
  if (url.includes(".woff2")) return "font/woff2";
  if (url.includes(".woff")) return "font/woff";
  return "font/ttf";
}

async function inlineFontUrls(css: string): Promise<string> {
  const urls = new Set<string>();
  for (const m of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
    if (!m[2].startsWith("data:")) urls.add(m[2]);
  }
  for (const url of urls) {
    try {
      const buf = await (await fetch(url)).arrayBuffer();
      css = css.split(url).join(`data:${fontMime(url)};base64,${toBase64(buf)}`);
    } catch {
      // leave the URL as-is if the font cannot be fetched
    }
  }
  return css;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function exportHtml(
  title: string,
  previewEl: HTMLElement,
  dark: boolean,
  fontSize: number,
): Promise<void> {
  const path = await save({
    title: t("exportHtml"),
    defaultPath: `${title}.html`,
    filters: [{ name: t("htmlFiles"), extensions: ["html"] }],
  });
  if (!path) return;

  const css = await inlineFontUrls(collectAppCss() + getHljsCss(dark));
  const html = [
    "<!doctype html>",
    `<html lang="${document.documentElement.lang}">`,
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${css}</style>`,
    `<style>:root{--font-size:${fontSize}px}#preview-pane{max-width:900px;margin:0 auto;overflow:visible}</style>`,
    "</head>",
    `<body class="${dark ? "dark" : ""}">`,
    `<div id="preview-pane">${previewEl.innerHTML}</div>`,
    "</body></html>",
  ].join("\n");

  await invoke("write_file", { path, content: html });
}

export function exportPdf(dark: boolean): void {
  const restore = (): void => {
    setHljsTheme(dark);
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  setHljsTheme(false); // force light code highlighting for print
  window.print();
}
