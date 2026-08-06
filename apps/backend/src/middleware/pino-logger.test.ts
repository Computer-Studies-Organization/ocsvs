import { describe, expect, it, vi } from "vitest";

const { mockPino, mockPinoLogger, mockPretty } = vi.hoisted(() => ({
  mockPino: vi.fn(),
  mockPinoLogger: vi.fn(
    (options: { pino?: unknown }) => async (context: unknown, next: () => Promise<void>) => {
      if (typeof options.pino === "function") options.pino(context);
      return next();
    },
  ),
  mockPretty: vi.fn(),
}));

vi.mock("hono-pino", () => ({
  pinoLogger: mockPinoLogger,
}));

vi.mock("pino", () => ({
  default: mockPino,
}));

vi.mock("pino-pretty", () => ({
  PinoPretty: mockPretty,
}));

import logger from "./pino-logger";

describe("pino logger middleware", () => {
  it("reuses one Pino root and omits request and response headers", async () => {
    mockPino.mockReturnValue({});

    const middleware = logger();
    const context = {
      env: { LOG_LEVEL: "info", NODE_ENV: "production" },
      req: {
        path: "/me",
        method: "GET",
        header: vi.fn(() => ({ cookie: "session_id=secret", authorization: "Bearer secret" })),
      },
      res: {
        status: 200,
        headers: new Headers([["set-cookie", "session_id=secret"]]),
      },
    };
    const next = vi.fn(async () => undefined);

    await middleware(context as never, next);
    await middleware(context as never, next);

    expect(mockPino).toHaveBeenCalledOnce();
    expect(mockPinoLogger).toHaveBeenCalledOnce();

    const options = mockPinoLogger.mock.calls[0][0] as any;
    expect(options.http.onReqBindings).toEqual(expect.any(Function));
    expect(options.http.onResBindings).toEqual(expect.any(Function));
    expect(options.http.onReqBindings(context)).toEqual({
      req: { url: "/me", method: "GET" },
    });
    expect(options.http.onResBindings(context)).toEqual({
      res: { status: 200 },
    });
  });
});
