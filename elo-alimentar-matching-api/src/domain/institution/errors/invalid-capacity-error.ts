import { InvalidValueError } from '@/core/errors/domain-error'

export class InvalidCapacityError extends InvalidValueError {
  constructor() {
    super('Available capacity must be greater than zero.')
  }
}
