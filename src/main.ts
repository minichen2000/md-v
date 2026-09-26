import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { listen } from "@tauri-apps/api/event";
import { open, save, ask } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Compartment } from "@codemirror/state";
import { undo, redo } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { t, setLang, getLang } from "./i18n";
import { TabStore, fileName, type Tab } from "./tabs";
import { createEditor } from "./editor";
import { langForPath, loadLanguage, langDisplayName, isMarkdownPath, SUPPORTED_EXTS } from "./langs";
import { renderPreview, setHljsTheme } from "./preview";
import { createToc, type TocController } from "./toc";
import { addRecent, getRecent, removeRecent, clearRecent } from "./recent";
import { exportHtml, exportPdf, exportPdfToc } from "./export";
import { icons } from "./icons";
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
      <div id="toolbar">
        <button id="btn-open" data-i18n-title="open"></button>
        <button id="btn-recent" data-i18n-title="recent"></button>
        <button id="btn-save" data-i18n-title="save"></button>
        <span class="sep"></span>
        <button id="btn-zoom-out" class="text-btn" data-i18n-title="zoomOut">A−</button>
        <button id="btn-zoom-in" class="text-btn" data-i18n-title="zoomIn">A+</button>
        <span class="sep"></span>
        <button id="btn-sync" data-i18n-title="syncScroll"></button>
        <button id="btn-toc" data-i18n-title="toc"></button>
        <button id="btn-editor" data-i18n-title="toggleEditor"></button>
        <button id="btn-theme" data-i18n-title="toggleTheme"></button>
        <button id="btn-lang"></button>
        <span class="sep"></span>
        <button id="btn-export" data-i18n-title="export"></button>
        <button id="btn-settings" data-i18n-title="settings"></button>
      </div>
      <div id="tabbar"></div>
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
      <div id="toc-splitter"></div>
      <aside id="toc"></aside>
      <div id="splitter"></div>
      <div id="preview-pane"></div>
    </div>
    <div id="statusbar">
      <span id="status-path"></span>
      <span id="status-stats"></span>
    </div>`;

  $("#btn-open").innerHTML = icons.open;
  $("#btn-recent").innerHTML = icons.recent;
  $("#btn-save").innerHTML = icons.save;
  $("#btn-sync").innerHTML = icons.sync;
  $("#btn-toc").innerHTML = icons.toc;
  $("#btn-editor").innerHTML = icons.editor;
  $("#btn-lang").innerHTML = icons.lang;
  $("#btn-export").innerHTML = icons.export;
  $("#btn-settings").innerHTML = icons.settings;
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

function openMenu(entries: MenuEntry[]): void {
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
  window.addEventListener("mousedown", onMenuOutside, true);
}

function showMenu(anchor: HTMLElement, entries: MenuEntry[]): void {
  openMenu(entries);
  const r = anchor.getBoundingClientRect();
  menuEl!.style.top = `${r.bottom + 4}px`;
  menuEl!.style.left = `${Math.min(r.left, window.innerWidth - menuEl!.offsetWidth - 8)}px`;
}

function showMenuAt(x: number, y: number, entries: MenuEntry[]): void {
  openMenu(entries);
  menuEl!.style.top = `${Math.min(y, window.innerHeight - menuEl!.offsetHeight - 8)}px`;
  menuEl!.style.left = `${Math.min(x, window.innerWidth - menuEl!.offsetWidth - 8)}px`;
}

/* ---- settings / layout ---- */

function refreshTabBar(): void {
  store.renderBar($("#tabbar"));
}

function isDark(): boolean {
  return settings.theme === "dark";
}

function tocVisible(): boolean {
  return settings.showToc && store.active() !== undefined && !plainMode();
}

function editorVisible(): boolean {
  return settings.showEditor || plainMode();
}

function plainMode(): boolean {
  const tab = store.active();
  return tab !== undefined && !isMarkdownPath(tab.path);
}

function updateLayoutMode(): void {
  const tab = store.active();
  const plain = plainMode();
  if (tab) {
    const editor = editorVisible();
    const tocOn = tocVisible();
    $("#editor-pane").style.display = editor ? "block" : "none";
    $("#toc").style.display = tocOn ? "block" : "none";
    $("#toc-splitter").style.display = !plain && editor && tocOn ? "block" : "none";
    $("#splitter").style.display = !plain && (editor || tocOn) ? "block" : "none";
    $("#preview-pane").style.display = plain ? "none" : "block";
    $("#workspace").style.gridTemplateColumns = plain ? "1fr" : gridColumns();
  } else {
    $("#editor-pane").style.display = "none";
    $("#toc").style.display = "none";
    $("#toc-splitter").style.display = "none";
    $("#splitter").style.display = "none";
    $("#preview-pane").style.display = "none";
    $("#workspace").style.gridTemplateColumns = "1fr";
  }
  for (const id of ["#btn-toc", "#btn-sync", "#btn-export", "#btn-editor"]) {
    const btn = $(id) as HTMLButtonElement;
    btn.disabled = plain;
    btn.title = plain ? t("plainOnly") : t(btn.dataset.i18nTitle!);
  }
}

function gridColumns(): string {
  const editor = editorVisible();
  if (editor && tocVisible()) {
    const r = (settings.splitRatio / 100).toFixed(4);
    return `calc((100% - ${settings.tocWidth + 8}px) * ${r}) 4px ${settings.tocWidth}px 4px 1fr`;
  }
  if (editor) return `${settings.splitRatio}% 4px 1fr`;
  if (tocVisible()) return `${settings.tocWidth}px 4px 1fr`;
  return "1fr";
}

function applySettings(rerender = true): void {
  document.body.classList.toggle("dark", isDark());
  document.documentElement.style.colorScheme = isDark() ? "dark" : "light";
  document.documentElement.style.setProperty("--font-size", `${settings.fontSize}px`);
  setHljsTheme(isDark());
  $("#btn-theme").innerHTML = isDark() ? icons.moon : icons.sun;
  const langBtn = $("#btn-lang");
  langBtn.innerHTML = `${icons.lang}<span class="lbl">${getLang() === "zh-CN" ? "中" : "EN"}</span>`;
  langBtn.title = t("toggleLang");
  $("#btn-sync").classList.toggle("on", settings.syncScroll);
  $("#btn-toc").classList.toggle("on", settings.showToc);
  $("#btn-editor").classList.toggle("on", settings.showEditor);
  updateLayoutMode();
  saveSettings(settings);
  if (rerender) rerenderActive();
}

function showWelcome(show: boolean): void {
  $("#welcome").style.display = show ? "flex" : "none";
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
  const langId = langForPath(tab.path);
  const langComp = new Compartment();
  editorView = createEditor(
    pane,
    tab.doc,
    isDark(),
    (doc) => {
      tab.doc = doc;
      if (!tab.dirty) {
        tab.dirty = true;
        refreshTabBar();
      }
      updateStatus();
      schedulePreview(tab);
    },
    langComp,
    langId === "markdown" ? markdown() : [],
  );
  if (langId !== "markdown") {
    const view = editorView;
    loadLanguage(langId)
      .then((ext) => {
        if (editorView === view) view.dispatch({ effects: langComp.reconfigure(ext) });
      })
      .catch(() => {});
  }
  editorView.scrollDOM.scrollTop = tab.scrollTop;
}

function schedulePreview(tab: Tab): void {
  if (!isMarkdownPath(tab.path)) return;
  if (renderTimer !== null) window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(() => {
    renderTimer = null;
    if (store.active()?.id === tab.id) void renderActivePreview();
  }, 150);
}

async function renderActivePreview(): Promise<void> {
  const tab = store.active();
  if (!tab || !isMarkdownPath(tab.path)) return;
  await renderPreview($("#preview-pane"), tab.doc, isDark(), tab.path ?? undefined);
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
  const langName = langDisplayName(langForPath(tab.path));
  statsEl.textContent = `${tab.doc.length} ${t("statusChars")} · ${lines} ${t("statusLines")} · ${langName}`;
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
    void checkExternal(tab);
  } else {
    destroyEditor();
    $("#preview-pane").innerHTML = "";
    toc.clear();
    showWelcome(true);
  }
  updateLayoutMode();
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
      tab.mtime = await invoke<number>("get_file_mtime", { path }).catch(() => null);
      tab.deleted = false;
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
    filters: [
      { name: t("allSupportedFiles"), extensions: [...SUPPORTED_EXTS] },
      { name: t("markdownFiles"), extensions: ["md", "markdown", "mdown", "mkd", "txt"] },
    ],
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
    tab.deleted = false;
    tab.mtime = await invoke<number>("get_file_mtime", { path }).catch(() => tab.mtime);
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
      updateLayoutMode();
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

/* ---- external file change detection ---- */

let externalChecking = false;

async function reloadTab(tab: Tab, mtime: number | null): Promise<void> {
  try {
    const doc = await invoke<string>("read_file", { path: tab.path });
    tab.doc = doc;
    tab.dirty = false;
    tab.mtime = mtime ?? (await invoke<number>("get_file_mtime", { path: tab.path }).catch(() => tab.mtime));
    refreshTabBar();
    if (store.active()?.id === tab.id) {
      mountEditor(tab);
      void renderActivePreview();
      updateStatus();
    }
  } catch (e) {
    window.alert(`${t("openFailed")}${e}`);
  }
}

async function checkExternal(tab: Tab): Promise<void> {
  if (!tab.path || externalChecking) return;
  externalChecking = true;
  try {
    let mtime: number;
    try {
      mtime = await invoke<number>("get_file_mtime", { path: tab.path });
    } catch {
      if (!tab.deleted) {
        tab.deleted = true;
        window.alert(`${t("fileDeleted")}${tab.path}`);
      }
      return;
    }
    if (tab.deleted) tab.deleted = false; // file is back
    if (tab.mtime === null || mtime === tab.mtime) return;
    const ok = await ask(tab.dirty ? t("fileChangedConflict") : t("fileChangedReload"), {
      title: "md-v",
      kind: "warning",
    });
    if (ok) {
      await reloadTab(tab, mtime);
    } else {
      tab.mtime = mtime; // don't prompt again for this change
    }
  } finally {
    externalChecking = false;
  }
}

/* ---- sync scroll ---- */

type Pane = "editor" | "preview";
let scrollSource: Pane | null = null;
let scrollStamp = 0;
let scrollRaf = 0;

function markSource(pane: Pane): void {
  scrollSource = pane;
  scrollStamp = performance.now();
}

function handlePaneScroll(pane: Pane): void {
  if (pane === "preview") scheduleTocUpdate();
  if (!settings.syncScroll || plainMode()) return;
  const now = performance.now();
  if (scrollSource !== pane && now - scrollStamp < 300) return; // follower side: ignore
  markSource(pane);
  if (!editorView || scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    if (!editorView) return;
    const editorScroller = editorView.scrollDOM;
    const preview = $("#preview-pane");
    const [from, to] = pane === "editor" ? [editorScroller, preview] : [preview, editorScroller];
    const max = from.scrollHeight - from.clientHeight;
    const ratio = max > 0 ? from.scrollTop / max : 0;
    to.scrollTop = ratio * Math.max(0, to.scrollHeight - to.clientHeight);
  });
}

/* ---- menus / export ---- */

function showRecentMenu(): void {
  const recent = getRecent();
  const entries: MenuEntry[] = recent.length
    ? recent.map((p) => ({ label: p, title: p, onClick: () => void openFiles([p]) }))
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

async function doExportPdfToc(): Promise<void> {
  const tab = store.active();
  if (!tab) return;
  try {
    await exportPdfToc(tab.title.replace(/\.(md|markdown)$/i, ""), $("#preview-pane"), isDark(), settings.fontSize);
  } catch (e) {
    window.alert(`${t("exportFailed")}${e}`);
  }
}

function showExportMenu(): void {
  showMenu($("#btn-export"), [
    { label: t("exportHtml"), onClick: () => void doExportHtml() },
    { label: t("exportPdfToc"), onClick: () => void doExportPdfToc() },
    { label: t("exportPdf"), onClick: () => exportPdf(isDark()) },
  ]);
}

/* ---- right-click context menus ---- */

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // clipboard API unavailable; ignore
  }
}

function showPreviewContextMenu(x: number, y: number, pane: HTMLElement): void {
  const selText = window.getSelection()?.toString() ?? "";
  showMenuAt(x, y, [
    {
      label: t("copy"),
      disabled: selText === "",
      onClick: () => void copyText(selText),
    },
    {
      label: t("selectAll"),
      onClick: () => {
        const sel = window.getSelection();
        if (!sel) return;
        const range = document.createRange();
        range.selectNodeContents(pane);
        sel.removeAllRanges();
        sel.addRange(range);
      },
    },
    "sep",
    { label: t("rerender"), onClick: () => void renderActivePreview() },
  ]);
}

function showEditorContextMenu(x: number, y: number): void {
  const view = editorView;
  if (!view) return;
  const sel = view.state.selection.main;
  const selText = view.state.sliceDoc(sel.from, sel.to);
  showMenuAt(x, y, [
    {
      label: t("undo"),
      onClick: () => {
        if (editorView) {
          undo(editorView);
          editorView.focus();
        }
      },
    },
    {
      label: t("redo"),
      onClick: () => {
        if (editorView) {
          redo(editorView);
          editorView.focus();
        }
      },
    },
    "sep",
    {
      label: t("cut"),
      disabled: sel.empty,
      onClick: () => {
        if (!editorView) return;
        void copyText(selText);
        editorView.dispatch({ changes: { from: sel.from, to: sel.to } });
        editorView.focus();
      },
    },
    {
      label: t("copy"),
      disabled: sel.empty,
      onClick: () => void copyText(selText),
    },
    {
      label: t("paste"),
      onClick: () => {
        void (async () => {
          if (!editorView) return;
          try {
            const text = await navigator.clipboard.readText();
            if (text) {
              editorView.dispatch(editorView.state.replaceSelection(text));
              editorView.focus();
            }
          } catch {
            // clipboard API unavailable; ignore
          }
        })();
      },
    },
    "sep",
    {
      label: t("selectAll"),
      onClick: () => {
        if (!editorView) return;
        editorView.dispatch({ selection: { anchor: 0, head: editorView.state.doc.length } });
        editorView.focus();
      },
    },
  ]);
}

function showAbout(): void {
  const overlay = document.createElement("div");
  overlay.id = "about-overlay";
  overlay.innerHTML = `
    <div id="about-dialog">
      <h2>md-v <span class="ver">v${__APP_VERSION__}</span></h2>
      <p>${t("aboutDesc")}</p>
      <p class="license">${t("aboutLicense")}</p>
      <p class="links">
        ${t("aboutRepo")}:
        <a href="https://github.com/minichen2000/md-v" data-url="https://github.com/minichen2000/md-v">GitHub</a>
        ·
        <a href="https://gitee.com/minichen2000/md-v" data-url="https://gitee.com/minichen2000/md-v">Gitee</a>
      </p>
      <button id="about-close">OK</button>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector("#about-close")!.addEventListener("click", close);
  overlay.querySelectorAll<HTMLAnchorElement>("a[data-url]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      void openUrl(a.dataset.url!).catch(() => window.open(a.dataset.url!, "_blank"));
    });
  });
  window.addEventListener("keydown", function onKey(e) {
    if (e.key === "Escape") {
      close();
      window.removeEventListener("keydown", onKey);
    }
  });
}

