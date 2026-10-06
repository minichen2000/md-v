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
const { TabStore } = await import("../src/tabs.ts");
const { isImagePath } = await import("../src/images.ts");

test("opening another document leaves the source active until the UI saves its scroll", () => {
  const store = new TabStore();
  const source = store.add("C:\\notes\\README.md", "source");
  store.setActive(source.id);
  const destination = store.add("C:\\notes\\target.md", "target");
  assert.equal(store.active(), source);
  // This is the outgoing UI snapshot; add() used to switch active too early.
  store.active().scrollTop = 820;
  store.active().previewScrollTop = 1470;
  store.setActive(destination.id);
  store.setActive(source.id);
  assert.equal(store.active().scrollTop, 820);
  assert.equal(store.active().previewScrollTop, 1470);
});

test("reopening an existing tab preserves edits and both scroll positions", () => {
  const store = new TabStore();
  const source = store.add("a.md", "edited content");
  source.dirty = true;
  source.scrollTop = 300;
  source.previewScrollTop = 600;
  const target = store.add("b.md", "other");
  store.setActive(target.id);
  assert.equal(store.add("a.md", "disk content"), source);
  assert.equal(store.active(), target);
  assert.equal(source.doc, "edited content");
  assert.equal(source.dirty, true);
  assert.equal(source.scrollTop, 300);
  assert.equal(source.previewScrollTop, 600);
});

test("closing the active tab returns its neighbor for explicit UI activation", () => {
  const store = new TabStore();
  const source = store.add("a.md", "a");
  const target = store.add("b.md", "b");
  store.setActive(target.id);
  assert.equal(store.remove(target.id), source.id);
  assert.equal(store.active(), undefined);
  store.setActive(source.id);
  assert.equal(store.remove(source.id), null);
});

test("local image paths are classified before any UTF-8 file read", () => {
  for (const ext of ["png", "JPG", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif"]) {
    assert.equal(isImagePath(`C:\\记忆\\少年与暖金芦苇.${ext}`), true);
  }
  for (const path of ["a.md", "a.png.md", "image.png/file.txt"]) {
    assert.equal(isImagePath(path), false);
  }
});
