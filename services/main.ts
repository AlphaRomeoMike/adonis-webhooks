import app from '@adonisjs/core/services/app'
import { WebhooksManager } from '../src/webhooks_manager.ts'

let webhooks: WebhooksManager

/**
 * Returns the singleton instance of the webhooks manager from
 * the container
 */
await app.booted(async () => {
  webhooks = await app.container.make(WebhooksManager)
})

export { webhooks as default }
