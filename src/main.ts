import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open, save } from "@tauri-apps/plugin-dialog";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { t, setLang, getLang } from "./i18n";
import { TabStore, fileName, type Tab } from "./tabs";
import { createEditor } from "./editor";
import { renderPreview, setHljsTheme } from "./preview";
import { createToc, type TocController } from "./toc";
import { addRecent, getRecent, removeRecent, clearRecent } from "./recent";
import { exportHtml, exportPdf } from "./export";
import "./styles.css";

const settings: Settings = loadSettings();
const store = new TabStore();

let editorView: ReturnType<typeof createEditor> | null = null;
let renderTimer: number | null = null;
let tocTimer: number | null = null;
let toc: TocController;

const SESSION_KEY = "md-v-session";

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

function buildLayout(): void {
  const app = $("#app");
  app.innerHTML = `
    <div id="topbar">
      <div id="tabbar"></div>
      <div id="toolbar">
        <button id="btn-open" data-i18n-title="open">📂</button>
        <button id="btn-recent" data-i18n-title="recent">▾</button>
        <button id="btn-save" data-i18n-title="save">💾</button>
        <span class="sep"></span>
        <button id="btn-zoom-out" data-i18n-title="zoomOut">A−</button>
        <button id="btn-zoom-in" data-i18n-title="zoomIn">A+</button>
        <span class="sep"></span>
        <button id="btn-sync" data-i18n-title="syncScroll">🔗</button>
        <button id="btn-toc" data-i18n-title="toc">☰</button>
        <button id="btn-theme" data-i18n-title="toggleTheme">☀</button>
        <button id="btn-lang" data-i18n-title="toggleLang">EN</button>
        <span class="sep"></span>
        <button id="btn-export" data-i18n-title="export">⤓</button>
        <button id="btn-settings" data-i18n-title="settings">⚙</button>
      </div>
    </div>
    <div id="workspace">
      <div id="welcome">
        <h1 data-i18n="welcomeTitle"></h1>
        <ul>
          <li><kbd>Ctrl+O</kbd> <span data-i18n="welcomeOpen"></span></li>
          <li><kbd>Ctrl+T</kbd> <span data-i18n="welcomeNew"></span></li>
          <li><kbd>Ctrl+S</kbd> <span data-i18n="welcomeSave"></span></li>
          <li><kbd>Ctrl+W</kbd> <span data-i18n="welcomeClose"></span></li>
          <li><kbd>Ctrl+</kbd>🖱 <span data-i18n="welcomeZoom"></span></li>
        </ul>
        <p data-i18n="welcomeDrag"></p>
      </div>
      <div id="editor-pane"></div>
      <div id="splitter"></div>
      <div id="preview-pane"></div>
      <aside id="toc"></aside>
    </div>
    <div id="statusbar">
      <span id="status-path"></span>
      <span id="status-stats"></span>
    </div>`;
}

/* ---- dropdown menu ---- */

type MenuEntry = {
  label: string;
  checked?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
} | "sep";

let menuEl: HTMLElement | null = null;

function closeMenu(): void {
  menuEl?.remove();
  menuEl = null;
  window.removeEventListener("mousedown", onMenuOutside, true);
}

function onMenuOutside(e: Event): void {
  if (menuEl && !menuEl.contains(e.target as Node)) closeMenu();
}

function showMenu(anchor: HTMLElement, entries: MenuEntry[]): void {
  closeMenu();
  menuEl = document.createElement("div");
  menuEl.className = "menu";
  for (const entry of entries) {
    if (entry === "sep") {
      const sep = document.createElement("div");
      sep.className = "menu-sep";
      menuEl.appendChild(sep);
      continue;
    }
    const item = document.createElement("div");
    item.className = "menu-item" + (entry.disabled ? " disabled" : "");
    item.textContent = (entry.checked ? "✓ " : "") + entry.label;
    if (entry.title) item.title = entry.title;
    if (!entry.disabled && entry.onClick) {
      item.addEventListener("click", () => {
        closeMenu();
        entry.onClick!();
      });
    }
    menuEl.appendChild(item);
  }
  document.body.appendChild(menuEl);
  const r = anchor.getBoundingClientRect();
  menuEl.style.top = `${r.bottom + 4}px`;
  menuEl.style.left = `${Math.min(r.left, window.innerWidth - menuEl.offsetWidth - 8)}px`;
  window.addEventListener("mousedown", onMenuOutside, true);
}

