import type { Context, default as Koa, Middleware, Next } from "koa";
import { KitHttpError, KitGeneralError } from "http-error-kit";
import {
  INTERNAL_SERVER_ERROR,
  getStatusDescription,
} from "http-response-status-code";

/**
 * Configuration options for KitKoaMiddleware.
 */
export interface IKitKoaMiddlewareOptions {
  /**
   * Optional logger callback or boolean flag.
   * When set to `true`, errors are logged via `console.error`.
   * When set to a function, the function receives the error and context
   * for custom logging (e.g. Pino, Winston).
   *
   * @default false
   */
  // eslint-disable-next-line no-unused-vars
  log?: boolean | ((error: unknown, ctx: Context) => void);

  /**
   * If true, catches non-Kit errors and returns a structured 500 JSON response
   * instead of re-throwing them downstream.
   *
   * @default false
   */
  handleUnknownErrors?: boolean;

  /**
   * Optional flag to emit Koa application error events via
   * `ctx.app.emit("error", error, ctx)`. Useful for centralized error monitoring
   * tools (such as Sentry or Datadog) that listen on `app.on("error")`.
   *
   * @default false
   */
  emitAppError?: boolean;
}

/**
 * Helper to log errors according to options.
 */
const logError = (
  error: unknown,
  ctx: Context,
  log?: boolean | ((error: unknown, ctx: Context) => void),
): void => {
  if (!log) {
    return;
  }
  if (typeof log === "function") {
    log(error, ctx);
    return;
  }
  console.error(error);
};

/**
 * Helper to emit application error events if configured.
 */
const emitError = (
  error: unknown,
  ctx: Context,
  emitAppError?: boolean,
): void => {
  if (emitAppError && ctx.app && typeof ctx.app.emit === "function") {
    ctx.app.emit("error", error, ctx);
  }
};

/**
 * Helper to format and assign Kit error payloads to context.
 */
const handleKitError = (
  error: KitHttpError | KitGeneralError,
  ctx: Context,
): void => {
  const inputs = error.getInputs();
  const statusCode = (inputs?.statusCode ?? INTERNAL_SERVER_ERROR) as number;
  const payload = typeof error.toJSON === "function" ? error.toJSON() : error;

  ctx.status = statusCode;
  ctx.body = payload;
};

/**
 * Helper to format structured 500 response for unknown errors.
 */
const handleUnknownError = (ctx: Context): void => {
  ctx.status = INTERNAL_SERVER_ERROR;
  ctx.body = {
    message: getStatusDescription(INTERNAL_SERVER_ERROR),
    statusCode: INTERNAL_SERVER_ERROR as number,
  };
};

/**
 * Koa error-handling middleware for applications powered by `http-error-kit`.
 * Supports two usage patterns:
 * 1. Direct registration: `KitKoaMiddleware(app, options)` (like Fastify & Hono)
 * 2. Middleware factory: `app.use(KitKoaMiddleware(options))` (like Express & Koa idioms)
 *
 * In accordance with Koa's onion architecture, this middleware wraps downstream
 * handlers in a `try ... catch` block.
 *
 * @param {Koa | IKitKoaMiddlewareOptions} [appOrOptions] Koa application instance or options object.
 * @param {IKitKoaMiddlewareOptions} [options] Options when app is passed as first argument.
 * @returns {Middleware} A Koa-compatible middleware function.
 *
 * @example
 * ```typescript
 * import Koa from "koa";
 * import { KitKoaMiddleware } from "@wthek/koa-middleware";
 *
 * const app = new Koa();
 *
 * // Pattern 1: Direct registration (Hono / Fastify style)
 * KitKoaMiddleware(app, { log: true, handleUnknownErrors: true });
 *
 * // Pattern 2: Middleware factory (Express / Koa app.use style)
 * app.use(KitKoaMiddleware({ log: true, handleUnknownErrors: true }));
 * ```
 */
export const KitKoaMiddleware = (
  appOrOptions?: Koa | IKitKoaMiddlewareOptions,
  options?: IKitKoaMiddlewareOptions,
): Middleware => {
  if (appOrOptions && typeof (appOrOptions as Koa).use === "function") {
    const middleware = KitKoaMiddleware(options);
    (appOrOptions as Koa).use(middleware);
    return middleware;
  }

  const {
    log = false,
    handleUnknownErrors = false,
    emitAppError = false,
  } = (appOrOptions as IKitKoaMiddlewareOptions) ?? {};

  return async (ctx: Context, next: Next): Promise<void> => {
    try {
      await next();
    } catch (error: unknown) {
      logError(error, ctx, log);
      emitError(error, ctx, emitAppError);

      if (ctx.headerSent) {
        return;
      }

      if (error instanceof KitHttpError || error instanceof KitGeneralError) {
        handleKitError(error, ctx);
        return;
      }

      if (handleUnknownErrors) {
        handleUnknownError(ctx);
        return;
      }

      throw error;
    }
  };
};