function showSettingsMenu(): void {
  const entries: MenuEntry[] = [
    {
      label: t("restoreTabs"),
      checked: settings.restoreTabs,
      onClick: () => {
        settings.restoreTabs = !settings.restoreTabs;
        saveSettings(settings);
      },
    },
    "sep",
    { label: t("about"), onClick: () => showAbout() },
  ];
  showMenu($("#btn-settings"), entries);
  // query context menu state and append the entry when running inside tauri
  void (async () => {
    try {
      const registered = await invoke<boolean>("context_menu_registered");
      if (!menuEl) return;
      closeMenu();
      entries.splice(entries.length - 2, 0, {
        label: registered ? t("contextMenuRemove") : t("contextMenuAdd"),
        onClick: () => void toggleContextMenu(registered),
      });
      showMenu($("#btn-settings"), entries);
    } catch {
      // not running inside tauri
    }
  })();
}

async function toggleContextMenu(registered: boolean): Promise<void> {
  try {
    await invoke(registered ? "unregister_context_menu" : "register_context_menu");
    window.alert(t("contextMenuDone"));
  } catch (e) {
    window.alert(`${t("contextMenuFailed")}${e}`);
  }
}

/* ---- events ---- */

function wireEvents(): void {
  store.onSwitch = activateTab;
  store.onClose = closeTab;
  store.onNew = newTab;

  // suppress the WebView2 default context menu; show our own instead
  window.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    const pane = target.closest("#preview-pane, #toc") as HTMLElement | null;
    if (pane) showPreviewContextMenu(e.clientX, e.clientY, pane);
    else if (target.closest("#editor-pane")) showEditorContextMenu(e.clientX, e.clientY);
  });

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
  $("#btn-editor").addEventListener("click", () => {
    settings.showEditor = !settings.showEditor;
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

  window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    const tab = store.active();
    if (tab?.path) void checkExternal(tab);
  }, 3000);

  const splitter = $("#splitter");
  splitter.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const workspace = $("#workspace");
    const onMove = (ev: MouseEvent) => {
      const rect = workspace.getBoundingClientRect();
      if (!editorVisible()) {
        // editor hidden: the splitter sits between TOC and preview, drags TOC width
        settings.tocWidth = Math.min(480, Math.max(120, ev.clientX - rect.left));
      } else {
        const tocW = tocVisible() ? settings.tocWidth + 4 : 0;
        const avail = rect.width - tocW - 4;
        const ratio = ((ev.clientX - rect.left - tocW) / avail) * 100;
        settings.splitRatio = Math.min(80, Math.max(15, ratio));
      }
      workspace.style.gridTemplateColumns = gridColumns();
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      saveSettings(settings);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });

  const tocSplitter = $("#toc-splitter");
  tocSplitter.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const workspace = $("#workspace");
    const onMove = (ev: MouseEvent) => {
      const rect = workspace.getBoundingClientRect();
      const r = settings.splitRatio / 100;
      const w = rect.width - 8 - (ev.clientX - rect.left - 4) / r;
      settings.tocWidth = Math.min(480, Math.max(120, w));
      workspace.style.gridTemplateColumns = gridColumns();
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

  // single-instance: a second launch forwards its file args here
  void listen<string[]>("open-files", (e) => void openFiles(e.payload)).catch(() => {});

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
