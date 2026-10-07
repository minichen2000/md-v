import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { t } from "./i18n";
import { fileName } from "./tabs";

// The asset protocol percent-decodes the whole URL path as one file path, so
// `convertFileSrc` collapses the path into a single encoded segment; a relative
// link inside the served page would then resolve against the protocol root.
// Encode each segment instead, keeping the separators (and a leading empty
// segment for absolute POSIX/UNC paths), so sibling images, stylesheets and
// pages stay reachable. `convertFileSrc(path)` is `<origin>/<encoded path>`.
export function pageAssetUrl(path: string): string {
  const absolute = convertFileSrc(path);
  const base = absolute.slice(0, absolute.indexOf("/", absolute.indexOf("://") + 3));
  const encoded = path.replace(/\\/g, "/").split("/").map(encodeURIComponent).join("/");
  return `${base}/${encoded}`;
}

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
  frame.setAttribute("aria-label", t("htmlPreview"));
  frame.src = pageAssetUrl(path) + (fragment ? `#${encodeURIComponent(fragment)}` : "");
  dialog.append(toolbar, frame);
  // While the page holds focus its key events stay inside the frame, so Escape
  // arrives as a message from the bridge script injected into every frame.
  const onMessage = (event: MessageEvent) => {
    if (event.source === frame.contentWindow && event.data === "md-v:escape") dialog.close();
  };
  window.addEventListener("message", onMessage);
  dialog.addEventListener("close", () => {
    window.removeEventListener("message", onMessage);
    dialog.remove();
  }, { once: true });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  document.body.append(dialog);
  dialog.showModal();
}
