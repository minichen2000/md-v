import { t } from "./i18n";

interface HeadingEntry {
  el: HTMLElement;
  item: HTMLElement;
}

export interface TocController {
  rebuild(): void;
  updateActive(): void;
  clear(): void;
}

export function createToc(tocEl: HTMLElement, previewEl: HTMLElement): TocController {
  let headings: HeadingEntry[] = [];

  function rebuild(): void {
    tocEl.innerHTML = "";
    headings = [];
    const found = previewEl.querySelectorAll<HTMLElement>("h1, h2, h3, h4");
    if (found.length === 0) {
      const empty = document.createElement("div");
      empty.className = "toc-empty";
      empty.dataset.i18n = "tocEmpty";
      empty.textContent = t("tocEmpty");
      tocEl.appendChild(empty);
      return;
    }
    const list = document.createElement("div");
    list.className = "toc-list";
    found.forEach((h) => {
      const level = Number(h.tagName[1]) || 1;
      const item = document.createElement("div");
      item.className = "toc-item";
      item.style.paddingLeft = `${(level - 1) * 14 + 8}px`;
      item.textContent = h.textContent ?? "";
      item.title = item.textContent ?? "";
      item.addEventListener("click", () => {
        h.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      list.appendChild(item);
      headings.push({ el: h, item });
    });
    tocEl.appendChild(list);
    updateActive();
  }

  function updateActive(): void {
    if (headings.length === 0) return;
    const base = previewEl.getBoundingClientRect().top;
    let current = -1;
    headings.forEach((h, i) => {
      if (h.el.getBoundingClientRect().top - base <= 60) current = i;
    });
    headings.forEach((h, i) => h.item.classList.toggle("current", i === current));
  }

  function clear(): void {
    tocEl.innerHTML = "";
    headings = [];
  }

  return { rebuild, updateActive, clear };
}
