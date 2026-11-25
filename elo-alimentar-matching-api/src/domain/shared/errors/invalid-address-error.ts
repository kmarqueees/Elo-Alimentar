import { InvalidValueError } from '@/core/errors/domain-error'

export class InvalidAddressError extends InvalidValueError {
  constructor() {
    super('Address must include street, number, city and a valid state (UF).')
  }
}
