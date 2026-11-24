import { InvalidValueError } from '@/core/errors/domain-error'

export class InvalidBatchQuantityError extends InvalidValueError {
  constructor() {
    super('Batch quantity must be greater than zero.')
  }
}
