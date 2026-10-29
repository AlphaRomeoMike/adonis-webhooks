/*
|--------------------------------------------------------------------------
| Package entrypoint
|--------------------------------------------------------------------------
|
| Export values from the package entrypoint as you see fit.
|
*/

export { configure } from './configure.ts'
export { stubsRoot } from './stubs/main.ts'
export { defineConfig } from './src/define_config.ts'
export { RemoteEvent } from './src/remote_event.ts'
export { BaseParser } from './src/base_parser.ts'
export { WebhooksManager } from './src/webhooks_manager.ts'
export * as errors from './src/errors.ts'