/* ---- settings / layout ---- */

function refreshTabBar(): void {
  store.renderBar($("#tabbar"));
}

function isDark(): boolean {
  return settings.theme === "dark";
}

function updateTocVisibility(): void {
  const visible = settings.showToc && store.active() !== undefined;
  $("#toc").style.display = visible ? "block" : "none";
  $("#workspace").classList.toggle("toc-open", visible);
}

function applySettings(rerender = true): void {
  document.body.classList.toggle("dark", isDark());
  document.documentElement.style.setProperty("--font-size", `${settings.fontSize}px`);
  $("#workspace").style.gridTemplateColumns = `${settings.splitRatio}% 4px 1fr`;
  setHljsTheme(isDark());
  $("#btn-theme").textContent = isDark() ? "🌙" : "☀";
  $("#btn-lang").textContent = getLang() === "zh-CN" ? "EN" : "中";
  $("#btn-sync").classList.toggle("on", settings.syncScroll);
  $("#btn-toc").classList.toggle("on", settings.showToc);
  updateTocVisibility();
  saveSettings(settings);
  if (rerender) rerenderActive();
}

function showWelcome(show: boolean): void {
  $("#welcome").style.display = show ? "flex" : "none";
  $("#editor-pane").style.display = show ? "none" : "block";
  $("#splitter").style.display = show ? "none" : "block";
  $("#preview-pane").style.display = show ? "none" : "block";
}

function destroyEditor(): void {
  if (editorView) {
    editorView.destroy();
    editorView = null;
  }
}

function mountEditor(tab: Tab): void {
  destroyEditor();
  const pane = $("#editor-pane");
  pane.innerHTML = "";
  editorView = createEditor(pane, tab.doc, isDark(), (doc) => {
    tab.doc = doc;
    if (!tab.dirty) {
      tab.dirty = true;
      refreshTabBar();
    }
    updateStatus();
    schedulePreview(tab);
  });
  editorView.scrollDOM.scrollTop = tab.scrollTop;
}

function schedulePreview(tab: Tab): void {
  if (renderTimer !== null) window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => {
    renderTimer = null;
    if (store.active()?.id === tab.id) void renderActivePreview();
  }, 150);
}

async function renderActivePreview(): Promise<void> {
  const tab = store.active();
  if (!tab) return;
  await renderPreview($("#preview-pane"), tab.doc, isDark());
  toc.rebuild();
}

function scheduleTocUpdate(): void {
  if (tocTimer !== null) return;
  tocTimer = window.setTimeout(() => {
    tocTimer = null;
    toc.updateActive();
  }, 100);
}

function rerenderActive(): void {
  const tab = store.active();
  if (tab) {
    if (editorView) tab.scrollTop = editorView.scrollDOM.scrollTop;
    mountEditor(tab);
    void renderActivePreview();
  }
}

function updateStatus(): void {
  const tab = store.active();
  const pathEl = $("#status-path");
  const statsEl = $("#status-stats");
  if (!tab) {
    pathEl.textContent = t("statusNoFile");
    statsEl.textContent = "";
    return;
  }
  pathEl.textContent = tab.path ?? tab.title;
  pathEl.title = tab.path ?? "";
  const lines = tab.doc === "" ? 0 : tab.doc.split("\n").length;
  statsEl.textContent = `${tab.doc.length} ${t("statusChars")} · ${lines} ${t("statusLines")}`;
}

/* ---- session persistence (restore tabs) ---- */

