export type VisualViewportLike = {
  height: number;
  offsetTop: number;
};

export type ViewportMetrics = {
  visibleHeight: number;
  visibleTop: number;
  keyboardInsetBottom: number;
};

type ViewportInput = {
  innerHeight: number;
  visualViewport?: VisualViewportLike | null;
};

type StyleWriter = Pick<CSSStyleDeclaration, "setProperty">;

const FORM_CONTROL_SELECTOR = "input, select, textarea, [contenteditable]";
const KEYBOARD_SURFACE_SELECTOR = ".keyboard-sheet, .keyboard-scroll-content";

export function getViewportMetrics({
  innerHeight,
  visualViewport,
}: ViewportInput): ViewportMetrics {
  const layoutHeight = Math.max(0, innerHeight);
  const visibleHeight = Math.max(0, visualViewport?.height ?? layoutHeight);
  const visibleTop = Math.max(0, visualViewport?.offsetTop ?? 0);

  return {
    visibleHeight,
    visibleTop,
    keyboardInsetBottom: Math.max(0, layoutHeight - visibleTop - visibleHeight),
  };
}

export function applyViewportCssVars(style: StyleWriter, metrics: ViewportMetrics): void {
  style.setProperty("--cso-visible-viewport-height", `${metrics.visibleHeight}px`);
  style.setProperty("--cso-visible-viewport-top", `${metrics.visibleTop}px`);
  style.setProperty("--cso-keyboard-inset-bottom", `${metrics.keyboardInsetBottom}px`);
}

export function installViewportTracking(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};

  const visualViewport = window.visualViewport;
  let frame: number | undefined;
  let previous: ViewportMetrics | undefined;

  function revealFocusedControl() {
    const active = document.activeElement;
    if (typeof HTMLElement === "undefined") return;
    if (!(active instanceof HTMLElement) || !active.matches(FORM_CONTROL_SELECTOR)) return;
    if (!active.closest(KEYBOARD_SURFACE_SELECTOR)) return;
    active.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function update() {
    const metrics = getViewportMetrics({
      innerHeight: window.innerHeight,
      visualViewport,
    });

    if (
      previous?.visibleHeight === metrics.visibleHeight &&
      previous.visibleTop === metrics.visibleTop &&
      previous.keyboardInsetBottom === metrics.keyboardInsetBottom
    ) {
      revealFocusedControl();
      return;
    }

    previous = metrics;
    applyViewportCssVars(document.documentElement.style, metrics);
    revealFocusedControl();
  }

  function scheduleUpdate() {
    if (frame !== undefined) return;
    frame = window.requestAnimationFrame(() => {
      frame = undefined;
      update();
    });
  }

  update();
  window.addEventListener("resize", scheduleUpdate);
  document.addEventListener("focusin", scheduleUpdate);
  visualViewport?.addEventListener("resize", scheduleUpdate);
  visualViewport?.addEventListener("scroll", scheduleUpdate);

  return () => {
    window.removeEventListener("resize", scheduleUpdate);
    document.removeEventListener("focusin", scheduleUpdate);
    visualViewport?.removeEventListener("resize", scheduleUpdate);
    visualViewport?.removeEventListener("scroll", scheduleUpdate);
    if (frame !== undefined) window.cancelAnimationFrame(frame);
  };
}
