export interface ImageView {
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  scale: number;
  x: number;
  y: number;
}

// `fill` covers the viewport (the point of "fill the window": the left-over
// overflow is reachable by panning), `fit` shows the whole image, `actual` is
// 100% and `manual` keeps whatever the user zoomed/panned to.
export type ViewMode = "fill" | "fit" | "actual" | "manual";

type ResetMode = Exclude<ViewMode, "manual">;

// Whole image visible. Also the lower bound for zooming out.
function fitScale(view: ImageView): number {
  return Math.min(1, view.viewportWidth / view.width, view.viewportHeight / view.height);
}

// Cover the viewport, without enlarging images smaller than it.
function fillScale(view: ImageView): number {
  return Math.min(1, Math.max(view.viewportWidth / view.width, view.viewportHeight / view.height));
}

function targetScale(view: ImageView, mode: ResetMode): number {
  return mode === "actual" ? 1 : mode === "fit" ? fitScale(view) : fillScale(view);
}

function constrain(view: ImageView): ImageView {
  const axis = (offset: number, size: number, available: number) =>
    size <= available ? (available - size) / 2 : Math.max(available - size, Math.min(0, offset));
  return {
    ...view,
    x: axis(view.x, view.width * view.scale, view.viewportWidth),
    y: axis(view.y, view.height * view.scale, view.viewportHeight),
  };
}

export function resetImageView(view: ImageView, mode: ResetMode): ImageView {
  const scale = targetScale(view, mode);
  return constrain({ ...view, scale,
    x: (view.viewportWidth - view.width * scale) / 2,
    y: (view.viewportHeight - view.height * scale) / 2,
  });
}

export function zoomImageView(view: ImageView, scale: number, x: number, y: number): ImageView {
  scale = Math.max(Math.min(0.1, fitScale(view)), Math.min(16, scale));
  const ratio = scale / view.scale;
  return constrain({ ...view, scale, x: x - (x - view.x) * ratio, y: y - (y - view.y) * ratio });
}

export function panImageView(view: ImageView, dx: number, dy: number): ImageView {
  return constrain({ ...view, x: view.x + dx, y: view.y + dy });
}

export function resizeImageView(view: ImageView, width: number, height: number, mode: ViewMode): ImageView {
  const resized = { ...view, viewportWidth: width, viewportHeight: height,
    x: view.x + (width - view.viewportWidth) / 2,
    y: view.y + (height - view.viewportHeight) / 2,
  };
  return mode === "manual" ? constrain(resized) : resetImageView(resized, mode);
}

export function bindImageView(viewport: HTMLElement, img: HTMLImageElement, onScale: (scale: number) => void) {
  let view = resetImageView({ width: img.naturalWidth, height: img.naturalHeight,
    viewportWidth: Math.max(1, viewport.clientWidth), viewportHeight: Math.max(1, viewport.clientHeight),
    scale: 1, x: 0, y: 0,
  }, "fill");
  let mode: ViewMode = "fill";
  let drag: { id: number; x: number; y: number } | null = null;
  const canPan = () => view.width * view.scale > view.viewportWidth || view.height * view.scale > view.viewportHeight;
  const draw = () => {
    img.style.width = `${view.width}px`;
    img.style.height = `${view.height}px`;
    img.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    viewport.classList.toggle("can-pan", canPan());
    onScale(view.scale);
  };
  const endDrag = () => {
    const pointer = drag?.id;
    drag = null;
    viewport.classList.remove("dragging");
    if (pointer !== undefined && viewport.hasPointerCapture(pointer)) viewport.releasePointerCapture(pointer);
  };
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!event.deltaY) return;
    const rect = viewport.getBoundingClientRect();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.viewportHeight : 1;
    const delta = Math.max(-240, Math.min(240, event.deltaY * unit));
    mode = "manual";
    view = zoomImageView(view, view.scale * Math.exp(-delta * 0.002), event.clientX - rect.left, event.clientY - rect.top);
    draw();
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || drag || !canPan()) return;
    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    viewport.classList.add("dragging");
  };
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    view = panImageView(view, event.clientX - drag.x, event.clientY - drag.y);
    drag.x = event.clientX;
    drag.y = event.clientY;
    draw();
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId === drag?.id) endDrag();
  };
  viewport.addEventListener("wheel", wheel, { passive: false });
  viewport.addEventListener("pointerdown", down);
  viewport.addEventListener("pointermove", move);
  for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const) viewport.addEventListener(name, up);
  const observer = new ResizeObserver(() => {
    if (!viewport.clientWidth || !viewport.clientHeight) return;
    view = resizeImageView(view, viewport.clientWidth, viewport.clientHeight, mode);
    draw();
  });
  observer.observe(viewport);
  draw();
  return {
    reset(to: ResetMode) {
      endDrag();
      mode = to;
      view = resetImageView(view, mode);
      draw();
    },
    destroy() {
      endDrag();
      observer.disconnect();
      viewport.removeEventListener("wheel", wheel);
      viewport.removeEventListener("pointerdown", down);
      viewport.removeEventListener("pointermove", move);
      for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const) viewport.removeEventListener(name, up);
    },
  };
}
