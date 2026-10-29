import type { ApplicationService } from '@adonisjs/core/types'
import { RuntimeException } from '@adonisjs/core/exceptions'
import { WebhooksManager } from '../src/webhooks_manager.ts'
import type { WebhooksConfig } from '../src/types.ts'

export default class WebhooksProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    this.app.container.singleton(WebhooksManager, async (resolver) => {
      const config = this.app.config.get<WebhooksConfig | undefined>('webhooks')
      if (!config) {
        throw new RuntimeException(
          'Missing "config/webhooks.ts" file. Run "node ace configure adonis-webhooks" to create it'
        )
      }

      return new WebhooksManager(config, await resolver.make('router'), this.app)
    })
  }
}
