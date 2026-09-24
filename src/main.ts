import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open, save } from "@tauri-apps/plugin-dialog";
import { loadSettings, saveSettings, type Settings } from "./settings";
import { t, setLang, getLang } from "./i18n";
import { TabStore, fileName, type Tab } from "./tabs";
import { createEditor } from "./editor";
import { renderPreview, setHljsTheme } from "./preview";
import "./styles.css";

const settings: Settings = loadSettings();
const store = new TabStore();

let editorView: ReturnType<typeof createEditor> | null = null;
let renderTimer: number | null = null;

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T;

function buildLayout(): void {
  const app = $("#app");
  app.innerHTML = `
    <div id="topbar">
      <div id="tabbar"></div>
      <div id="toolbar">
        <button id="btn-open" data-i18n-title="open">📂</button>
        <button id="btn-save" data-i18n-title="save">💾</button>
        <span class="sep"></span>
        <button id="btn-zoom-out" data-i18n-title="zoomOut">A−</button>
        <button id="btn-zoom-in" data-i18n-title="zoomIn">A+</button>
        <span class="sep"></span>
        <button id="btn-theme" data-i18n-title="toggleTheme">☀</button>
        <button id="btn-lang" data-i18n-title="toggleLang">EN</button>
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
    </div>
    <div id="statusbar">
      <span id="status-path"></span>
      <span id="status-stats"></span>
    </div>`;
}

function refreshTabBar(): void {
  store.renderBar($("#tabbar"));
}

function isDark(): boolean {
  return settings.theme === "dark";
}

function applySettings(rerender = true): void {
  document.body.classList.toggle("dark", isDark());
  document.documentElement.style.setProperty("--font-size", `${settings.fontSize}px`);
  $("#workspace").style.gridTemplateColumns = `${settings.splitRatio}% 4px 1fr`;
  setHljsTheme(isDark());
  $("#btn-theme").textContent = isDark() ? "🌙" : "☀";
  $("#btn-lang").textContent = getLang() === "zh-CN" ? "EN" : "中";
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
    showWelcome(true);
  }
  updateStatus();
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
      activateTab(tab.id);
    } catch (e) {
      window.alert(`${t("openFailed")}${e}`);
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
    refreshTabBar();
    updateStatus();
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
      refreshTabBar();
      showWelcome(true);
      updateStatus();
    }
  } else {
    refreshTabBar();
  }
}

function zoom(delta: number): void {
  settings.fontSize = Math.min(28, Math.max(10, settings.fontSize + delta));
  applySettings(false);
}

function wireEvents(): void {
  store.onSwitch = activateTab;
  store.onClose = closeTab;
  store.onNew = newTab;

  $("#btn-open").addEventListener("click", () => void openDialog());
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
  wireEvents();
  applySettings(false);
  showWelcome(true);
  updateStatus();

  try {
    const pending = await invoke<string | null>("take_pending_file");
    if (pending) await openFiles([pending]);
  } catch {
    // ignore when running outside tauri
  }
}

void main();
