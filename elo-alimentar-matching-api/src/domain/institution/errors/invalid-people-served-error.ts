import { InvalidValueError } from '@/core/errors/domain-error'

export class InvalidPeopleServedError extends InvalidValueError {
  constructor() {
    super('People served per day must be a whole number greater than zero.')
  }
}
