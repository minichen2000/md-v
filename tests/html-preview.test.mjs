import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

// Match Vite's extensionless local TypeScript imports in the Node test runner.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("./") && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.endsWith(".ts")) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

// Stand in for Tauri's `convertFileSrc`: `<origin>/<whole path, percent-encoded>`.
let origin = "http://asset.localhost";
globalThis.window = {
  __TAURI_INTERNALS__: {
    convertFileSrc: (path) => `${origin}/${encodeURIComponent(path)}`,
  },
};
const { pageAssetUrl } = await import("../src/html-preview.ts");

// The Rust asset handler percent-decodes everything after the first `/` of the
// URL path and uses it as the file path, so that is what the URL must decode to.
function decodedPath(url) {
  const pathStart = url.indexOf("/", url.indexOf("://") + 3);
  return decodeURIComponent(url.slice(pathStart + 1));
}

test("page URLs keep directory separators so relative links resolve to siblings", () => {
  const cases = [
    ["C:\\data\\gitrepo\\trana\\docs\\showcase\\index.html", "http://asset.localhost",
      "C:/data/gitrepo/trana/docs/showcase/index.html"],
    ["C:\\展示 站\\01-overview.html", "http://asset.localhost", "C:/展示 站/01-overview.html"],
    ["C:\\notes #1\\100%\\README.html", "http://asset.localhost", "C:/notes #1/100%/README.html"],
    ["/home/u/site/index.html", "asset://localhost", "/home/u/site/index.html"],
    ["\\\\server\\share\\a.html", "http://asset.localhost", "//server/share/a.html"],
  ];
  for (const [path, host, expected] of cases) {
    origin = host;
    const url = pageAssetUrl(path);
    assert.equal(decodedPath(url), expected, path);
    assert.ok(url.startsWith(`${host}/`), url);
  }
});

test("relative links resolve against the directory, not the protocol root", () => {
  const url = pageAssetUrl("C:\\site\\index.html");
  const sibling = new URL("01-overview.png", url).toString();
  assert.equal(decodedPath(sibling), "C:/site/01-overview.png");
  const page = new URL("sub/page.html", url).toString();
  assert.equal(decodedPath(page), "C:/site/sub/page.html");
});

test("no segment is collapsed into the origin", () => {
  const url = pageAssetUrl("C:\\site\\index.html");
  assert.equal(url, "http://asset.localhost/C%3A/site/index.html");
  // A single encoded segment (what convertFileSrc returns) would resolve
  // relative links against the root - guard against regressing to that.
  assert.ok(!/%5C/i.test(url) && !/%2F/i.test(url), url);
});
