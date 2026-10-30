# adonis-webhooks

Receive signed webhooks in AdonisJS. Inspired by Symfony's Webhook component.

Each incoming webhook goes through a **parser**, which verifies the signature and turns the request into a `RemoteEvent`, and then a **consumer**, which acts on the event. Signatures that follow the [Standard Webhooks](https://www.standardwebhooks.com) spec are verified out of the box. That covers senders such as OpenAI, plus Clerk, Resend and other Svix-powered services, which send the same headers prefixed `svix-` instead of `webhook-`. For providers that sign differently, you write a small parser.

Requires AdonisJS v7 and Node.js 24 or later.

## Installation

```sh
node ace add adonis-webhooks
```

This installs the package, creates `config/webhooks.ts` and registers the provider in `adonisrc.ts`.

Then register the route in `start/routes.ts`:

```ts
import webhooks from 'adonis-webhooks/services/main'

webhooks.registerRoutes() // POST /webhooks/:type
```

> [!IMPORTANT]
> Webhook senders can't send a CSRF token. If CSRF protection is enabled in `config/shield.ts`, add the route to `csrf.exceptRoutes`:
>
> ```ts
> exceptRoutes: (ctx) => ctx.route?.name === 'webhooks.handle'
> ```

## Receiving a webhook

Add an entry under `routes`. Its key becomes the last segment of the URL, so `clerk` is served at `POST /webhooks/clerk`.

```ts
// config/webhooks.ts
import env from '#start/env'
import { defineConfig } from 'adonis-webhooks'

export default defineConfig({
  routes: {
    clerk: {
      consumer: () => import('../app/webhooks/clerk_consumer.js'),
      secret: env.get('CLERK_WEBHOOK_SECRET'),
    },
  },
})
```

Declare the secret in `start/env.ts`. You can pass either a string or the `Secret` returned by `Env.schema.secret()`:

```ts
CLERK_WEBHOOK_SECRET: Env.schema.secret(),
```

Then write the consumer:

```ts
// app/webhooks/clerk_consumer.ts
import type { RemoteEvent } from 'adonis-webhooks'

export default class ClerkConsumer {
  async consume(event: RemoteEvent<{ type: string; data: any }>) {
    if (event.name === 'user.created') {
      // event.id      -> the "webhook-id" (or "svix-id") header, use it to skip duplicates
      // event.payload -> the parsed JSON body
    }
  }
}
```

Consumers and parsers are created through the container, so you can inject dependencies with `@inject()`.

### Responses

| Situation                                       | Status                                                 |
| ----------------------------------------------- | ------------------------------------------------------ |
| Verified and consumed, or ignored by the parser | `204`                                                  |
| Signature missing or invalid                    | `401` (`E_INVALID_WEBHOOK_SIGNATURE`)                  |
| No entry for that key in `routes`               | `404`                                                  |
| The consumer throws                             | Handled by your app's exception handler, usually `500` |

The consumer runs before the response is sent. Most providers time out after a few seconds and then retry. If the work is slow, have the consumer dispatch a job to your queue and return.

## Custom parsers

When a provider doesn't use Standard Webhooks, extend `BaseParser`:

- `verify()` checks the signature and returns the parsed payload.
- `parse()` builds the `RemoteEvent`.

Always verify against `request.raw()`, never the parsed body, because re-serialized JSON won't match the signed bytes.

Here's a parser for GitHub:

```ts
// app/webhooks/github_parser.ts
import { createHmac } from 'node:crypto'
import { safeEqual } from '@adonisjs/core/helpers'
import type { HttpRequest } from '@adonisjs/core/http'
import { BaseParser, RemoteEvent, errors } from 'adonis-webhooks'

export default class GitHubParser extends BaseParser {
  async verify(request: HttpRequest, secret: string) {
    const raw = request.raw() ?? ''
    const expected = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`

    if (!safeEqual(expected, request.header('x-hub-signature-256') ?? '')) {
      throw new errors.E_INVALID_WEBHOOK_SIGNATURE()
    }

    return JSON.parse(raw)
  }

  async parse(payload: any, request: HttpRequest) {
    return new RemoteEvent(
      request.header('x-github-delivery')!,
      request.header('x-github-event')!,
      payload
    )
  }
}
```

```ts
// config/webhooks.ts
github: {
  parser: () => import('../app/webhooks/github_parser.js'),
  consumer: () => import('../app/webhooks/github_consumer.js'),
  secret: env.get('GITHUB_WEBHOOK_SECRET'),
},
```

### Ignoring events

If `parse()` returns `null`, the webhook is acknowledged with `204` and the consumer is not called. Use this to skip events you don't care about:

```ts
async parse(payload: any, request: HttpRequest) {
  if (payload.type !== 'user.created') {
    return null
  }
  return super.parse(payload, request)
}
```

## Changing the route

The URL prefix defaults to `/webhooks`. Set `prefix` in `defineConfig` to change it.

`registerRoutes()` returns the route, so you can attach middleware to it:

```ts
// ipAllowlist stands in for any named middleware from start/kernel.ts
webhooks.registerRoutes().use(middleware.ipAllowlist())
```

## Not included yet

- Sending webhooks
- Replay protection beyond Standard Webhooks' timestamp check. To skip duplicates, store `event.id`.

## License

MIT
