import type { Secret } from '@adonisjs/core/helpers'
import type { BaseParser } from './base_parser.ts'
import type { RemoteEvent } from './remote_event.ts'

type LazyImport<T> = () => Promise<{ default: T }>
type Constructor<T> = new (...args: any[]) => T

export interface WebhookConsumer {
  consume(event: RemoteEvent): unknown
}

export interface WebhookRouteConfig {
  /**
   * Defaults to BaseParser, which verifies Standard Webhooks signatures
   */
  parser?: LazyImport<Constructor<BaseParser>>
  consumer: LazyImport<Constructor<WebhookConsumer>>
  /**
   * Accepts the value of "Env.schema.secret()" as it is
   */
  secret: string | Secret<string>
}

export interface WebhooksConfig {
  prefix: string
  routes: Record<string, WebhookRouteConfig>
}
