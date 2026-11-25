import { InvalidValueError } from '@/core/errors/domain-error'

export class InvalidPostalCodeError extends InvalidValueError {
  constructor() {
    super('Postal code (CEP) must have 8 digits.')
  }
}
