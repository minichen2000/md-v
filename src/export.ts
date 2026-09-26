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

function imgMime(src: string): string {
  const m = /\.(\w+)(?:[?#]|$)/i.exec(src);
  const ext = (m?.[1] ?? "").toLowerCase();
  switch (ext) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "svg": return "image/svg+xml";
    case "ico": return "image/x-icon";
    case "bmp": return "image/bmp";
    default: return "application/octet-stream";
  }
}

// embed local (asset-protocol) images as data URIs so the exported file is self-contained
async function inlineImages(root: HTMLElement): Promise<void> {
  for (const img of Array.from(root.querySelectorAll("img"))) {
    const src = img.getAttribute("src") ?? "";
    if (!src.startsWith("asset:") && !src.includes("asset.localhost")) continue;
    try {
      const buf = await (await fetch(src)).arrayBuffer();
      img.src = `data:${imgMime(src)};base64,${toBase64(buf)}`;
    } catch {
      // keep the original src if the image cannot be fetched
    }
  }
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
  const body = previewEl.cloneNode(true) as HTMLElement;
  await inlineImages(body);
  const html = [
    "<!doctype html>",
    `<html lang="${document.documentElement.lang}">`,
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${css}</style>`,
    `<style>:root{--font-size:${fontSize}px}html,body{height:auto;overflow:visible}#preview-pane{max-width:900px;margin:0 auto;overflow:visible}</style>`,
    "</head>",
    `<body class="${dark ? "dark" : ""}">`,
    `<div id="preview-pane">${body.innerHTML}</div>`,
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

// Builds a TOC page whose entries link to heading anchors; Chromium's
// print-to-pdf turns them into clickable PDF links. The heading used as
// the cover title is skipped to avoid a redundant first entry.
function buildPdfToc(body: HTMLElement, skip?: Element): string {
  const headings = Array.from(body.querySelectorAll("h1, h2, h3, h4, h5, h6")).filter((h) => h !== skip);
  if (headings.length === 0) return "";
  const items = headings.map((h, i) => {
    if (!h.id) h.id = `pdf-h-${i}`;
    const level = Number(h.tagName[1]);
    return `<div class="toc-l${level}"><a href="#${h.id}">${escapeHtml(h.textContent ?? "")}</a></div>`;
  });
  return `<div class="toc-title">${escapeHtml(t("pdfTocTitle"))}</div>\n<nav id="pdf-toc">\n${items.join("\n")}\n</nav>`;
}

const PDF_LAYOUT_CSS = [
  ":root{--font-size:FONT_SIZEpx}",
  "html,body{height:auto;overflow:visible}",
  "@page{size:A4;margin:18mm}",
  "#preview-pane{max-width:900px;margin:0 auto;overflow:visible}",
  // cover: big document title + TOC, ends with a page break
  "#pdf-cover{page-break-after:always;max-width:900px;margin:0 auto}",
  ".doc-title{font-size:2.4em;font-weight:700;text-align:center;margin:70px 0 10px;line-height:1.3}",
  ".toc-title{font-size:1.35em;font-weight:600;margin:60px 0 14px;padding-bottom:8px;border-bottom:1px solid var(--border)}",
  // TOC entries: blue = obviously clickable, indented per heading level
  "#pdf-toc a{color:var(--accent);text-decoration:none}",
  "#pdf-toc div{padding:3px 0;line-height:1.5}",
  // level rules need the #pdf-toc prefix to beat "#pdf-toc div" specificity
  "#pdf-toc .toc-l1{font-weight:600;font-size:1.08em;margin-top:10px}",
  "#pdf-toc .toc-l2{padding-left:24px}",
  "#pdf-toc .toc-l3{padding-left:48px;font-size:0.93em}",
  "#pdf-toc .toc-l4{padding-left:72px;font-size:0.88em}",
  "#pdf-toc .toc-l5{padding-left:96px;font-size:0.88em}",
  "#pdf-toc .toc-l6{padding-left:120px;font-size:0.88em}",
].join("");

export async function exportPdfToc(
  title: string,
  previewEl: HTMLElement,
  dark: boolean,
  fontSize: number,
): Promise<void> {
  const path = await save({
    title: t("exportPdfToc"),
    defaultPath: `${title}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!path) return;

  // always light code highlighting for PDF output
  const css = await inlineFontUrls(collectAppCss() + getHljsCss(false));
  const body = previewEl.cloneNode(true) as HTMLElement;
  await inlineImages(body);
  // cover title: the document's first h1 if it has one, else the file name
  const firstH1 = body.querySelector("h1");
  const docTitle = firstH1?.textContent?.trim() || title;
  const tocHtml = buildPdfToc(body, firstH1 ?? undefined);
  const titleHtml = `<div class="doc-title">${escapeHtml(docTitle)}</div>`;
  const cover = tocHtml ? `<div id="pdf-cover">\n${titleHtml}\n${tocHtml}\n</div>` : titleHtml;
  const html = [
    "<!doctype html>",
    `<html lang="${document.documentElement.lang}">`,
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${escapeHtml(docTitle)}</title>`,
    `<style>${css}</style>`,
    `<style>${PDF_LAYOUT_CSS.replace("FONT_SIZE", String(fontSize))}</style>`,
    "</head>",
    `<body class="${dark ? "dark" : ""}">`,
    cover,
    `<div id="preview-pane">${body.innerHTML}</div>`,
    "</body></html>",
  ].join("\n");

  await invoke("export_pdf", { html, outputPath: path });
}
