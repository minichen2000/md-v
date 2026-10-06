import assert from "node:assert/strict";
import test from "node:test";
import { bindPreviewLinks, resolvePreviewLink } from "../src/links.ts";

const base = "C:\\data\\gitrepo\\gitee\\my-something\\README.md";
const cases = [
  ["./手机/三星国行-GooglePlay-ChatGPT-Pro-实录.md", base,
    "C:\\data\\gitrepo\\gitee\\my-something\\手机\\三星国行-GooglePlay-ChatGPT-Pro-实录.md", ""],
  ["../notes/./hello%20world.md#%E7%AB%A0%E8%8A%82", base,
    "C:\\data\\gitrepo\\gitee\\notes\\hello world.md", "章节"],
  ["./100%25%23done.md", base, "C:\\data\\gitrepo\\gitee\\my-something\\100%#done.md", ""],
  ["./next.md", "C:\\notes #1\\100%\\README.md", "C:\\notes #1\\100%\\next.md", ""],
  [".\\手机\\记录.md", base, "C:\\data\\gitrepo\\gitee\\my-something\\手机\\记录.md", ""],
  ["D:/notes/a.md", base, "D:\\notes\\a.md", ""],
  ["D:\\notes\\a.md", null, "D:\\notes\\a.md", ""],
  ["file:///C:/notes/%E4%B8%AD%E6%96%87.md#intro", null, "C:\\notes\\中文.md", "intro"],
  ["file://server/share/a.md", base, "\\\\server\\share\\a.md", ""],
  ["./a.md", "\\\\server\\share\\README.md", "\\\\server\\share\\a.md", ""],
  ["../a.md", "/home/user/docs/README.md", "/home/user/a.md", ""],
  ["/tmp/a.md", "/home/user/README.md", "/tmp/a.md", ""],
  ["/notes/a.md", base, "C:\\notes\\a.md", ""],
  ["./a.md?view=1#intro", base, "C:\\data\\gitrepo\\gitee\\my-something\\a.md", "intro"],
];
for (const [href, source, path, fragment] of cases) {
  test(`resolve ${href} from ${source}`, () => {
    assert.deepEqual(resolvePreviewLink(href, source), { kind: "file", path, fragment });
  });
}

test("external links, anchors, unsaved sources and unsupported schemes", () => {
  for (const url of ["https://example.com/a", "mailto:a@example.com"]) {
    assert.deepEqual(resolvePreviewLink(url, base), { kind: "external", url });
  }
  assert.deepEqual(resolvePreviewLink("#%E7%AB%A0%E8%8A%82", base), { kind: "anchor", fragment: "章节" });
  assert.deepEqual(resolvePreviewLink("./a.md", null), { kind: "missing-base" });
  for (const href of ["", "javascript:alert(1)", "data:text/html,hello"]) {
    assert.deepEqual(resolvePreviewLink(href, base), { kind: "ignore" });
  }
});

test("clicks cancel WebView navigation synchronously, even if opening fails", async () => {
  const listeners = {};
  const opened = [];
  const errors = [];
  bindPreviewLinks({ addEventListener: (type, handler) => { listeners[type] = handler; } }, {
    basePath: () => base,
    openFile: async (path) => { opened.push(path); throw new Error("file not found"); },
    openExternal: async () => {},
    missingBase: () => assert.fail("unexpected unsaved document"),
    onError: (error) => errors.push(error.message),
  });
  for (const type of ["click", "auxclick"]) {
    let cancelled = false;
    listeners[type]({
      type, button: type === "auxclick" ? 1 : 0,
      target: { closest: () => ({ getAttribute: () => "./missing.md" }) },
      preventDefault: () => { cancelled = true; },
    });
    assert.equal(cancelled, true);
  }
  await new Promise(setImmediate);
  assert.equal(opened.length, 2);
  assert.deepEqual(errors, ["file not found", "file not found"]);
});
