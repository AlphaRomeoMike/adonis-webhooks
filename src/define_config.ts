import type { WebhooksConfig } from './types.ts'

export function defineConfig(
  config: Partial<WebhooksConfig> & Pick<WebhooksConfig, 'routes'>
): WebhooksConfig {
  return { prefix: '/webhooks', ...config }
}
