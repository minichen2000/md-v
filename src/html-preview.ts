import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { t } from "./i18n";
import { fileName } from "./tabs";

// Render a local `.html`/`.htm` link inside md-v, the same way local images get
// an overlay instead of being read as text. The frame is a cross-origin document
// under the asset protocol: it can load its sibling files (css/img/js) but cannot
// reach md-v's Tauri IPC, which Tauri injects into the main frame only.
export function showHtmlPreview(path: string, fragment: string): void {
  document.querySelector<HTMLDialogElement>(".html-preview")?.close();
  const dialog = document.createElement("dialog");
  dialog.className = "html-preview";
  dialog.setAttribute("aria-label", t("htmlPreview"));
  const toolbar = document.createElement("div");
  toolbar.className = "html-toolbar";
  const title = document.createElement("span");
  title.textContent = fileName(path);
  title.title = path;
  const browser = document.createElement("button");
  browser.textContent = t("openInBrowser");
  browser.onclick = () => {
    void invoke("open_in_default_app", { path }).catch(
      (error) => window.alert(`${t("openFailed")}${error}`),
    );
  };
  const close = document.createElement("button");
  close.textContent = t("overlayClose");
  close.autofocus = true;
  close.onclick = () => dialog.close();
  toolbar.append(title, browser, close);
  const frame = document.createElement("iframe");
  frame.className = "html-frame";
  frame.title = fileName(path);
  frame.src = convertFileSrc(path) + (fragment ? `#${encodeURIComponent(fragment)}` : "");
  dialog.append(toolbar, frame);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  document.body.append(dialog);
  dialog.showModal();
}
