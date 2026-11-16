export class BatchNotAvailableError extends Error {
  constructor() {
    super('Batch is not available for matching.')
  }
}
