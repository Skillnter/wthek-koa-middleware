import Koa from "koa";
import request from "supertest";
import { KitHttpError, KitGeneralError } from "http-error-kit";
import {
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  BAD_REQUEST,
} from "http-response-status-code";
import { KitKoaMiddleware } from "../src/index";

describe("KitKoaMiddleware", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("should pass through normal responses when no error is thrown", async () => {
    const app = new Koa();
    app.use(KitKoaMiddleware());
    app.use((ctx) => {
      ctx.status = 200;
      ctx.body = { ok: true };
    });

    const res = await request(app.callback()).get("/");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("should register directly on app when passed as first parameter", async () => {
    const app = new Koa();
    KitKoaMiddleware(app);
    app.use(() => {
      throw new KitHttpError(NOT_FOUND, "Direct app registration");
    });

    const res = await request(app.callback()).get("/");
    expect(res.status).toBe(NOT_FOUND);
    expect(res.body).toMatchObject({
      message: "Direct app registration",
      statusCode: NOT_FOUND,
    });
  });

  it("should handle KitHttpError with status code and serialized JSON payload", async () => {
    const app = new Koa();
    app.use(KitKoaMiddleware());
    app.use(() => {
      throw new KitHttpError(NOT_FOUND, "Resource not found", {
        id: "123",
      });
    });

    const res = await request(app.callback()).get("/");
    expect(res.status).toBe(NOT_FOUND);
    expect(res.body).toMatchObject({
      details: { id: "123" },
      message: "Resource not found",
      statusCode: NOT_FOUND,
    });
  });

  it("should handle KitGeneralError with fallback status and payload", async () => {
    const app = new Koa();
    app.use(KitKoaMiddleware());
    app.use(() => {
      throw new KitGeneralError(INTERNAL_SERVER_ERROR, "General system failure");
    });

    const res = await request(app.callback()).get("/");
    expect(res.status).toBe(INTERNAL_SERVER_ERROR);
    expect(res.body).toMatchObject({
      message: "General system failure",
      statusCode: INTERNAL_SERVER_ERROR,
    });
  });

  it("should log errors using console.error when log option is true", async () => {
    const app = new Koa();
    app.use(KitKoaMiddleware({ log: true }));
    app.use(() => {
      throw new KitHttpError(BAD_REQUEST, "Invalid input");
    });

    const res = await request(app.callback()).get("/");
    expect(res.status).toBe(BAD_REQUEST);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("should call custom log function when log is a function", async () => {
    const customLog = jest.fn();
    const app = new Koa();
    app.use(KitKoaMiddleware({ log: customLog }));
    app.use(() => {
      throw new KitHttpError(BAD_REQUEST, "Invalid parameter");
    });

    const res = await request(app.callback()).get("/");
    expect(res.status).toBe(BAD_REQUEST);
    expect(customLog).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("should return structured 500 JSON when handleUnknownErrors is true", async () => {
    const app = new Koa();
    app.use(KitKoaMiddleware({ handleUnknownErrors: true }));
    app.use(() => {
      throw new Error("Unexpected database crash");
    });

    const res = await request(app.callback()).get("/");
    expect(res.status).toBe(INTERNAL_SERVER_ERROR);
    expect(res.body).toEqual({
      message: "Internal Server Error",
      statusCode: INTERNAL_SERVER_ERROR,
    });
  });

  it("should re-throw unknown errors when handleUnknownErrors is false", async () => {
    const app = new Koa();
    app.silent = true;
    app.use(KitKoaMiddleware({ handleUnknownErrors: false }));
    app.use(() => {
      throw new Error("Unhandled exception");
    });

    const res = await request(app.callback()).get("/");
    expect(res.status).toBe(500);
  });

  it("should emit app error event when emitAppError is true", async () => {
    const app = new Koa();
    app.silent = true;
    const errorHandler = jest.fn();
    app.on("error", errorHandler);

    app.use(
      KitKoaMiddleware({
        emitAppError: true,
        handleUnknownErrors: true,
      }),
    );
    app.use(() => {
      throw new KitHttpError(BAD_REQUEST, "Bad Request with App Event");
    });

    const res = await request(app.callback()).get("/");
    expect(res.status).toBe(BAD_REQUEST);
    expect(errorHandler).toHaveBeenCalledTimes(1);
  });

  it("should handle error when ctx.app or ctx.app.emit is missing gracefully", async () => {
    const middleware = KitKoaMiddleware();
    const mockCtx = {
      app: undefined,
      headerSent: false,
    } as any;
    const mockNext = jest.fn().mockRejectedValue(new KitHttpError(400, "App undefined"));

    await middleware(mockCtx, mockNext);
    expect(mockCtx.status).toBe(400);
  });

  it("should skip handling if ctx.headerSent is true", async () => {
    const app = new Koa();
    app.use(KitKoaMiddleware());
    app.use((ctx) => {
      ctx.status = 200;
      ctx.res.writeHead(200, { "Content-Type": "text/plain" });
      ctx.res.write("partial response");
      throw new KitHttpError(NOT_FOUND, "Not Found After Headers Sent");
    });

    const res = await request(app.callback()).get("/");
    expect(res.text).toContain("partial response");
  });

  it("should fallback to INTERNAL_SERVER_ERROR if getInputs returns undefined or no statusCode", async () => {
    const mockError = new KitHttpError(500, "Missing inputs");
    jest.spyOn(mockError, "getInputs").mockReturnValue(undefined as any);

    const app = new Koa();
    app.use(KitKoaMiddleware());
    app.use(() => {
      throw mockError;
    });

    const res = await request(app.callback()).get("/");
    expect(res.status).toBe(INTERNAL_SERVER_ERROR);
  });

  it("should fallback to error object directly if toJSON is not a function", async () => {
    const mockError = new KitHttpError(403, "Forbidden without toJSON");
    // @ts-expect-error simulate non-function toJSON
    mockError.toJSON = undefined;

    const app = new Koa();
    app.use(KitKoaMiddleware());
    app.use(() => {
      throw mockError;
    });

    const res = await request(app.callback()).get("/");
    expect(res.status).toBe(403);
  });
});
