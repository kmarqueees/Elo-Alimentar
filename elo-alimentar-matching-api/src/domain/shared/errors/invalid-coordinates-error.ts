import { InvalidValueError } from '@/core/errors/domain-error'

export class InvalidCoordinatesError extends InvalidValueError {
  constructor() {
    super('Latitude must be between -90 and 90 and longitude between -180 and 180.')
  }
}
