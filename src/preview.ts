import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import hljs from "highlight.js/lib/common";
import hlLightCss from "highlight.js/styles/github.css?inline";
import hlDarkCss from "highlight.js/styles/github-dark.css?inline";
import "katex/dist/katex.min.css";
import renderMathInElement from "katex/contrib/auto-render";

const hlLight = document.createElement("style");
hlLight.textContent = hlLightCss;
hlLight.dataset.hljsTheme = "light";
const hlDark = document.createElement("style");
hlDark.textContent = hlDarkCss;
hlDark.dataset.hljsTheme = "dark";
document.head.append(hlLight, hlDark);

export function setHljsTheme(dark: boolean): void {
  hlLight.disabled = dark;
  hlDark.disabled = !dark;
}

export function getHljsCss(dark: boolean): string {
  return dark ? hlDarkCss : hlLightCss;
}

// join a relative img src onto the markdown file's directory
function resolveRel(baseFile: string, rel: string): string {
  const sep = baseFile.includes("\\") ? "\\" : "/";
  const baseDir = baseFile.slice(0, Math.max(baseFile.lastIndexOf("\\"), baseFile.lastIndexOf("/")));
  const parts = (baseDir + sep + rel.replace(/\//g, sep)).split(/[\\/]+/);
  const out: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") {
      out.pop();
      continue;
    }
    out.push(p);
  }
  return out.join(sep);
}

function rewriteImages(container: HTMLElement, basePath?: string): void {
  if (!basePath) return;
  container.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (!src || /^(https?:|data:|blob:|asset:)/i.test(src)) return;
    img.src = convertFileSrc(resolveRel(basePath, src));
  });
}

export async function renderPreview(container: HTMLElement, src: string, dark: boolean, basePath?: string): Promise<void> {
  let html: string;
  try {
    html = await invoke<string>("render_markdown", { src });
  } catch {
    return;
  }
  container.innerHTML = html;
  rewriteImages(container, basePath);

  container.querySelectorAll<HTMLElement>("pre code").forEach((code) => {
    if (code.className.includes("language-mermaid")) return;
    try {
      hljs.highlightElement(code);
    } catch {
      // ignore highlight errors
    }
  });

  renderMathInElement(container, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false },
    ],
    throwOnError: false,
  });

  await renderMermaidBlocks(container, dark);
}

async function renderMermaidBlocks(container: HTMLElement, dark: boolean): Promise<void> {
  const blocks = Array.from(container.querySelectorAll<HTMLElement>("code.language-mermaid"));
  if (blocks.length === 0) return;

  for (const code of blocks) {
    const pre = code.closest("pre");
    if (!pre) continue;
    const div = document.createElement("div");
    div.className = "mermaid";
    div.textContent = code.textContent ?? "";
    pre.replaceWith(div);
  }

  try {
    const mermaid = (await import("mermaid")).default;
    mermaid.initialize({ startOnLoad: false, theme: dark ? "dark" : "default" });
    await mermaid.run({ nodes: container.querySelectorAll<HTMLElement>(".mermaid") });
  } catch {
    // keep original text on failure
  }
}
