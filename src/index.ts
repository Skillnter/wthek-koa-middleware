import type Koa from "koa";
import type { Context, Middleware, Next } from "koa";
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
 * Internal factory creating the Koa middleware function.
 */
const createMiddleware = (
  options?: IKitKoaMiddlewareOptions,
): Middleware => {
  const {
    log = false,
    handleUnknownErrors = false,
    emitAppError = false,
  } = options ?? {};

  return async (ctx: Context, next: Next): Promise<void> => {
    try {
      await next();
    } catch (error: unknown) {
      if (log) {
        if (typeof log === "function") {
          log(error, ctx);
        } else {
          console.error(error);
        }
      }

      if (emitAppError && ctx.app && typeof ctx.app.emit === "function") {
        ctx.app.emit("error", error, ctx);
      }

      if (ctx.headerSent) {
        return;
      }

      if (error instanceof KitHttpError || error instanceof KitGeneralError) {
        // eslint-disable-next-line
        const statusCode = (error.getInputs()?.statusCode ??
          INTERNAL_SERVER_ERROR) as number;
        const payload =
          typeof error.toJSON === "function" ? error.toJSON() : error;

        ctx.status = statusCode;
        ctx.body = payload;
        return;
      }

      if (handleUnknownErrors) {
        ctx.status = INTERNAL_SERVER_ERROR;
        ctx.body = {
          message: getStatusDescription(INTERNAL_SERVER_ERROR),
          statusCode: INTERNAL_SERVER_ERROR as number,
        };
        return;
      }

      throw error;
    }
  };
};

/**
 * Callable interface for KitKoaMiddleware supporting both direct registration
 * and middleware factory usage.
 */
export interface IKitKoaMiddleware {
  (app: Koa, options?: IKitKoaMiddlewareOptions): void;
  (options?: IKitKoaMiddlewareOptions): Middleware;
}

/**
 * Koa error-handling middleware for applications powered by `http-error-kit`.
 * Supports two usage patterns:
 * 1. Direct registration: `KitKoaMiddleware(app, options)` (like Fastify & Hono)
 * 2. Middleware factory: `app.use(KitKoaMiddleware(options))` (like Express & Koa idioms)
 *
 * In accordance with Koa's onion architecture, this middleware wraps downstream
 * handlers in a `try ... catch` block.
 *
 * When an error is caught:
 * - If it is an instance of `KitHttpError` or `KitGeneralError`, it sets `ctx.status`
 *   to the error's status code and `ctx.body` to the serialized JSON payload.
 * - If it is an unrecognised error and `handleUnknownErrors` is enabled, it sets
 *   `ctx.status = 500` and `ctx.body` to a structured 500 JSON payload.
 * - If `handleUnknownErrors` is disabled, the unrecognised error is re-thrown.
 * - If `ctx.headerSent` is true, the error handling is skipped to avoid writing headers twice.
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
export const KitKoaMiddleware: IKitKoaMiddleware = ((
  appOrOptions?: Koa | IKitKoaMiddlewareOptions,
  options?: IKitKoaMiddlewareOptions,
): Middleware | void => {
  if (appOrOptions && typeof (appOrOptions as Koa).use === "function") {
    (appOrOptions as Koa).use(createMiddleware(options));
    return;
  }

  return createMiddleware(appOrOptions as IKitKoaMiddlewareOptions);
}) as IKitKoaMiddleware;
