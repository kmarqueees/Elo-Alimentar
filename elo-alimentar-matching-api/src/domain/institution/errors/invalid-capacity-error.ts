import { InvalidValueError } from '@/core/errors/domain-error'

export class InvalidCapacityError extends InvalidValueError {
  constructor() {
    super('Storage capacity must be greater than zero.')
  }
}
