import type { ApplicationService } from '@adonisjs/core/types'
import type { HttpContext, Router } from '@adonisjs/core/http'
import { BaseParser } from './base_parser.ts'
import type { WebhooksConfig } from './types.ts'

export class WebhooksManager {
  constructor(
    protected config: WebhooksConfig,
    protected router: Router,
    protected app: ApplicationService
  ) {}

  /**
   * Registers "POST <prefix>/:type". Returns the route, so middleware
   * can be attached. Exclude it from CSRF protection in config/shield.ts.
   */
  registerRoutes() {
    return this.router
      .post(`${this.config.prefix}/:type`, (ctx) => this.handle(ctx))
      .as('webhooks.handle')
  }

  async handle({ params, request, response }: HttpContext) {
    // hasOwn, so "/webhooks/constructor" does not resolve to Object.prototype
    const route = Object.hasOwn(this.config.routes, params.type)
      ? this.config.routes[params.type]
      : undefined
    if (!route) {
      return response.notFound()
    }

    const { default: Parser } = route.parser ? await route.parser() : { default: BaseParser }
    const parser = await this.app.container.make(Parser)
    const secret = typeof route.secret === 'string' ? route.secret : route.secret.release()
    const event = await parser.parse(await parser.verify(request, secret), request)

    if (event) {
      const { default: Consumer } = await route.consumer()
      const consumer = await this.app.container.make(Consumer)
      await consumer.consume(event)
    }

    return response.noContent()
  }
}
