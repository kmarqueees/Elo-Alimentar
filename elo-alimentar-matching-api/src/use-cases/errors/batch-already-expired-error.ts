export class BatchAlreadyExpiredError extends Error {
  constructor() {
    super('Batch expiration date must be in the future.')
  }
}
