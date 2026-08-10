import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  applyViewportCssVars,
  getViewportMetrics,
  installViewportTracking,
} from "./keyboard-viewport";

const rootLayoutSource = readFileSync(
  fileURLToPath(new URL("../routes/+layout.svelte", import.meta.url)),
  "utf8",
);
const appCssSource = readFileSync(fileURLToPath(new URL("../app.css", import.meta.url)), "utf8");
const viewportSource = readFileSync(
  fileURLToPath(new URL("./keyboard-viewport.ts", import.meta.url)),
  "utf8",
);

describe("getViewportMetrics", () => {
  it("reports a visual-only keyboard obstruction", () => {
    expect(
      getViewportMetrics({
        innerHeight: 800,
        visualViewport: { height: 500, offsetTop: 0 },
      }),
    ).toEqual({ visibleHeight: 500, visibleTop: 0, keyboardInsetBottom: 300 });
  });

  it("reports no obstruction when the layout viewport resizes", () => {
    expect(
      getViewportMetrics({
        innerHeight: 500,
        visualViewport: { height: 500, offsetTop: 0 },
      }),
    ).toEqual({ visibleHeight: 500, visibleTop: 0, keyboardInsetBottom: 0 });
  });

  it("includes a positive visual viewport offset", () => {
    expect(
      getViewportMetrics({
        innerHeight: 800,
        visualViewport: { height: 500, offsetTop: 100 },
      }),
    ).toEqual({ visibleHeight: 500, visibleTop: 100, keyboardInsetBottom: 200 });
  });

  it("falls back to the layout viewport without Visual Viewport support", () => {
    expect(getViewportMetrics({ innerHeight: 800, visualViewport: null })).toEqual({
      visibleHeight: 800,
      visibleTop: 0,
      keyboardInsetBottom: 0,
    });
  });
});

describe("applyViewportCssVars", () => {
  it("writes the measured values as CSS pixels", () => {
    const style = { setProperty: vi.fn() };

    applyViewportCssVars(style, {
      visibleHeight: 500,
      visibleTop: 100,
      keyboardInsetBottom: 200,
    });

    expect(style.setProperty).toHaveBeenCalledWith("--cso-visible-viewport-height", "500px");
    expect(style.setProperty).toHaveBeenCalledWith("--cso-visible-viewport-top", "100px");
    expect(style.setProperty).toHaveBeenCalledWith("--cso-keyboard-inset-bottom", "200px");
  });
});

describe("installViewportTracking", () => {
  it("is safe to call during SSR", () => {
    expect(() => installViewportTracking()).not.toThrow();
  });

  it("writes initial variables and removes viewport listeners", () => {
    const style = { setProperty: vi.fn() };
    const documentMock = {
      documentElement: { style },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const visualViewport = {
      height: 500,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const windowMock = {
      innerHeight: 800,
      visualViewport,
      requestAnimationFrame: vi.fn(() => 1),
      cancelAnimationFrame: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    vi.stubGlobal("window", windowMock);
    vi.stubGlobal("document", documentMock);

    const cleanup = installViewportTracking();

    expect(style.setProperty).toHaveBeenCalledWith("--cso-keyboard-inset-bottom", "300px");
    cleanup();
    expect(windowMock.removeEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(documentMock.removeEventListener).toHaveBeenCalledWith("focusin", expect.any(Function));
    expect(visualViewport.removeEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(visualViewport.removeEventListener).toHaveBeenCalledWith("scroll", expect.any(Function));
    vi.unstubAllGlobals();
  });

  it("clears the obstruction when the keyboard closes", () => {
    const style = { setProperty: vi.fn() };
    let queuedFrame: ((time: number) => void) | undefined;
    const documentMock = {
      documentElement: { style },
      activeElement: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const visualViewport = {
      height: 500,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const windowMock = {
      innerHeight: 800,
      visualViewport,
      requestAnimationFrame: vi.fn((callback: (time: number) => void) => {
        queuedFrame = callback;
        return 1;
      }),
      cancelAnimationFrame: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    vi.stubGlobal("window", windowMock);
    vi.stubGlobal("document", documentMock);

    const cleanup = installViewportTracking();
    visualViewport.height = 800;
    const resizeHandler = windowMock.addEventListener.mock.calls[0]?.[1] as () => void;
    resizeHandler();
    queuedFrame?.(0);

    expect(style.setProperty).toHaveBeenLastCalledWith("--cso-keyboard-inset-bottom", "0px");
    cleanup();
    vi.unstubAllGlobals();
  });
});

describe("keyboard viewport integration", () => {
  it("installs tracking from the root layout", () => {
    expect(rootLayoutSource).toContain("installViewportTracking");
  });

  it("defines safe defaults and keyboard scroll content styles", () => {
    expect(appCssSource).toContain("--cso-keyboard-inset-bottom");
    expect(appCssSource).toContain("keyboard-scroll-content");
    expect(appCssSource).toContain("scroll-padding-bottom: var(--cso-keyboard-inset-bottom");
    expect(appCssSource).toContain("keyboard-sheet");
  });

  it("reveals focused controls in opted-in scroll surfaces", () => {
    expect(viewportSource).toContain("focusin");
    expect(viewportSource).toContain("keyboard-sheet");
    expect(viewportSource).toContain("keyboard-scroll-content");
    expect(viewportSource).toContain("scrollIntoView");
  });
});
