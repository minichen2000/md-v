import { convertFileSrc } from "@tauri-apps/api/core";
import { t } from "./i18n";
import { fileName } from "./tabs";

export function isImagePath(path: string): boolean {
  return /\.(png|jpe?g|gif|webp|bmp|svg|ico|avif)$/i.test(path);
}

export function showImagePreview(path: string): void {
  document.querySelector<HTMLDialogElement>(".image-preview")?.close();
  const dialog = document.createElement("dialog");
  dialog.className = "image-preview";
  dialog.setAttribute("aria-label", t("imagePreview"));
  const toolbar = document.createElement("div");
  toolbar.className = "image-toolbar";
  const title = document.createElement("span");
  title.textContent = fileName(path);
  title.title = path;
  const toggle = document.createElement("button");
  toggle.textContent = t("imageOriginal");
  toggle.disabled = true;
  const close = document.createElement("button");
  close.textContent = t("imageClose");
  close.autofocus = true;
  close.onclick = () => dialog.close();
  toolbar.append(title, toggle, close);
  const viewport = document.createElement("div");
  viewport.className = "image-viewport";
  const status = document.createElement("p");
  status.textContent = t("imageLoading");
  status.setAttribute("role", "status");
  const img = document.createElement("img");
  img.alt = fileName(path);
  img.hidden = true;
  img.onload = () => {
    img.hidden = false;
    status.hidden = true;
    toggle.disabled = false;
    title.textContent = `${fileName(path)} · ${img.naturalWidth} × ${img.naturalHeight}`;
  };
  img.onerror = () => {
    status.textContent = t("imageFailed");
    img.hidden = true;
  };
  toggle.onclick = () => {
    const original = viewport.classList.toggle("original");
    toggle.textContent = t(original ? "imageFit" : "imageOriginal");
  };
  img.src = convertFileSrc(path);
  viewport.append(status, img);
  dialog.append(toolbar, viewport);
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
