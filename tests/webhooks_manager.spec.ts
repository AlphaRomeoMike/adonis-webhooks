import { Socket } from 'node:net'
import { test } from '@japa/runner'
import { IncomingMessage } from 'node:http'
import { Webhook } from 'standardwebhooks'
import { Secret } from '@adonisjs/core/helpers'
import { AppFactory } from '@adonisjs/core/factories/app'
import type { ApplicationService } from '@adonisjs/core/types'
import { HttpContextFactory, RequestFactory, RouterFactory } from '@adonisjs/core/factories/http'
import { BaseParser, defineConfig, RemoteEvent, WebhooksManager } from '../index.ts'

const secret = `whsec_${Buffer.from('a-test-secret-of-32-bytes-length').toString('base64')}`
const received: RemoteEvent[] = []

class RecordingConsumer {
  consume(event: RemoteEvent) {
    received.push(event)
  }
}

class IgnoringParser extends BaseParser {
  async parse() {
    return null
  }
}

async function setup() {
  const app = new AppFactory().create(new URL('../', import.meta.url)) as ApplicationService
  await app.init()

  const config = defineConfig({
    routes: {
      clerk: { consumer: async () => ({ default: RecordingConsumer }), secret },
      wrapped: {
        consumer: async () => ({ default: RecordingConsumer }),
        secret: new Secret(secret),
      },
      ignored: {
        parser: async () => ({ default: IgnoringParser }),
        consumer: async () => ({ default: RecordingConsumer }),
        secret,
      },
    },
  })

  const router = new RouterFactory().merge({ app }).create()
  return new WebhooksManager(config, router, app)
}

function makeContext(type: string, body: string, signedBody = body) {
  const id = 'msg_1'
  const timestamp = new Date()
  const req = new IncomingMessage(new Socket())
  req.headers = {
    'webhook-id': id,
    'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
    'webhook-signature': new Webhook(secret).sign(id, timestamp, signedBody),
  }

  const request = new RequestFactory().merge({ req }).create()
  request.updateRawBody(body)

  const ctx = new HttpContextFactory().merge({ request }).create()
  ctx.params = { type }
  return ctx
}

test.group('WebhooksManager', (group) => {
  group.each.setup(() => {
    received.length = 0
  })

  test('passes a verified event to the consumer', async ({ assert }) => {
    const manager = await setup()
    const ctx = makeContext('clerk', JSON.stringify({ type: 'user.created', data: { id: 1 } }))

    await manager.handle(ctx)

    assert.equal(ctx.response.getStatus(), 204)
    assert.deepEqual(received, [
      new RemoteEvent('msg_1', 'user.created', { type: 'user.created', data: { id: 1 } }),
    ])
  })

  test('accepts a secret wrapped in Secret', async ({ assert }) => {
    const manager = await setup()
    const ctx = makeContext('wrapped', '{"type":"user.created"}')

    await manager.handle(ctx)

    assert.equal(ctx.response.getStatus(), 204)
    assert.lengthOf(received, 1)
  })

  test('rejects a body that differs from the signed one', async ({ assert }) => {
    const manager = await setup()
    const ctx = makeContext('clerk', '{"type":"user.deleted"}', '{"type":"user.created"}')

    await assert.rejects(() => manager.handle(ctx), 'Invalid webhook signature')
    assert.lengthOf(received, 0)
  })

  test('rejects a request without a raw body', async ({ assert }) => {
    const manager = await setup()
    const ctx = makeContext('clerk', '{}')
    ctx.request.updateRawBody(null as unknown as string)

    await assert.rejects(() => manager.handle(ctx), 'Invalid webhook signature')
  })

  test('returns 404 for unknown type "{type}"')
    .with([{ type: 'stripe' }, { type: 'constructor' }, { type: '__proto__' }])
    .run(async ({ assert }, { type }) => {
      const manager = await setup()
      const ctx = makeContext(type, '{}')

      await manager.handle(ctx)

      assert.equal(ctx.response.getStatus(), 404)
    })

  test('skips the consumer when the parser returns null', async ({ assert }) => {
    const manager = await setup()
    const ctx = makeContext('ignored', '{"type":"user.created"}')

    await manager.handle(ctx)

    assert.equal(ctx.response.getStatus(), 204)
    assert.lengthOf(received, 0)
  })

  test('registers POST <prefix>/:type', async ({ assert }) => {
    const manager = await setup()
    const route = manager.registerRoutes().toJSON()

    assert.equal(route.pattern, '/webhooks/:type')
    assert.deepEqual(route.methods, ['POST'])
    assert.equal(route.name, 'webhooks.handle')
  })
})
