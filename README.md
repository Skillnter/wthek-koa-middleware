# Official @wthek Extension – Koa Middleware for `http-error-kit`

**Seamless Koa Error Handling with @wthek**

_Built for applications powered by [http-error-kit][http-error-kit], this middleware ensures that all `http-error-kit` errors are properly formatted and returned with the correct HTTP status codes in Koa._

> 💡 What the HEK?! Need a hassle-free way to manage error responses for `http-error-kit` errors in Koa? `@wthek/koa-middleware` has got you covered!

![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/skillnter/wthek-koa-middleware/main.yml)
[![npm version](https://img.shields.io/npm/v/%40wthek%2Fkoa-middleware?color=brightgreen)](https://www.npmjs.com/package/@wthek/koa-middleware)
[![GitHub license](https://img.shields.io/github/license/skillnter/wthek-koa-middleware?color=brightgreen)](LICENSE)
[![GitHub Issues](https://img.shields.io/github/issues/Skillnter/wthek-koa-middleware)](https://github.com/Skillnter/wthek-koa-middleware/issues)
![npm](https://img.shields.io/npm/dy/%40wthek%2Fkoa-middleware)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/%40wthek%2Fkoa-middleware)](https://bundlephobia.com/package/%40wthek%2Fkoa-middleware)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/453f3cdfa02749c9b4c506dbbf5e103a)](https://app.codacy.com/gh/Skillnter/wthek-koa-middleware/dashboard)
[![Socket Badge](https://socket.dev/api/badge/npm/package/@wthek/koa-middleware/1.0.0)](https://socket.dev/npm/package/@wthek/koa-middleware/overview/1.0.0)
[![Github Sponsors](https://img.shields.io/badge/GitHub%20Sponsors-30363D?&logo=GitHub-Sponsors&logoColor=EA4AAA)](https://github.com/sponsors/Skillnter)
[![Open Collective](https://img.shields.io/badge/Open%20Collective-3385FF?logo=open-collective&logoColor=white)](https://opencollective.com/skillnter)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/skillnter)
[![Patreon](https://img.shields.io/badge/Patreon-F96854?logo=patreon&logoColor=white)](https://www.patreon.com/skillnter)
[![PayPal](https://img.shields.io/badge/PayPal-003087?logo=paypal&logoColor=fff)](https://www.paypal.me/skillnte)

## Features

- **Official `http-error-kit` Extension** – The idiomatic error-handling middleware for Koa applications.
- **Onion Architecture First** – Wraps downstream middleware in `try ... catch` at the top of your Koa stack.
- **Auto-sets HTTP Status & Body** – Automatically sets `ctx.status` and `ctx.body` from `KitHttpError` or `KitGeneralError`.
- **Streaming & Header Safety** – Automatically avoids double writes if `ctx.headerSent` is true.
- **Configurable Logging** – Support for boolean logging or custom logger callbacks (Pino, Winston).
- **`handleUnknownErrors` Option** – Catch unexpected errors and return structured 500 JSON responses.
- **`emitAppError` Option** – Optionally trigger Koa's application-level `app.emit('error', err, ctx)` for central monitoring.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Options](#options)
- [Custom Formatting with KitHttpErrorConfig](#custom-formatting-with-kithttperrorconfig)
- [Explore More WTHek Extensions](#explore-more-wthek-extensions)
- [People](#people)
- [Donations](#donations)
- [License](#license)

## Installation

```console
npm install @wthek/koa-middleware
```

## Usage

`KitKoaMiddleware` supports both **direct registration** (passing `app` as first argument, like Fastify & Hono) and the **middleware factory pattern** (passing returned middleware into `app.use()`, like Express & standard Koa).

Place it **near or at the very top** of your Koa stack so it wraps all downstream middleware in `try ... catch`.

### Pattern 1: Direct Registration (Recommended)

```typescript
import Koa from "koa";
import { KitKoaMiddleware } from "@wthek/koa-middleware";
import { KitHttpError } from "http-error-kit";
import { NOT_FOUND } from "http-response-status-code";

const app = new Koa();

// 1. Direct registration at the top of the stack
KitKoaMiddleware(app, {
  log: true,
  handleUnknownErrors: true,
  emitAppError: true,
});

// 2. Downstream routes / middleware
app.use(async (ctx) => {
  if (ctx.path === "/user") {
    throw new KitHttpError(NOT_FOUND, "User Not Found", {
      userId: ctx.query.id,
    });
  }
  ctx.body = { message: "Hello Koa" };
});

app.listen(3000);
```

### Pattern 2: Middleware Factory (`app.use`)

```typescript
// Alternatively, pass into app.use() directly:
app.use(
  KitKoaMiddleware({
    log: true,
    handleUnknownErrors: true,
    emitAppError: true,
  }),
);
```

### Custom Logging Example

```typescript
import Koa from "koa";
import { KitKoaMiddleware } from "@wthek/koa-middleware";
import pino from "pino";

const logger = pino();
const app = new Koa();

app.use(
  KitKoaMiddleware({
    log: (error, ctx) => {
      logger.error({ err: error, url: ctx.url, method: ctx.method }, "Request failed");
    },
    handleUnknownErrors: true,
  }),
);
```

## Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `log` | `boolean \| ((error: unknown, ctx: Context) => void)` | `false` | When `true`, logs via `console.error`. When a function is provided, receives `(error, ctx)` for custom logging. |
| `handleUnknownErrors` | `boolean` | `false` | When `true`, unhandled non-Kit errors return a structured 500 JSON response instead of re-throwing. |
| `emitAppError` | `boolean` | `false` | When `true`, emits `ctx.app.emit("error", error, ctx)` so central Koa error listeners can monitor errors. |

## Custom Formatting with `KitHttpErrorConfig`

Customize the output JSON payload across all errors globally:

```typescript
import { KitHttpErrorConfig } from "http-error-kit";

KitHttpErrorConfig.configureFormatter(
  (statusCode, message, details, ...args) => ({
    timestamp: new Date().toISOString(),
    status: statusCode,
    error: message,
    details,
  }),
);
```

## Explore More WTHek Extensions

The WTHek ecosystem continues to grow with new extensions to simplify error handling across various frameworks and libraries. Stay updated with the latest tools that integrate seamlessly with `http-error-kit`.

**Check out the official list of extensions**: [Official Extensions List](https://github.com/Skillnter/http-error-kit/wiki/Official-Extensions-List)

## People

The original author of the project is [Himanshu Bansal][skillnter]

## Donations

**This is all voluntary work**, so if you want to support my efforts you can:

- [Buy Me A Coffee](https://www.buymeacoffee.com/skillnter)
- [PayPal](https://www.paypal.me/skillnte)
- [GitHub Sponsors](https://github.com/sponsors/Skillnter)
- [Patreon](https://www.patreon.com/skillnter)
- [Open Collective](https://opencollective.com/skillnter)

You can also use crypto:

![BNB: 0x1D59a291391a3CE17C63D5dC50F258Dc0Ab62889](https://img.shields.io/badge/BNB-0x1D59a291391a3CE17C63D5dC50F258Dc0Ab62889-brightgreen)

![BTC: bc1p22h4nsad5d8ketyhuvf0vyva6unttxwzzqvkty5r839as0mlclgs72d3mf](https://img.shields.io/badge/BTC-bc1p22h4nsad5d8ketyhuvf0vyva6unttxwzzqvkty5r839as0mlclgs72d3mf-brightgreen)

![ETH: 0x1D59a291391a3CE17C63D5dC50F258Dc0Ab62889](https://img.shields.io/badge/ETH-0x1D59a291391a3CE17C63D5dC50F258Dc0Ab62889-brightgreen)

## License

`@wthek/koa-middleware` project is open-sourced software licensed under the [MIT license](LICENSE) by [Himanshu Bansal][skillnter].

[skillnter]: https://github.com/Skillnter/
[http-error-kit]: https://www.npmjs.com/package/http-error-kit

