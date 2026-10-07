import assert from "node:assert/strict";
import test from "node:test";
import { resetImageView, zoomImageView, panImageView, resizeImageView, bindImageView } from "../src/image-view.ts";

const initial = { width: 2000, height: 1000, viewportWidth: 800, viewportHeight: 600, scale: 1, x: 0, y: 0 };

test("fill covers the window without enlarging an image smaller than it", () => {
  const filled = resetImageView(initial, "fill");
  assert.equal(filled.scale, 0.6);
  assert.equal(filled.x, -200);
  assert.equal(filled.y, 0);
  const small = resetImageView({ ...initial, width: 200, height: 100 }, "fill");
  assert.equal(small.scale, 1);
  assert.equal(small.x, 300);
  assert.equal(small.y, 250);
});

test("fit shows the whole image, centred, and is the zoom-out bound", () => {
  const fit = resetImageView(initial, "fit");
  assert.equal(fit.scale, 0.4);
  assert.equal(fit.x, 0);
  assert.equal(fit.y, 100);
  const small = resetImageView({ ...initial, width: 200, height: 100 }, "fit");
  assert.equal(small.scale, 1);
  assert.equal(small.x, 300);
  assert.equal(small.y, 250);
  assert.equal(zoomImageView(initial, 0, 400, 300).scale, 0.1);
});

test("zoom holds the image point under the cursor when unconstrained", () => {
  const view = resetImageView(initial, "actual");
  const cursor = { x: 317, y: 228 };
  const zoomed = zoomImageView(view, 1.6, cursor.x, cursor.y);
  assert.ok(Math.abs((cursor.x - view.x) / view.scale - (cursor.x - zoomed.x) / zoomed.scale) < 1e-9);
  assert.ok(Math.abs((cursor.y - view.y) / view.scale - (cursor.y - zoomed.y) / zoomed.scale) < 1e-9);
  const restored = zoomImageView(zoomed, 1, cursor.x, cursor.y);
  assert.ok(Math.abs(restored.x - view.x) < 1e-9);
  assert.ok(Math.abs(restored.y - view.y) < 1e-9);
});

test("zoom has bounds and allows very large images to fit", () => {
  assert.equal(zoomImageView(initial, 1000, 400, 300).scale, 16);
  assert.equal(zoomImageView(initial, 0, 400, 300).scale, 0.1);
  const huge = { ...initial, width: 80000, height: 60000 };
  assert.equal(zoomImageView(huge, 0, 400, 300).scale, 0.01);
});

test("drag reaches both image edges without moving the image out of view", () => {
  const view = resetImageView(initial, "actual");
  const right = panImageView(view, 100000, 100000);
  assert.equal(right.x, 0);
  assert.equal(right.y, 0);
  const left = panImageView(view, -100000, -100000);
  assert.equal(left.x, -1200);
  assert.equal(left.y, -400);
  const fit = panImageView(resetImageView(initial, "fit"), 100, -100);
  assert.equal(fit.x, 0);
  assert.equal(fit.y, 100);
});

test("resize refills fill/fit modes and keeps the centre point in manual mode", () => {
  const filled = resizeImageView(resetImageView(initial, "fill"), 400, 400, "fill");
  assert.equal(filled.scale, 0.4);
  assert.equal(filled.x, -200);
  assert.equal(filled.y, 0);
  const fit = resizeImageView(resetImageView(initial, "fit"), 400, 400, "fit");
  assert.equal(fit.scale, 0.2);
  assert.equal(fit.y, 100);
  const original = resetImageView(initial, "actual");
  const resized = resizeImageView(original, 600, 400, "manual");
  assert.equal((300 - resized.x) / resized.scale, (400 - original.x) / original.scale);
  assert.equal((200 - resized.y) / resized.scale, (300 - original.y) / original.scale);
});

test("wheel and pointer handlers zoom, capture drag, cancel cleanly and detach on close", () => {
  const previousObserver = globalThis.ResizeObserver;
  let disconnected = false;
  globalThis.ResizeObserver = class { observe() {} disconnect() { disconnected = true; } };
  try {
    const classes = new Set();
    const captured = new Set();
    const viewport = Object.assign(new EventTarget(), {
      clientWidth: 800, clientHeight: 600,
      classList: {
        toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
        add: (name) => classes.add(name), remove: (name) => classes.delete(name),
      },
      getBoundingClientRect: () => ({ left: 10, top: 20 }),
      setPointerCapture: (id) => captured.add(id),
      hasPointerCapture: (id) => captured.has(id),
      releasePointerCapture: (id) => captured.delete(id),
    });
    const img = { naturalWidth: 2000, naturalHeight: 1000, style: {} };
    let scale;
    const controls = bindImageView(viewport, img, (value) => { scale = value; });
    const send = (type, values) => {
      const event = Object.assign(new Event(type, { cancelable: true }), values);
      viewport.dispatchEvent(event);
      return event;
    };
    // Opens filled: the overflowing part is reachable by dragging.
    assert.equal(scale, 0.6);
    assert.equal(classes.has("can-pan"), true);
    const event = send("wheel", { deltaY: -120, deltaMode: 0, clientX: 410, clientY: 320 });
    assert.equal(event.defaultPrevented, true);
    assert.ok(scale > 0.6);
    controls.reset("actual");
    assert.equal(scale, 1);
    send("pointerdown", { button: 2, pointerId: 8, clientX: 410, clientY: 320 });
    assert.equal(captured.size, 0);
    send("pointerdown", { button: 0, pointerId: 8, clientX: 410, clientY: 320 });
    assert.equal(captured.has(8), true);
    send("pointermove", { pointerId: 8, clientX: 510, clientY: 370 });
    assert.equal(img.style.transform, "translate(-500px, -150px) scale(1)");
    send("pointercancel", { pointerId: 8 });
    assert.equal(captured.size, 0);
    assert.equal(classes.has("dragging"), false);
    const stopped = img.style.transform;
    send("pointermove", { pointerId: 8, clientX: 610, clientY: 420 });
    assert.equal(img.style.transform, stopped);
    controls.reset("fill");
    assert.equal(scale, 0.6);
    controls.reset("fit");
    assert.equal(scale, 0.4);
    assert.equal(classes.has("can-pan"), false);
    controls.destroy();
    assert.equal(disconnected, true);
    send("wheel", { deltaY: -120, deltaMode: 0, clientX: 410, clientY: 320 });
    assert.equal(scale, 0.4);
  } finally {
    globalThis.ResizeObserver = previousObserver;
  }
});
