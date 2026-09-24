import { t } from "./i18n";

export interface Tab {
  id: number;
  path: string | null;
  title: string;
  dirty: boolean;
  doc: string;
  scrollTop: number;
}

export function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

export class TabStore {
  private tabs: Tab[] = [];
  private activeId: number | null = null;
  private nextId = 1;

  onSwitch: (id: number) => void = () => {};
  onClose: (id: number) => void = () => {};
  onNew: () => void = () => {};

  list(): Tab[] {
    return this.tabs;
  }

  active(): Tab | undefined {
    return this.tabs.find((tab) => tab.id === this.activeId);
  }

  add(path: string | null, doc: string): Tab {
    const existing = path ? this.tabs.find((tab) => tab.path === path) : undefined;
    if (existing) {
      this.activeId = existing.id;
      return existing;
    }
    const tab: Tab = {
      id: this.nextId++,
      path,
      title: path ? fileName(path) : t("untitled"),
      dirty: false,
      doc,
      scrollTop: 0,
    };
    this.tabs.push(tab);
    this.activeId = tab.id;
    return tab;
  }

  remove(id: number): void {
    const idx = this.tabs.findIndex((tab) => tab.id === id);
    if (idx < 0) return;
    this.tabs.splice(idx, 1);
    if (this.activeId === id) {
      const next = this.tabs[Math.min(idx, this.tabs.length - 1)];
      this.activeId = next ? next.id : null;
    }
  }

  setActive(id: number): void {
    if (this.tabs.some((tab) => tab.id === id)) this.activeId = id;
  }

  renderBar(bar: HTMLElement): void {
    bar.innerHTML = "";
    for (const tab of this.tabs) {
      const el = document.createElement("div");
      el.className = "tab" + (tab.id === this.activeId ? " active" : "");
      el.title = tab.path ?? tab.title;

      const label = document.createElement("span");
      label.className = "tab-label";
      label.textContent = (tab.dirty ? "● " : "") + tab.title;
      el.appendChild(label);

      const close = document.createElement("span");
      close.className = "tab-close";
      close.textContent = "×";
      close.title = t("closeTab");
      close.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onClose(tab.id);
      });
      el.appendChild(close);

      el.addEventListener("click", () => this.onSwitch(tab.id));
      el.addEventListener("auxclick", (e) => {
        if (e.button === 1) this.onClose(tab.id);
      });
      bar.appendChild(el);
    }

    const add = document.createElement("button");
    add.className = "tab-add";
    add.textContent = "+";
    add.title = t("newTab");
    add.dataset.i18nTitle = "newTab";
    add.addEventListener("click", () => this.onNew());
    bar.appendChild(add);
  }
}
