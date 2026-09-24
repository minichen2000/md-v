import type { Lang } from "./settings";

const dicts: Record<Lang, Record<string, string>> = {
  "zh-CN": {
    untitled: "未命名",
    newTab: "新建 (Ctrl+T)",
    open: "打开 (Ctrl+O)",
    save: "保存 (Ctrl+S)",
    closeTab: "关闭 (Ctrl+W)",
    toggleTheme: "切换浅/暗主题",
    toggleLang: "Switch to English",
    zoomOut: "缩小字号 (Ctrl+滚轮)",
    zoomIn: "放大字号 (Ctrl+滚轮)",
    openDialogTitle: "打开 Markdown 文件",
    saveDialogTitle: "保存 Markdown 文件",
    markdownFiles: "Markdown 文件",
    unsavedConfirm: "当前文件有未保存的修改，确定关闭吗？",
    statusNoFile: "未打开文件",
    statusChars: "字符",
    statusLines: "行",
    welcomeTitle: "md-v — 快速 Markdown 浏览器",
    welcomeOpen: "打开文件",
    welcomeNew: "新建标签页",
    welcomeSave: "保存文件",
    welcomeClose: "关闭标签页",
    welcomeZoom: "调整字号",
    welcomeDrag: "也可以直接把 .md 文件拖进窗口",
    saveFailed: "保存失败：",
    openFailed: "打开失败：",
    fileTooLarge: "文件过大",
  },
  en: {
    untitled: "Untitled",
    newTab: "New tab (Ctrl+T)",
    open: "Open (Ctrl+O)",
    save: "Save (Ctrl+S)",
    closeTab: "Close (Ctrl+W)",
    toggleTheme: "Toggle light/dark theme",
    toggleLang: "切换到中文",
    zoomOut: "Decrease font size (Ctrl+Wheel)",
    zoomIn: "Increase font size (Ctrl+Wheel)",
    openDialogTitle: "Open Markdown file",
    saveDialogTitle: "Save Markdown file",
    markdownFiles: "Markdown files",
    unsavedConfirm: "The file has unsaved changes. Close anyway?",
    statusNoFile: "No file open",
    statusChars: "chars",
    statusLines: "lines",
    welcomeTitle: "md-v — a fast Markdown viewer",
    welcomeOpen: "Open file",
    welcomeNew: "New tab",
    welcomeSave: "Save file",
    welcomeClose: "Close tab",
    welcomeZoom: "Adjust font size",
    welcomeDrag: "You can also drag a .md file into the window",
    saveFailed: "Save failed: ",
    openFailed: "Open failed: ",
    fileTooLarge: "File too large",
  },
};

let current: Lang = "zh-CN";

export function setLang(lang: Lang): void {
  current = lang;
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });
  document.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle!);
  });
}

export function getLang(): Lang {
  return current;
}

export function t(key: string): string {
  return dicts[current][key] ?? key;
}
