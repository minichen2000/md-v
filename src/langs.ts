import type { Extension } from "@codemirror/state";

export type LangId =
  | "markdown"
  | "plaintext"
  | "json"
  | "xml"
  | "yaml"
  | "toml"
  | "ini"
  | "shell"
  | "powershell"
  | "python"
  | "javascript"
  | "html"
  | "css"
  | "sql"
  | "rust"
  | "cpp"
  | "java"
  | "php"
  | "diff"
  | "dockerfile"
  | "lua"
  | "ruby"
  | "perl"
  | "nginx";

const EXT_MAP: Record<string, LangId> = {
  md: "markdown",
  markdown: "markdown",
  mdown: "markdown",
  mkd: "markdown",
  json: "json",
  jsonc: "json",
  xml: "xml",
  xsl: "xml",
  svg: "xml",
  xhtml: "xml",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  ini: "ini",
  conf: "ini",
  cfg: "ini",
  properties: "ini",
  editorconfig: "ini",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ksh: "shell",
  ps1: "powershell",
  psm1: "powershell",
  py: "python",
  pyw: "python",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "javascript",
  tsx: "javascript",
  mts: "javascript",
  cts: "javascript",
  html: "html",
  htm: "html",
  css: "css",
  scss: "css",
  less: "css",
  sql: "sql",
  rs: "rust",
  c: "cpp",
  h: "cpp",
  cc: "cpp",
  cpp: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  java: "java",
  php: "php",
  diff: "diff",
  patch: "diff",
  lua: "lua",
  rb: "ruby",
  pl: "perl",
  nginx: "nginx",
};

const NAME_MAP: Record<string, LangId> = {
  dockerfile: "dockerfile",
  "cmakelists.txt": "plaintext",
  makefile: "plaintext",
};

export function langForPath(path: string | null): LangId {
  if (!path) return "markdown";
  const name = (path.split(/[\\/]/).pop() || "").toLowerCase();
  if (NAME_MAP[name]) return NAME_MAP[name];
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "plaintext";
  const ext = name.slice(dot + 1);
  return EXT_MAP[ext] ?? "plaintext";
}

export function isMarkdownPath(path: string | null): boolean {
  return langForPath(path) === "markdown";
}

export const SUPPORTED_EXTS: readonly string[] = [
  ...Object.keys(EXT_MAP),
  "txt",
  "log",
  "text",
  "csv",
];

const DISPLAY_NAMES: Partial<Record<LangId, string>> = {
  markdown: "Markdown",
  json: "JSON",
  xml: "XML",
  yaml: "YAML",
  toml: "TOML",
  ini: "INI",
  shell: "Shell",
  powershell: "PowerShell",
  python: "Python",
  javascript: "JS/TS",
  html: "HTML",
  css: "CSS",
  sql: "SQL",
  rust: "Rust",
  cpp: "C/C++",
  java: "Java",
  php: "PHP",
  diff: "Diff",
  dockerfile: "Dockerfile",
  lua: "Lua",
  ruby: "Ruby",
  perl: "Perl",
  nginx: "Nginx",
};

export function langDisplayName(id: LangId): string {
  return DISPLAY_NAMES[id] ?? "Text";
}

const cache = new Map<LangId, Promise<Extension>>();

export function loadLanguage(id: LangId): Promise<Extension> {
  let cached = cache.get(id);
  if (!cached) {
    cached = doLoad(id);
    cache.set(id, cached);
  }
  return cached;
}

async function legacy<T>(loader: () => Promise<{ [k: string]: T }>, key: string): Promise<Extension> {
  const [{ StreamLanguage }, mod] = await Promise.all([import("@codemirror/language"), loader()]);
  return StreamLanguage.define(mod[key] as never);
}

function doLoad(id: LangId): Promise<Extension> {
  switch (id) {
    case "markdown":
      return import("@codemirror/lang-markdown").then((m) => m.markdown());
    case "json":
      return import("@codemirror/lang-json").then((m) => m.json());
    case "xml":
      return import("@codemirror/lang-xml").then((m) => m.xml());
    case "yaml":
      return import("@codemirror/lang-yaml").then((m) => m.yaml());
    case "python":
      return import("@codemirror/lang-python").then((m) => m.python());
    case "javascript":
      return import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true, jsx: true }));
    case "html":
      return import("@codemirror/lang-html").then((m) => m.html());
    case "css":
      return import("@codemirror/lang-css").then((m) => m.css());
    case "sql":
      return import("@codemirror/lang-sql").then((m) => m.sql());
    case "rust":
      return import("@codemirror/lang-rust").then((m) => m.rust());
    case "cpp":
      return import("@codemirror/lang-cpp").then((m) => m.cpp());
    case "java":
      return import("@codemirror/lang-java").then((m) => m.java());
    case "php":
      return import("@codemirror/lang-php").then((m) => m.php());
    case "toml":
      return legacy(() => import("@codemirror/legacy-modes/mode/toml"), "toml");
    case "ini":
      return legacy(() => import("@codemirror/legacy-modes/mode/properties"), "properties");
    case "shell":
      return legacy(() => import("@codemirror/legacy-modes/mode/shell"), "shell");
    case "powershell":
      return legacy(() => import("@codemirror/legacy-modes/mode/powershell"), "powerShell");
    case "diff":
      return legacy(() => import("@codemirror/legacy-modes/mode/diff"), "diff");
    case "dockerfile":
      return legacy(() => import("@codemirror/legacy-modes/mode/dockerfile"), "dockerFile");
    case "lua":
      return legacy(() => import("@codemirror/legacy-modes/mode/lua"), "lua");
    case "ruby":
      return legacy(() => import("@codemirror/legacy-modes/mode/ruby"), "ruby");
    case "perl":
      return legacy(() => import("@codemirror/legacy-modes/mode/perl"), "perl");
    case "nginx":
      return legacy(() => import("@codemirror/legacy-modes/mode/nginx"), "nginx");
    default:
      return Promise.resolve([]);
  }
}
