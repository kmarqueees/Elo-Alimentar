export class InvalidBatchQuantityError extends Error {
  constructor() {
    super('Batch quantity must be greater than zero.')
  }
}
