import { createError } from '@adonisjs/core/exceptions'

export const E_INVALID_WEBHOOK_SIGNATURE = createError(
  'Invalid webhook signature',
  'E_INVALID_WEBHOOK_SIGNATURE',
  401
)
