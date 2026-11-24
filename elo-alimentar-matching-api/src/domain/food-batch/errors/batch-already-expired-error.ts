import { InvalidValueError } from '@/core/errors/domain-error'

export class BatchAlreadyExpiredError extends InvalidValueError {
  constructor() {
    super('Batch expiration date must be in the future.')
  }
}
