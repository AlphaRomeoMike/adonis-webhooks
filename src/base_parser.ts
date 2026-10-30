import { Webhook } from 'standardwebhooks'
import type { HttpRequest } from '@adonisjs/core/http'
import { RemoteEvent } from './remote_event.ts'
import { E_INVALID_WEBHOOK_SIGNATURE } from './errors.ts'

/**
 * Svix-powered senders (Clerk, Resend) sign the same way but send
 * "svix-*" headers instead of "webhook-*"
 */
function header(request: HttpRequest, name: 'id' | 'timestamp' | 'signature') {
  return request.header(`webhook-${name}`) ?? request.header(`svix-${name}`)
}

/**
 * Verifies and parses webhooks signed with the Standard Webhooks spec
 * (https://www.standardwebhooks.com). Extend it and override "verify"
 * for providers that sign differently, or "parse" to shape the event.
 */
export class BaseParser {
  /**
   * Returns the parsed payload, or throws E_INVALID_WEBHOOK_SIGNATURE.
   * Must verify the raw body, since the parsed body may differ in bytes.
   */
  async verify(request: HttpRequest, secret: string): Promise<unknown> {
    try {
      return new Webhook(secret).verify(request.raw() ?? '', {
        'webhook-id': header(request, 'id') ?? '',
        'webhook-timestamp': header(request, 'timestamp') ?? '',
        'webhook-signature': header(request, 'signature') ?? '',
      })
    } catch {
      throw new E_INVALID_WEBHOOK_SIGNATURE()
    }
  }

  /**
   * Returning null acknowledges the webhook without calling the consumer
   */
  async parse(payload: any, request: HttpRequest): Promise<RemoteEvent | null> {
    return new RemoteEvent(header(request, 'id')!, payload.type, payload)
  }
}
