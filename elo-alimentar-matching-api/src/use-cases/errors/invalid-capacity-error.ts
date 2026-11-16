export class InvalidCapacityError extends Error {
  constructor() {
    super('Available capacity must be greater than zero.')
  }
}
