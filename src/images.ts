import { convertFileSrc } from "@tauri-apps/api/core";
import { t } from "./i18n";
import { fileName } from "./tabs";
import { bindImageView } from "./image-view";

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
  const scale = document.createElement("output");
  scale.className = "image-scale";
  const fill = document.createElement("button");
  fill.textContent = t("imageFill");
  fill.disabled = true;
  const fit = document.createElement("button");
  fit.textContent = t("imageFit");
  fit.disabled = true;
  const original = document.createElement("button");
  original.textContent = t("imageOriginal");
  original.disabled = true;
  const close = document.createElement("button");
  close.textContent = t("overlayClose");
  close.autofocus = true;
  close.onclick = () => dialog.close();
  toolbar.append(title, scale, fill, fit, original, close);
  const viewport = document.createElement("div");
  viewport.className = "image-viewport";
  viewport.title = t("imageGestures");
  const status = document.createElement("p");
  status.textContent = t("imageLoading");
  status.setAttribute("role", "status");
  const img = document.createElement("img");
  img.alt = fileName(path);
  img.draggable = false;
  img.hidden = true;
  let controls: ReturnType<typeof bindImageView> | undefined;
  img.onload = () => {
    if (!dialog.open) return;
    img.hidden = false;
    status.hidden = true;
    fill.disabled = fit.disabled = original.disabled = false;
    title.textContent = `${fileName(path)} · ${img.naturalWidth} × ${img.naturalHeight}`;
    controls?.destroy();
    controls = bindImageView(viewport, img, (value) => {
      scale.textContent = `${Math.round(value * 1000) / 10}%`;
    });
  };
  img.onerror = () => {
    status.textContent = t("imageFailed");
    img.hidden = true;
  };
  fill.onclick = () => controls?.reset("fill");
  fit.onclick = () => controls?.reset("fit");
  original.onclick = () => controls?.reset("actual");
  viewport.append(status, img);
  dialog.append(toolbar, viewport);
  dialog.addEventListener("close", () => {
    controls?.destroy();
    img.onload = img.onerror = null;
    dialog.remove();
  }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
  img.src = convertFileSrc(path);
}
