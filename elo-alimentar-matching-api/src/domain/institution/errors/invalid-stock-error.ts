import { InvalidValueError } from '@/core/errors/domain-error'

export class InvalidStockError extends InvalidValueError {
  constructor() {
    super('Stock must be zero or more kilograms.')
  }
}
