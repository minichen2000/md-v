export type PreviewLink =
  | { kind: "external"; url: string }
  | { kind: "anchor"; fragment: string }
  | { kind: "file"; path: string; fragment: string }
  | { kind: "missing-base" | "ignore" };

// Local pages render in the in-app overlay instead of the editor: a browser
// document is meant to be displayed, not read as source text.
export function isHtmlPath(path: string): boolean {
  return /\.html?$/i.test(path);
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function fileUrl(path: string): URL {
  const normalized = path.replace(/\\/g, "/");
  const encoded = normalized.split("/").map(encodeURIComponent).join("/")
    .replace(/^([a-z])%3A/i, "$1:");
  if (/^[a-z]:\//i.test(normalized)) return new URL(`file:///${encoded}`);
  return new URL(normalized.startsWith("//") ? `file:${encoded}` : `file://${encoded}`);
}

// Resolve against the document on disk, never the WebView's application URL.
export function resolvePreviewLink(href: string, basePath: string | null): PreviewLink {
  href = href.trim();
  if (!href) return { kind: "ignore" };
  if (/^(https?:|mailto:)/i.test(href)) return { kind: "external", url: href };
  if (href.startsWith("#")) return { kind: "anchor", fragment: decode(href.slice(1)) };

  const windowsPath = /^[a-z]:[\\/]/i.test(href);
  if (!windowsPath && /^[a-z][a-z\d+.-]*:/i.test(href) && !/^file:/i.test(href)) {
    return { kind: "ignore" };
  }
  if (!basePath && !windowsPath && !/^(file:|[\\/])/i.test(href)) {
    return { kind: "missing-base" };
  }
  const target = new URL(
    windowsPath ? `file:///${href.replace(/\\/g, "/")}` : href.replace(/\\/g, "/"),
    basePath ? fileUrl(basePath) : "file:///",
  );
  let path = decode(target.pathname);
  if (target.hostname) path = `//${target.hostname}${path}`;
  else if (/^\/[a-z]:\//i.test(path)) path = path.slice(1);
  if (/^[a-z]:\//i.test(path) || target.hostname) path = path.replace(/\//g, "\\");
  return { kind: "file", path, fragment: decode(target.hash.slice(1)) };
}

export function scrollToFragment(pane: HTMLElement, fragment: string): void {
  if (!fragment) {
    pane.scrollTop = 0;
    return;
  }
  pane.querySelector(`#${CSS.escape(fragment)}`)?.scrollIntoView();
}

export function bindPreviewLinks(pane: HTMLElement, actions: {
  basePath: () => string | null;
  openFile: (path: string, fragment: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  missingBase: () => void;
  onError: (error: unknown) => void;
}): void {
  const handle = (event: MouseEvent) => {
    if (event.type === "auxclick" && event.button !== 1) return;
    const anchor = (event.target as Element | null)?.closest("a[href]");
    if (!anchor) return;
    // Cancel synchronously, including invalid/unsupported links and middle clicks.
    event.preventDefault();
    void (async () => {
      const link = resolvePreviewLink(anchor.getAttribute("href") ?? "", actions.basePath());
      switch (link.kind) {
        case "external": await actions.openExternal(link.url); break;
        case "anchor": scrollToFragment(pane, link.fragment); break;
        case "file": await actions.openFile(link.path, link.fragment); break;
        case "missing-base": actions.missingBase(); break;
      }
    })().catch(actions.onError);
  };
  pane.addEventListener("click", handle);
  pane.addEventListener("auxclick", handle);
}