function persistSession(): void {
  const tabs = store.list().filter((tab) => tab.path);
  const session = {
    paths: tabs.map((tab) => tab.path as string),
    active: store.active()?.path ?? null,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function restoreSession(): Promise<void> {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const session = JSON.parse(raw) as { paths?: string[]; active?: string | null };
    if (!Array.isArray(session.paths) || session.paths.length === 0) return;
    await openFiles(session.paths);
    const target = store.list().find((tab) => tab.path === session.active);
    if (target) activateTab(target.id);
  } catch {
    // corrupted session data; ignore
  }
}

/* ---- tabs ---- */

function activateTab(id: number): void {
  const current = store.active();
  if (current && current.id !== id && editorView) {
    current.scrollTop = editorView.scrollDOM.scrollTop;
  }
  store.setActive(id);
  const tab = store.active();
  refreshTabBar();
  if (tab) {
    showWelcome(false);
    mountEditor(tab);
    void renderActivePreview();
  } else {
    destroyEditor();
    $("#preview-pane").innerHTML = "";
    toc.clear();
    showWelcome(true);
  }
  updateTocVisibility();
  updateStatus();
  persistSession();
}

function newTab(): void {
  const tab = store.add(null, "");
  activateTab(tab.id);
  editorView?.focus();
}

async function openFiles(paths: string[]): Promise<void> {
  for (const path of paths) {
    try {
      const doc = await invoke<string>("read_file", { path });
      const tab = store.add(path, doc);
      addRecent(path);
      activateTab(tab.id);
    } catch (e) {
      if (getRecent().includes(path)) {
        removeRecent(path);
        window.alert(`${t("openFailed")}${e}\n${t("removedFromRecent")}`);
      } else {
        window.alert(`${t("openFailed")}${e}`);
      }
    }
  }
}

async function openDialog(): Promise<void> {
  const result = await open({
    title: t("openDialogTitle"),
    multiple: true,
    filters: [{ name: t("markdownFiles"), extensions: ["md", "markdown", "mdown", "mkd", "txt"] }],
  });
  if (!result) return;
  await openFiles(Array.isArray(result) ? result : [result]);
}

async function saveActive(): Promise<void> {
  const tab = store.active();
  if (!tab) return;
  let path = tab.path;
  if (!path) {
    const picked = await save({
      title: t("saveDialogTitle"),
      defaultPath: `${tab.title}.md`,
      filters: [{ name: t("markdownFiles"), extensions: ["md"] }],
    });
    if (!picked) return;
    path = picked;
  }
  try {
    await invoke("write_file", { path, content: tab.doc });
    tab.path = path;
    tab.title = fileName(path);
    tab.dirty = false;
    addRecent(path);
    refreshTabBar();
    updateStatus();
    persistSession();
  } catch (e) {
    window.alert(`${t("saveFailed")}${e}`);
  }
}

function closeTab(id: number): void {
  const tab = store.list().find((x) => x.id === id);
  if (!tab) return;
  if (tab.dirty && !window.confirm(t("unsavedConfirm"))) return;
  const wasActive = store.active()?.id === id;
  store.remove(id);
  const next = store.active();
  if (wasActive) {
    if (next) activateTab(next.id);
    else {
      destroyEditor();
      $("#preview-pane").innerHTML = "";
      toc.clear();
      refreshTabBar();
      showWelcome(true);
      updateTocVisibility();
      updateStatus();
      persistSession();
    }
  } else {
    refreshTabBar();
    persistSession();
  }
}

function zoom(delta: number): void {
  settings.fontSize = Math.min(28, Math.max(10, settings.fontSize + delta));
  applySettings(false);
}

/* ---- sync scroll ---- */

type Pane = "editor" | "preview";
let scrollSource: Pane | null = null;
let scrollStamp = 0;

function markSource(pane: Pane): void {
  scrollSource = pane;
  scrollStamp = performance.now();
}

function handlePaneScroll(pane: Pane): void {
  if (pane === "preview") scheduleTocUpdate();
  if (!settings.syncScroll) return;
  const now = performance.now();
  if (scrollSource !== pane && now - scrollStamp < 300) return; // follower side: ignore
  markSource(pane);
  if (!editorView) return;
  const editorScroller = editorView.scrollDOM;
  const preview = $("#preview-pane");
  const [from, to] = pane === "editor" ? [editorScroller, preview] : [preview, editorScroller];
  const max = from.scrollHeight - from.clientHeight;
  const ratio = max > 0 ? from.scrollTop / max : 0;
  to.scrollTop = ratio * Math.max(0, to.scrollHeight - to.clientHeight);
}

/* ---- menus / export ---- */

function showRecentMenu(): void {
  const recent = getRecent();
  const entries: MenuEntry[] = recent.length
    ? recent.map((p) => ({ label: fileName(p), title: p, onClick: () => void openFiles([p]) }))
    : [{ label: t("recentEmpty"), disabled: true }];
  entries.push("sep", {
    label: t("clearRecent"),
    disabled: recent.length === 0,
    onClick: () => clearRecent(),
  });
  showMenu($("#btn-recent"), entries);
}

async function doExportHtml(): Promise<void> {
  const tab = store.active();
  if (!tab) return;
  try {
    await exportHtml(tab.title.replace(/\.(md|markdown)$/i, ""), $("#preview-pane"), isDark(), settings.fontSize);
  } catch (e) {
    window.alert(`${t("exportFailed")}${e}`);
  }
}

function showExportMenu(): void {
  showMenu($("#btn-export"), [
    { label: t("exportHtml"), onClick: () => void doExportHtml() },
    { label: t("exportPdf"), onClick: () => exportPdf(isDark()) },
  ]);
}

function showSettingsMenu(): void {
  showMenu($("#btn-settings"), [
    {
      label: t("restoreTabs"),
      checked: settings.restoreTabs,
      onClick: () => {
        settings.restoreTabs = !settings.restoreTabs;
        saveSettings(settings);
      },
    },
  ]);
}

/* ---- events ---- */

function wireEvents(): void {
  store.onSwitch = activateTab;
  store.onClose = closeTab;
  store.onNew = newTab;

  $("#btn-open").addEventListener("click", () => void openDialog());
  $("#btn-recent").addEventListener("click", () => showRecentMenu());
  $("#btn-save").addEventListener("click", () => void saveActive());
  $("#btn-theme").addEventListener("click", () => {
    settings.theme = isDark() ? "light" : "dark";
    applySettings();
  });
  $("#btn-lang").addEventListener("click", () => {
    settings.lang = getLang() === "zh-CN" ? "en" : "zh-CN";
    setLang(settings.lang);
    applySettings();
    refreshTabBar();
    updateStatus();
  });
  $("#btn-zoom-in").addEventListener("click", () => zoom(1));
  $("#btn-zoom-out").addEventListener("click", () => zoom(-1));
  $("#btn-sync").addEventListener("click", () => {
    settings.syncScroll = !settings.syncScroll;
    applySettings(false);
  });
  $("#btn-toc").addEventListener("click", () => {
    settings.showToc = !settings.showToc;
    applySettings(false);
  });
  $("#btn-export").addEventListener("click", () => showExportMenu());
  $("#btn-settings").addEventListener("click", () => showSettingsMenu());

  window.addEventListener("keydown", (e) => {
    if (!e.ctrlKey) return;
    const key = e.key.toLowerCase();
    if (key === "o") {
      e.preventDefault();
      void openDialog();
    } else if (key === "s") {
      e.preventDefault();
      void saveActive();
    } else if (key === "w") {
      e.preventDefault();
      const tab = store.active();
      if (tab) closeTab(tab.id);
    } else if (key === "t") {
      e.preventDefault();
      newTab();
    }
  });

  window.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1 : -1);
    },
    { passive: false },
  );

  void getCurrentWebview()
    .onDragDropEvent((event) => {
      if (event.payload.type === "drop") {
        void openFiles(event.payload.paths);
      }
    })
    .catch(() => {
      // not running inside tauri (e.g. plain browser preview)
    });

  // sync scroll: capture scroll from the CodeMirror scroller (view is recreated per tab)
  const editorPane = $("#editor-pane");
  editorPane.addEventListener(
    "scroll",
    (e) => {
      if ((e.target as HTMLElement).classList?.contains("cm-scroller")) handlePaneScroll("editor");
    },
    true,
  );
  editorPane.addEventListener("mouseenter", () => markSource("editor"));
  const previewPane = $("#preview-pane");
  previewPane.addEventListener("scroll", () => handlePaneScroll("preview"));
  previewPane.addEventListener("mouseenter", () => markSource("preview"));

  const splitter = $("#splitter");
  splitter.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const workspace = $("#workspace");
    const onMove = (ev: MouseEvent) => {
      const rect = workspace.getBoundingClientRect();
      const ratio = ((ev.clientX - rect.left) / rect.width) * 100;
      settings.splitRatio = Math.min(80, Math.max(15, ratio));
      workspace.style.gridTemplateColumns = `${settings.splitRatio}% 4px 1fr`;
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      saveSettings(settings);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
}

async function main(): Promise<void> {
  buildLayout();
  setLang(settings.lang);
  toc = createToc($("#toc"), $("#preview-pane"));
  wireEvents();
  applySettings(false);
  showWelcome(true);
  updateStatus();

  try {
    const pending = await invoke<string | null>("take_pending_file");
    if (pending) {
      await openFiles([pending]);
    } else if (settings.restoreTabs) {
      await restoreSession();
    }
  } catch {
    // ignore when running outside tauri
  }
}

void main();
